/**
 * Feature engineering for the chase list.
 *
 * The target is days-to-payment. The features are deliberately boring and
 * numeric, because TabPFN is strong on exactly this shape of small tabular
 * data — a few dozen rows, a handful of columns, one numeric target.
 *
 * The client name never survives. It is replaced with a stable hash before
 * anything crosses the network boundary, and the per-client statistics that
 * carry the signal are computed locally and sent as numbers instead. That is
 * what makes the feature row safe to send rather than merely anonymous.
 */
import { parseCsv } from "./csv"

export interface HistoryRow {
  invoiceNo: string
  client: string
  issueDate: string
  paidDate: string | null
  daysToPayment: number | null
  termsDays: number
  amount: number
  currency: string
  category: string
}

export interface FeatureRow {
  invoiceNo: string
  clientHash: string
  /** Features sent to the model. All numeric. */
  features: number[]
  /** Human-readable names, aligned index-for-index with `features`. */
  featureNames: string[]
  amount: number
  issueDate: string
  daysToPayment: number | null
}

export const FEATURE_NAMES = [
  "amount",
  "log_amount",
  "terms_days",
  "issue_month",
  "issue_quarter",
  "is_year_end",
  "client_history_count",
  "client_mean_days",
  "client_std_days",
  "client_late_rate",
  "client_mean_amount",
  "global_mean_days",
]

/**
 * FNV-1a, 32-bit. Stability across requests matters more than collision
 * resistance here: the same client must hash to the same value or the
 * per-client features stop lining up.
 */
export function hashClient(name: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < name.length; i++) {
    hash ^= name.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `c${hash.toString(36)}`
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  return Math.sqrt(mean(values.map((value) => (value - m) ** 2)))
}

export function parseHistory(csv: string): HistoryRow[] {
  const parsed = parseCsv(csv)

  return parsed
    .map((row) => {
      const issue = row.issue_date
      const paid = row.paid_date
      const stated = row.days_to_payment

      let days: number | null = null
      if (stated && Number.isFinite(Number(stated))) {
        days = Number(stated)
      } else if (issue && paid) {
        // Derive it when the column is missing, rather than dropping the row.
        const diff = (Date.parse(paid) - Date.parse(issue)) / 86400000
        if (Number.isFinite(diff)) days = Math.round(diff)
      }

      const terms = Number(row.terms_days)

      return {
        invoiceNo: row.invoice_no ?? "",
        client: (row.client ?? "").trim(),
        issueDate: issue ?? "",
        paidDate: paid || null,
        daysToPayment: days,
        termsDays: Number.isFinite(terms) ? terms : 30,
        amount: Number(row.amount ?? 0),
        currency: row.currency ?? "USD",
        category: row.category ?? "uncategorised",
      }
    })
    .filter((row) => row.client !== "" && row.issueDate !== "")
}

interface ClientStats {
  count: number
  meanDays: number
  stdDays: number
  lateRate: number
  meanAmount: number
}

/**
 * Per-client statistics, computed only from rows that have already been paid.
 * An open invoice must never contribute to the statistics used to predict it.
 */
export function clientStats(history: HistoryRow[]): Map<string, ClientStats> {
  const stats = new Map<string, ClientStats>()

  for (const row of history) {
    if (row.daysToPayment === null) continue

    const existing = stats.get(row.client) ?? {
      count: 0,
      meanDays: 0,
      stdDays: 0,
      lateRate: 0,
      meanAmount: 0,
    }

    existing.count += 1
    existing.meanDays =
      existing.meanDays + (row.daysToPayment - existing.meanDays) / existing.count
    existing.meanAmount =
      existing.meanAmount + (row.amount - existing.meanAmount) / existing.count
    if (row.daysToPayment > row.termsDays) {
      existing.lateRate = (existing.lateRate * (existing.count - 1) + 1) / existing.count
    } else {
      existing.lateRate = (existing.lateRate * (existing.count - 1)) / existing.count
    }

    stats.set(row.client, existing)
  }

  // Spread needs a second pass: the running mean is only final at the end.
  for (const [client, entry] of stats) {
    const days = history
      .filter((row) => row.client === client && row.daysToPayment !== null)
      .map((row) => row.daysToPayment as number)
    entry.stdDays = stdDev(days)
  }

  return stats
}

function featureVector(
  row: HistoryRow,
  stats: Map<string, ClientStats>,
  globalMeanDays: number
): number[] {
  const client = stats.get(row.client)
  const issue = new Date(row.issueDate)
  const month = Number.isNaN(issue.getTime()) ? 1 : issue.getUTCMonth() + 1

  return [
    row.amount,
    Math.log1p(Math.max(0, row.amount)),
    row.termsDays,
    month,
    Math.ceil(month / 3),
    // Year-end is when invoices get forgotten. Worth an explicit feature.
    month === 11 || month === 12 ? 1 : 0,
    client?.count ?? 0,
    client?.meanDays ?? globalMeanDays,
    client?.stdDays ?? 0,
    client?.lateRate ?? 0,
    client?.meanAmount ?? row.amount,
    globalMeanDays,
  ]
}

export interface Dataset {
  /** Rows with a known target, used to fit and to score against baselines. */
  train: FeatureRow[]
  /** Rows to predict. */
  test: FeatureRow[]
  clientStats: Map<string, ClientStats>
  globalMeanDays: number
}

export function buildDataset(history: HistoryRow[]): Dataset {
  const stats = clientStats(history)
  const knownTargets = history.filter((row) => row.daysToPayment !== null)
  const globalMeanDays = mean(knownTargets.map((row) => row.daysToPayment as number))

  const toRow = (row: HistoryRow): FeatureRow => ({
    invoiceNo: row.invoiceNo,
    clientHash: hashClient(row.client),
    features: featureVector(row, stats, globalMeanDays),
    featureNames: FEATURE_NAMES,
    amount: row.amount,
    issueDate: row.issueDate,
    daysToPayment: row.daysToPayment,
  })

  return {
    train: history.filter((row) => row.daysToPayment !== null).map(toRow),
    test: history.filter((row) => row.daysToPayment === null).map(toRow),
    clientStats: stats,
    globalMeanDays,
  }
}

/** The two naive baselines a prediction has to beat to be worth anything. */
export function baselinePrediction(
  row: FeatureRow,
  dataset: Dataset
): { clientMeanDays: number; globalMeanDays: number; clientKnown: boolean } {
  const stats = dataset.clientStats.get(
    [...dataset.clientStats.keys()].find(
      (name) => hashClient(name) === row.clientHash
    ) ?? ""
  )

  return {
    clientMeanDays: stats?.meanDays ?? dataset.globalMeanDays,
    globalMeanDays: dataset.globalMeanDays,
    clientKnown: Boolean(stats),
  }
}

/** Mean absolute error, the metric EVAL.md §3.5 reports for every predictor. */
export function meanAbsoluteError(predictions: number[], actuals: number[]): number {
  if (predictions.length === 0) return 0
  const total = predictions.reduce(
    (sum, prediction, index) => sum + Math.abs(prediction - actuals[index]),
    0
  )
  return total / predictions.length
}