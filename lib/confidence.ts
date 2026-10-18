/**
 * Confidence is computed, not asked for (ADR-012).
 *
 * A 4B model handed "rate your own confidence 0 to 1" returns a number with no
 * calibration behind it, and it is confidently wrong in exactly the cases that
 * cost the user money. So the score is built from three things that can be
 * checked:
 *
 *   1. verbatim   does this value actually appear in the source document?
 *   2. structure  is it well formed for its type (ISO date, ISO currency, finite)?
 *   3. agreement  do the numbers add up — subtotal + tax == total, and do the
 *                 line items sum to the subtotal?
 *
 * This is a review-priority score, not a probability, and the UI labels it that
 * way. A perfect score does not mean correct; it means nothing here
 * contradicts anything else.
 */
import { EXTRACTED_FIELDS, type Extracted } from "./schema"

export type ConfidenceScores = Record<string, number>

const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

/** Renders a number every way a real document might have printed it. */
export function numberRenderings(value: number): string[] {
  const out = new Set<string>()
  const fixed2 = value.toFixed(2)
  const plain = String(value)

  out.add(fixed2)
  out.add(plain)
  out.add(fixed2.replace(/\.00$/, ""))
  out.add(plain.replace(/\.0$/, ""))

  // Thousands separators: 1,200.00 and 1.200,00
  const withCommas = Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  out.add(withCommas)
  out.add(withCommas.replace(/,00$/, ""))
  out.add(withCommas.replace(/,/g, " ").replace(".00", ""))
  out.add(withCommas.replace(/\./g, ",").replace(/,(?=\d)/g, "."))

  // Bare integer, for documents that round
  out.add(String(Math.round(value)))

  return [...out].filter(Boolean)
}

/** True when the document contains this number in any plausible rendering. */
export function numberAppearsIn(value: number, text: string): boolean {
  const haystack = text.replace(/\s+/g, " ")
  return numberRenderings(value).some((rendering) => haystack.includes(rendering))
}

const MONTHS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
]

/** Every plausible printing of one ISO date. */
export function dateRenderings(iso: string): string[] {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return []

  const [, year, month, day] = match
  const monthNumber = Number(month)
  const monthName = MONTHS[monthNumber - 1] ?? ""
  const monthNameLong = monthName
    ? `${monthName[0].toUpperCase()}${monthName.slice(1)}`
    : ""

  const twoDigitYear = year.slice(2)

  return [
    iso,
    `${year}/${month}/${day}`,
    `${year}.${month}.${day}`,
    `${day}.${month}.${year}`,
    `${day}/${month}/${year}`,
    `${day}-${month}-${year}`,
    `${day}.${month}.${twoDigitYear}`,
    `${day}/${month}/${twoDigitYear}`,
    `${month}/${day}/${year}`,
    `${month}/${day}/${twoDigitYear}`,
    `${month}-${day}-${year}`,
    `${month}.${day}.${year}`,
    `${day} ${monthName} ${year}`,
    `${day} ${monthNameLong} ${year}`,
    `${monthName} ${day}, ${year}`,
    `${monthNameLong} ${day}, ${year}`,
  ]
}

export function dateAppearsIn(iso: string, text: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const haystack = text.toLowerCase().replace(/\s+/g, " ")
  return dateRenderings(iso).some((rendering) => haystack.includes(rendering.toLowerCase()))
}

function canon(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
}

function textAppearsIn(value: string, text: string): boolean {
  const needle = canon(value)
  if (!needle) return false
  const haystack = canon(text)
  if (haystack.includes(needle)) return true
  // Tolerate the model dropping a legal suffix or expanding one.
  const significant = needle.split(" ").filter((token) => token.length > 3)
  if (significant.length > 0 && significant.every((token) => haystack.includes(token))) {
    return true
  }
  return false
}

/** ISO 4217, three letters. */
function isCurrencyCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value)
}

/** Categories are inferred, never quoted, so verbatim is the wrong test. */
const CATEGORY_HINT = /\w/

export interface ConfidenceInput {
  extracted: Extracted
  sourceText: string
}

/**
 * Returns a 0..1 review-priority score per field. 1 means nothing about the
 * value contradicts anything else about the document; 0 means go look now.
 */
