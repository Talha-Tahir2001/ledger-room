/**
 * TabPFN proxy (FR-10, FR-11, FR-18 in PRIVACY.md).
 *
 * This route is the only place `TABPFN_API_KEY` is used, which is the reason
 * for calling Prior Labs from a server route rather than shipping their SDK to
 * the browser.
 *
 * What crosses the boundary: a matrix of numbers, and nothing else. The raw
 * client name is replaced with a stable hash here, and the per-client history
 * that actually carries the signal is collapsed into means and counts on this
 * side of the wire. No client name is transmitted, and no document text is
 * involved at all.
 */
import { NextResponse } from "next/server"

import {
  buildDataset,
  hashClient,
  meanAbsoluteError,
  parseHistory,
  type FeatureRow,
} from "@/lib/features"
import { fitRegressor, MODEL_PATH, QUANTILE_HIGH, QUANTILE_LOW, tabpfnConfigured } from "@/lib/tabpfn"

export const dynamic = "force-dynamic"
export const maxDuration = 120

interface PredictRequest {
  /** CSV of paid invoice history. */
  history?: unknown
  /** Invoices still awaiting payment. */
  openInvoices?: unknown
  /** Evaluate on a held-out slice of history instead of predicting open invoices. */
  evaluate?: unknown
}

interface OpenInvoice {
  invoiceNo: string
  client: string
  issueDate: string
  amount: number
  termsDays: number
  dueDate?: string | null
}

