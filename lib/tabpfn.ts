/**
 * TabPFN-3.5 over the Prior Labs REST API (ADR-004).
 *
 * Server-side only. `TABPFN_API_KEY` must never be `NEXT_PUBLIC_`, and the
 * route handler that calls this is the only caller — which is the reason for
 * using REST from a server route rather than shipping the Python SDK.
 *
 * The flow is upload-by-signed-URL, not a JSON post of the data:
 *
 *   POST /tabpfn/prepare_train_set_upload   -> signed URLs + train_set_upload_id
 *   PUT  <signed url>                        -> x_train.csv bytes
 *   PUT  <signed url>                        -> y_train.csv bytes
 *   POST /tabpfn/fit                         -> fitted_train_set_id
 *   POST /tabpfn/prepare_test_set_upload     -> signed URLs + test_set_upload_id
 *   PUT  <signed url>                        -> x_test.csv bytes
 *   POST /tabpfn/predict                     -> quantiles
 *
 * Two operational details that will bite if ignored: fits over ~2s stream
 * keepalive whitespace before the JSON body, and uploads go to cloud storage
 * with signed URLs that must be PUT with the exact required headers.
 */

const BASE_URL = process.env.TABPFN_BASE_URL ?? "https://api.priorlabs.ai"
const MODEL_PATH = process.env.TABPFN_MODEL_PATH ?? "v3.5_default"

/** The interval reported for every row. q10 to q90, as EVAL.md §3.5 specifies. */
export const QUANTILE_LOW = 0.1
export const QUANTILE_HIGH = 0.9

/** Median included so the point prediction is the model's own median. */
export const REQUESTED_QUANTILES = [QUANTILE_LOW, 0.5, QUANTILE_HIGH] as const

export function tabpfnConfigured(): boolean {
  return Boolean(process.env.TABPFN_API_KEY)
}

export class TabpfnError extends Error {
  readonly stage: string
  constructor(stage: string, message: string) {
    super(message)
    this.name = "TabpfnError"
    this.stage = stage
  }
}

function headers(): Record<string, string> {
  return {
    Authorization: `Bearer ${process.env.TABPFN_API_KEY}`,
    "Content-Type": "application/json",
  }
}

async function post<T>(path: string, body: unknown, stage: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  })

  // Long fits stream keepalive whitespace ahead of the JSON payload. JSON.parse
  // tolerates leading whitespace, so the body is read whole rather than assumed.
  const text = await response.text()

  if (!response.ok) {
    throw new TabpfnError(stage, `Prior Labs responded ${response.status}: ${text.slice(0, 300)}`)
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new TabpfnError(stage, `Prior Labs returned a non-JSON body: ${text.slice(0, 200)}`)
  }
}

interface SignedInfo {
  signed_urls: string[]
  required_headers: Record<string, string>
}

async function putCsv(signed: SignedInfo, csv: string, stage: string): Promise<void> {
  const url = signed.signed_urls?.[0]
  if (!url) throw new TabpfnError(stage, "Prior Labs did not return a signed upload URL.")

  const response = await fetch(url, {
    method: "PUT",
    headers: signed.required_headers ?? {},
    body: csv,
  })

  if (!response.ok) {
    throw new TabpfnError(stage, `Uploading ${stage} failed with ${response.status}.`)
  }
}