export function computeConfidence({ extracted, sourceText }: ConfidenceInput): ConfidenceScores {
  const text = sourceText ?? ""
  const scores: ConfidenceScores = {}

  for (const field of EXTRACTED_FIELDS) scores[field] = 0

  // --- verbatim and structure, field by field ------------------------------

  if (extracted.vendor) {
    scores.vendor = textAppearsIn(extracted.vendor, text) ? 1 : 0.55
  }

  if (extracted.invoiceNo) {
    // Invoice references are printed with separators the model may normalise.
    const printed = textAppearsIn(extracted.invoiceNo, text)
    const digitsMatch = /^\D*(\d{3,})/.exec(
      extracted.invoiceNo.replace(/[^\d]+/g, " ")
    )
    scores.invoiceNo = printed ? 1 : digitsMatch && text.includes(digitsMatch[1]) ? 0.85 : 0.5
  }

  for (const field of ["issueDate", "dueDate"] as const) {
    const value = extracted[field]
    if (!value) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      scores[field] = 0.3
    } else {
      scores[field] = dateAppearsIn(value, text) ? 1 : 0.5
    }
  }

  if (extracted.currency) {
    scores.currency = isCurrencyCode(extracted.currency)
      ? text.toUpperCase().includes(extracted.currency)
        ? 1
        : 0.85
      : 0.35
  }

  for (const field of ["subtotal", "tax", "total"] as const) {
    const value = extracted[field]
    if (value === null || value === undefined) continue
    scores[field] = numberAppearsIn(value, text) ? 1 : 0.45
  }

  if (extracted.category) {
    // Inferred from context, so the only check available is whether the
    // document carries enough signal to infer anything at all.
    const hasSignal = CATEGORY_HINT.test(extracted.vendor ?? "") || extracted.lineItems.length > 0
    scores.category = hasSignal ? 0.7 : 0.35
  }

  if (extracted.billable !== null && extracted.billable !== undefined) {
    const claims =
      /\b(billable|retainer|billed to client|pass(?:ed)? through|mark-?up)\b/i.test(text)
    scores.billable = extracted.billable === claims ? 0.9 : 0.4
  }

  if (extracted.lineItems.length > 0) {
    let cells = 0
    let correct = 0
    for (const item of extracted.lineItems) {
      cells++
      if (textAppearsIn(item.description ?? "", text)) correct++
      if (item.amount !== null && item.amount !== undefined) {
        cells++
        if (numberAppearsIn(item.amount, text)) correct++
      }
    }
    scores.lineItems = cells > 0 ? correct / cells : 0
  }

  // --- cross-field agreement ------------------------------------------------

  const { subtotal, tax, total } = extracted
  const moneyPresent = subtotal !== null || tax !== null || total !== null

  if (moneyPresent && subtotal !== null && total !== null) {
    const expected = subtotal + (tax ?? 0)
    const agrees = Math.abs(expected - total) <= Math.max(0.02, Math.abs(total) * 0.001)
    const penalty = agrees ? 1 : 0.55
    scores.subtotal = scores.subtotal * penalty
    scores.total = scores.total * penalty
    if (tax !== null) scores.tax = scores.tax * penalty
  }

  // A total that disagrees with the sum of its own line items is the single
  // most useful arithmetic signal a reviewer can be handed.
  const lineSum = extracted.lineItems.reduce(
    (sum, item) => sum + (typeof item.amount === "number" ? item.amount : 0),
    0
  )
  if (extracted.lineItems.length >= 2 && subtotal !== null) {
    const agrees = Math.abs(lineSum - subtotal) <= Math.max(0.05, Math.abs(subtotal) * 0.005)
    if (!agrees) {
      scores.subtotal = clamp01(scores.subtotal * 0.8)
      scores.lineItems = clamp01(scores.lineItems * 0.85)
    }
  }

  for (const field of EXTRACTED_FIELDS) {
    scores[field] = clamp01(scores[field] ?? 0)
  }

  return scores
}

/**
 * The single number a reviewer sorts by. Deliberately the *lowest* field score
 * on the row: a document is only as trustworthy as its weakest field, because
 * one wrong total makes the whole row wrong.
 */
export function worstFieldScore(scores: ConfidenceScores): number {
  const values = EXTRACTED_FIELDS.map((field) => scores[field] ?? 0)
  return values.length ? Math.min(...values) : 0
}

export type ConfidenceBand = "high" | "medium" | "low"

/**
 * Bands drive the visual treatment only. The number is always shown too —
 * colour never carries the meaning on its own (DESIGN.md §6.3).
 */
export function bandFor(score: number): ConfidenceBand {
  if (score >= 0.75) return "high"
  if (score >= 0.5) return "medium"
  return "low"
}

export const BAND_LABEL: Record<ConfidenceBand, string> = {
  high: "likely correct",
  medium: "worth a glance",
  low: "check this",
}