export async function POST(request: Request) {
  if (!tabpfnConfigured()) {
    return NextResponse.json(
      {
        error:
          "TabPFN is not configured on this deployment. Set TABPFN_API_KEY to enable payment prediction.",
        code: "tabpfn_unconfigured",
      },
      { status: 503 }
    )
  }

  let payload: PredictRequest
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "bad_request" }, { status: 400 })
  }

  if (typeof payload.history !== "string" || payload.history.trim() === "") {
    return NextResponse.json(
      { error: "A `history` CSV string is required.", code: "bad_request" },
      { status: 400 }
    )
  }

  const history = parseHistory(payload.history).sort((a, b) =>
    a.issueDate.localeCompare(b.issueDate)
  )
  const dataset = buildDataset(history)

  if (dataset.train.length < 8) {
    return NextResponse.json(
      {
        error: `Only ${dataset.train.length} paid invoices were found. Payment prediction needs more history than this to mean anything — below about 20 rows the predictions will be noise.`,
        code: "insufficient_history",
        rows: dataset.train.length,
      },
      { status: 422 }
    )
  }

  try {
    // --- held-out evaluation, so the numbers are measured not asserted -----
    if (payload.evaluate === true) {
      const heldOutSize = Math.max(5, Math.round(dataset.train.length * 0.2))
      const train = dataset.train.slice(0, dataset.train.length - heldOutSize)
      const test = dataset.train.slice(dataset.train.length - heldOutSize)

      const model = await fitRegressor(
        train.map((row) => row.features),
        train.map((row) => row.daysToPayment as number)
      )
      const predictions = await model.predict(test.map((row) => row.features))
      const actuals = test.map((row) => row.daysToPayment as number)

      const trainIds = new Set(train.map((row) => row.invoiceNo))
      const seen = history.filter(
        (row) => row.daysToPayment !== null && trainIds.has(row.invoiceNo)
      )

      // Per-client history is keyed by the hash of the *training* row's client
      // name, because that is what the test rows carry. Looking a training
      // row's invoiceNo up in the test set — which is what this did originally
      // — never matches, leaves the map empty, and silently reports the global
      // mean as though it were the client mean. That understates the baseline
      // the model has to beat, which flatters the model.
      const perClient = new Map<string, number[]>()
      for (const row of seen) {
        const key = hashClient(row.client)
        if (!key) continue
        const list = perClient.get(key) ?? []
        list.push(row.daysToPayment as number)
        perClient.set(key, list)
      }
      const globalMean =
        seen.reduce((sum, row) => sum + (row.daysToPayment as number), 0) /
        (seen.length || 1)

      const clientBaseline = test.map((row) => {
        const list = perClient.get(row.clientHash)
        return list && list.length > 0
          ? list.reduce((a, b) => a + b, 0) / list.length
          : globalMean
      })

      const inside = predictions.filter((prediction, index) => {
        const actual = actuals[index]
        return actual >= prediction.q10 && actual <= prediction.q90
      }).length

      const modelMae = meanAbsoluteError(
        predictions.map((prediction) => prediction.predicted),
        actuals
      )

      return NextResponse.json({
        mode: "evaluation",
        model: MODEL_PATH,
        rowsPaid: dataset.train.length,
        clients: dataset.clientStats.size,
        featuresPerRow: train[0]?.featureNames.length ?? 0,
        holdout: { trained: train.length, scored: test.length },
        metrics: {
          tabpfn: { mae: modelMae },
          clientMean: { mae: meanAbsoluteError(clientBaseline, actuals) },
          globalMean: { mae: meanAbsoluteError(test.map(() => globalMean), actuals) },
        },
        coverage: {
          inside,
          total: predictions.length,
          meanWidthDays:
            predictions.reduce((sum, p) => sum + (p.q90 - p.q10), 0) /
            (predictions.length || 1),
        },
        interval: { low: QUANTILE_LOW, high: QUANTILE_HIGH },
      })
    }

    // --- prediction for open invoices -------------------------------------

    const open = Array.isArray(payload.openInvoices)
      ? (payload.openInvoices as OpenInvoice[]).filter(
          (entry) => entry && typeof entry.client === "string" && entry.client !== ""
        )
      : []

    if (open.length === 0) {
      return NextResponse.json(
        { error: "No open invoices were supplied.", code: "no_open_invoices" },
        { status: 400 }
      )
    }

    // Open invoices join the history so their per-client features are computed
    // from paid rows only, and then are held out of the training target.
    const openAsHistory = open.map((entry) => ({
      invoiceNo: entry.invoiceNo,
      client: entry.client,
      issueDate: entry.issueDate,
      paidDate: null,
      daysToPayment: null,
      termsDays: entry.termsDays ?? 30,
      amount: entry.amount,
      currency: "USD",
      category: "open",
    }))

    const withOpen = buildDataset([...history, ...openAsHistory])
    const toPredict: FeatureRow[] = openAsHistory.map((row) => {
      const match = withOpen.test.find((entry) => entry.invoiceNo === row.invoiceNo)
      return match ?? {
        invoiceNo: row.invoiceNo,
        clientHash: "",
        features: [],
        featureNames: [],
        amount: row.amount,
        issueDate: row.issueDate,
        daysToPayment: null,
      }
    })

    const model = await fitRegressor(
      withOpen.train.map((row) => row.features),
      withOpen.train.map((row) => row.daysToPayment as number)
    )
    const predictions = await model.predict(toPredict.map((row) => row.features))

    const rows = open.map((entry, index) => {
      const featureRow = toPredict[index]
      const prediction = predictions[index] ?? {
        predicted: dataset.globalMeanDays,
        q10: dataset.globalMeanDays,
        q90: dataset.globalMeanDays,
      }
      const stats = withOpen.clientStats.get(entry.client)

      return {
        invoiceNo: entry.invoiceNo,
        clientHash: featureRow.clientHash,
        amount: entry.amount,
        issueDate: entry.issueDate,
        predictedDaysToPayment: Math.round(prediction.predicted),
        interval: [
          Math.round(prediction.q10),
          Math.round(prediction.q90),
        ] as [number, number],
        dueDate: entry.dueDate ?? null,
        baselines: {
          clientMeanDays: Math.round(stats?.meanDays ?? dataset.globalMeanDays),
          globalMeanDays: Math.round(dataset.globalMeanDays),
          clientHistoryCount: stats?.count ?? 0,
        },
        features: Object.fromEntries(
          featureRow.featureNames.map((name, position) => [
            name,
            Number(featureRow.features[position]?.toFixed(4)),
          ])
        ),
      }
    })

    // FR-11: worst first.
    rows.sort((a, b) => b.predictedDaysToPayment - a.predictedDaysToPayment)

    return NextResponse.json({
      mode: "predict",
      model: MODEL_PATH,
      rows,
      rowsPaid: dataset.train.length,
      clients: dataset.clientStats.size,
      weak:
        dataset.train.length < 20
          ? `Fitted on ${dataset.train.length} paid invoices. Below about 20 rows these intervals are wide enough to be nearly uninformative, which is why they are shown.`
          : null,
    })
  } catch (error) {
    const stage = (error as { stage?: string }).stage
    return NextResponse.json(
      {
        error: (error as Error).message,
        code: "tabpfn_failed",
        stage: stage ?? "unknown",
      },
      { status: 502 }
    )
  }
}