/**
 * Scoring. Pure functions, no I/O, shared by the eval harness and the app.
 *
 * Two rules from EVAL.md §1 are enforced here rather than by convention:
 *   1. The scorer is blind to model output formatting. It scores parsed values.
 *   2. It only accepts an answer the document genuinely permits. `acceptable`
 *      lists are authored blind, from the document, never from model output.
 */
import type { Extracted, LineItem } from "./schema"

export interface TruthLineItem {
  description: string
  quantity: number | null
  unitPrice: number | null
  amount: number | null
}

export interface Truth {
  vendor: string | null
  invoiceNo: string | null
  issueDate: string | null
  dueDate: string | null
  currency: string | null
  subtotal: number | null
  tax: number | null
  total: number | null
  category: string | null
  billable: boolean | null
  lineItems: TruthLineItem[]
}

export type FieldName = Exclude<keyof Extracted, "lineItems">

export const SCALAR_FIELDS: FieldName[] = [
  "vendor",
  "invoiceNo",
  "issueDate",
  "dueDate",
  "currency",
  "subtotal",
  "tax",
  "total",
  "category",
  "billable",
]

export interface FieldScore {
  correct: boolean
  predicted: unknown
  truth: unknown
  /** True when truth is null and the model correctly returned null. */
  correctNull: boolean
  /** True when truth is non-null and the model produced nothing. */
  missed: boolean
}

function canon(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,;:]+$/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function sameText(a: string, b: string): boolean {
  return canon(a) === canon(b)
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  // Defensive: a schema-constrained model returns numbers, but a repair
  // round-trip can hand back a formatted string.
  const cleaned = value.replace(/[^0-9.,-]/g, "").replace(/,(?=\d{3}\b)/g, "")
  const normalised = /,\d{2}$/.test(cleaned) ? cleaned.replace(",", ".") : cleaned
  const parsed = Number.parseFloat(normalised)
  return Number.isFinite(parsed) ? parsed : null
}

const MONEY_EPSILON = 0.005

export function scoreField(
  field: FieldName,
  predicted: unknown,
  truth: unknown,
  acceptable: (string | number | boolean)[] = []
): FieldScore {
  const truthIsNull = truth === null || truth === undefined

  if (truthIsNull) {
    const predictedIsNull = predicted === null || predicted === undefined
    return {
      correct: predictedIsNull,
      predicted,
      truth,
      correctNull: predictedIsNull,
      missed: false,
    }
  }

  const missed = predicted === null || predicted === undefined
  if (missed) {
    return { correct: false, predicted, truth, correctNull: false, missed: true }
  }

  const accepts = (value: unknown) => {
    if (typeof value === "string" && typeof truth === "string") {
      return sameText(value, truth) || acceptable.some((a) => sameText(value, String(a)))
    }
    const predictedNumber = asNumber(value)
    const truthNumber = asNumber(truth)
    if (predictedNumber !== null && truthNumber !== null) {
      return (
        Math.abs(predictedNumber - truthNumber) <= MONEY_EPSILON ||
        acceptable.some((a) => Math.abs(asNumber(a)! - truthNumber) <= MONEY_EPSILON)
      )
    }
    if (typeof value === "boolean" || typeof truth === "boolean") {
      return (
        value === truth ||
        acceptable.some((a) => a === (truth as unknown))
      )
    }
    return acceptable.some((a) => asNumber(a) === asNumber(value)) || value === truth
  }

  return { correct: accepts(predicted), predicted, truth, correctNull: false, missed: false }
}

export interface LineItemScore {
  correctCells: number
  totalCells: number
  matchedItems: number
  spuriousItems: number
  missingItems: number
}

/**
 * Line items are matched by description first, then by token overlap, because
 * the model reorders and re-wraps descriptions freely but almost always keeps
 * the words. Slot count is max(truth, predicted) so emitting invented extra
 * items costs something — otherwise a model could score perfectly by
 * hallucinating every plausible charge.
 */