const csvCell = (value: number | string): string => {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * One header row, no index column.
 *
 * The header is not decoration. The server infers columns with `header=infer`,
 * so a CSV without one has its first data row promoted to column names — which
 * means the training matrix and the test matrix get *different* headers and the
 * fit refuses them at predict time with "different columns than fit_transform".
 * Both uploads therefore carry the identical synthetic header.
 */
export function toCsv(features: number[][], header?: string[]): string {
  const lines: string[] = []
  if (header) lines.push(header.join(","))
  for (const row of features) lines.push(row.map(csvCell).join(","))
  return lines.join("\n") + "\n"
}

export const featureHeader = (width: number): string[] =>
  Array.from({ length: width }, (_, index) => `f${index}`)

export interface Prediction {
  predicted: number
  q10: number
  q90: number
}

/**
 * Normalises the quantile response into one interval per test row.
 *
 * The documented `"quantiles"` output type has no stated response shape, and
 * the observed one is **transposed**: an array per quantile, each of length
 * = row count, not an array per row. Reading it naively produced three
 * "predictions" for a seventeen-row test set and silently reported 100%
 * interval coverage.
 *
 * `metadata.test_set_num_rows` is authoritative when present. Without it the
 * layout is inferred from which dimension matches the number of quantiles
 * requested, which is unambiguous except in the degenerate case where rows
 * and quantiles are equal in count — and in that case the two layouts are
 * transposes of one another and sorting each row recovers the same interval.
 */
export function normaliseQuantiles(
  prediction: unknown,
  expectedRows: number | null,
  quantilesRequested: readonly number[]
): Prediction[] {
  const quantileCount = quantilesRequested.length

  if (!Array.isArray(prediction) || prediction.length === 0) return []

  const allScalars = prediction.every((value) => typeof value === "number")
  if (allScalars) {
    return prediction.map((value) => ({
      predicted: Number(value),
      q10: Number(value),
      q90: Number(value),
    }))
  }

  const outer = prediction.length
  const inner = Array.isArray(prediction[0]) ? (prediction[0] as unknown[]).length : 0

  const rowsExpected =
    expectedRows ??
    (outer === quantileCount ? inner : outer)

  const transposed = outer === quantileCount && inner === rowsExpected
  const perRow = outer === rowsExpected && inner === quantileCount

  const build = (values: number[]): Prediction => {
    const sorted = [...values].sort((a, b) => a - b)
    return {
      q10: sorted[0],
      predicted: sorted[Math.floor((sorted.length - 1) / 2)],
      q90: sorted[sorted.length - 1],
    }
  }

  if (transposed || (!perRow && outer === quantileCount)) {
    const columns = prediction as unknown as number[][]
    return Array.from({ length: rowsExpected }, (_, rowIndex) =>
      build(columns.map((column) => Number(column[rowIndex])))
    )
  }

  return (prediction as unknown as number[][]).map((row) => build(row.map(Number)))
}

export interface FitResult {
  fittedTrainSetId: string
  predict: (features: number[][]) => Promise<Prediction[]>
}

export async function fitRegressor(features: number[][], targets: number[]): Promise<FitResult> {
  if (features.length === 0) {
    throw new TabpfnError("fit", "There is no history to fit on.")
  }

  const prepared = await post<{
    train_set_upload_id: string
    x_train_info: SignedInfo
    y_train_info: SignedInfo
  }>(
    "/tabpfn/prepare_train_set_upload",
    {
      x_train_info: { format: "csv" },
      y_train_info: { format: "csv" },
    },
    "prepare_train_set_upload"
  )

  const header = featureHeader(features[0].length)

  await putCsv(prepared.x_train_info, toCsv(features, header), "x_train")
  await putCsv(prepared.y_train_info, toCsv(targets.map((value) => [value]), ["y"]), "y_train")

  const fitted = await post<{ fitted_train_set_id: string; status: string }>(
    "/tabpfn/fit",
    {
      train_set_upload_id: prepared.train_set_upload_id,
      task_config: {
        task: "regression",
        tabpfn_config: { model_path: MODEL_PATH },
      },
    },
    "fit"
  )

  if (fitted.status === "failed") {
    throw new TabpfnError("fit", "Prior Labs reported the fit as failed.")
  }

  return {
    fittedTrainSetId: fitted.fitted_train_set_id,
    async predict(testFeatures: number[][]): Promise<Prediction[]> {
      if (testFeatures.length === 0) return []

      const preparedTest = await post<{
        test_set_upload_id: string
        x_test_info: SignedInfo
      }>(
        "/tabpfn/prepare_test_set_upload",
        {
          fitted_train_set_id: fitted.fitted_train_set_id,
          x_test_info: { format: "csv" },
        },
        "prepare_test_set_upload"
      )

      await putCsv(preparedTest.x_test_info, toCsv(testFeatures, featureHeader(testFeatures[0].length)), "x_test")

      const result = await post<{
        prediction: unknown
        metadata?: Record<string, unknown>
      }>(
        "/tabpfn/predict",
        {
          test_set_upload_id: preparedTest.test_set_upload_id,
          fitted_train_set_id: fitted.fitted_train_set_id,
          task_config: {
            task: "regression",
            predict_params: {
              output_type: "quantiles",
              quantiles: [...REQUESTED_QUANTILES],
            },
          },
        },
        "predict"
      )

      const reportedRows = result.metadata?.test_set_num_rows
      return normaliseQuantiles(
        result.prediction,
        typeof reportedRows === "number" ? reportedRows : null,
        REQUESTED_QUANTILES
      )
    },
  }
}

export { MODEL_PATH }