export function scoreLineItems(
  predicted: LineItem[],
  truth: TruthLineItem[]
): LineItemScore {
  const slots = Math.max(truth.length, predicted.length)
  if (slots === 0) {
    return { correctCells: 0, totalCells: 0, matchedItems: 0, spuriousItems: 0, missingItems: 0 }
  }

  const usedTruth = new Set<number>()
  const usedPredicted = new Set<number>()
  const pairs: [number, number][] = []

  // Pass 1: exact description match.
  truth.forEach((t, ti) => {
    predicted.forEach((p, pi) => {
      if (usedPredicted.has(pi)) return
      if (sameText(p.description ?? "", t.description)) {
        pairs.push([ti, pi])
        usedTruth.add(ti)
        usedPredicted.add(pi)
      }
    })
  })

  // Pass 2: token overlap.
  truth.forEach((t, ti) => {
    if (usedTruth.has(ti)) return
    const truthTokens = new Set(canon(t.description).split(" "))
    let best = -1
    let bestScore = 0

    predicted.forEach((p, pi) => {
      if (usedPredicted.has(pi)) return
      const predictedTokens = canon(p.description ?? "").split(" ")
      const overlap = predictedTokens.filter((token) => truthTokens.has(token)).length
      const ratio = overlap / Math.max(1, Math.min(truthTokens.size, predictedTokens.length))
      if (ratio > bestScore) {
        bestScore = ratio
        best = pi
      }
    })

    if (best >= 0 && bestScore >= 0.5) {
      pairs.push([ti, best])
      usedTruth.add(ti)
      usedPredicted.add(best)
    }
  })

  let correctCells = 0
  for (const [ti, pi] of pairs) {
    const t = truth[ti]
    const p = predicted[pi]
    if (sameText(p.description ?? "", t.description)) correctCells++

    const numeric: [keyof TruthLineItem, keyof LineItem][] = [
      ["quantity", "quantity"],
      ["unitPrice", "unitPrice"],
      ["amount", "amount"],
    ]
    for (const [truthKey, predictedKey] of numeric) {
      const expected = asNumber(t[truthKey])
      const actual = asNumber(p[predictedKey])
      if (expected === null) continue // not printed, so not scorable
      if (actual !== null && Math.abs(actual - expected) <= MONEY_EPSILON) correctCells++
    }
  }

  return {
    correctCells,
    totalCells: slots * 4,
    matchedItems: pairs.length,
    spuriousItems: predicted.length - usedPredicted.size,
    missingItems: truth.length - usedTruth.size,
  }
}

export interface RecordScore {
  fields: Record<FieldName, FieldScore>
  lineItems: LineItemScore
  /** Correct scalar fields out of 10. */
  scalarCorrect: number
  /** Correct scalar cells plus line-item cells, out of the total. */
  cellsCorrect: number
  cellsTotal: number
  /** Every scalar field and every line-item cell correct. The harsh metric. */
  exact: boolean
  /** For FR-4: populated truth fields the model actually produced. */
  populatedFields: number
  populatedRecovered: number
}

export function scoreRecord(
  predicted: Extracted,
  truth: Truth,
  acceptable: Record<string, (string | number | boolean)[]> = {}
): RecordScore {
  const fields = {} as Record<FieldName, FieldScore>

  let scalarCorrect = 0
  let populatedFields = 0
  let populatedRecovered = 0

  for (const field of SCALAR_FIELDS) {
    const truthValue = (truth as unknown as Record<string, unknown>)[field]
    const predictedValue = (predicted as unknown as Record<string, unknown>)[field]
    const score = scoreField(field, predictedValue, truthValue, acceptable[field] ?? [])
    fields[field] = score
    if (score.correct) scalarCorrect++
    if (truthValue !== null && truthValue !== undefined) {
      populatedFields++
      if (predictedValue !== null && predictedValue !== undefined) populatedRecovered++
    }
  }

  const lineItems = scoreLineItems(predicted.lineItems ?? [], truth.lineItems ?? [])

  const cellsCorrect = scalarCorrect + lineItems.correctCells
  const cellsTotal = SCALAR_FIELDS.length + lineItems.totalCells

  return {
    fields,
    lineItems,
    scalarCorrect,
    cellsCorrect,
    cellsTotal,
    exact: cellsCorrect === cellsTotal,
    populatedFields,
    populatedRecovered,
  }
}