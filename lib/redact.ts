/**
 * Best-effort redaction, applied to document text before it leaves the device
 * (ADR-016, FR-17).
 *
 * This is obfuscation, not anonymisation, and the UI says so. It is the second
 * layer beneath OpenRouter's `data_collection: "deny"` routing rule, not a
 * replacement for it: the routing rule decides which endpoints are eligible,
 * this decides what the eligible endpoint is asked to read.
 *
 * It runs on the hosted path only. In local mode nothing leaves, so nothing is
 * redacted and the extractor sees the document intact.
 */

export interface RedactionReport {
  text: string
  /** How many substitutions of each kind were made. */
  counts: Record<string, number>
  /** True when nothing was redacted — surfaced in the UI, not hidden. */
  clean: boolean
}

/**
 * Organisation names that appear next to one of these phrases are the party
 * the invoice is about, which for a freelancer is usually a client.
 *
 * English, German, French and Spanish are covered because those are the
 * locales in the fixture set; the trigger-phrase approach generalises to
 * whatever is listed here rather than to every language.
 */
const ORG_CONTEXT = [
  "invoice from",
  "invoiced from",
  "bill to",
  "billed to",
  "sold by",
  "sold from",
  "sold to",
  "vendor",
  "supplier",
  "service provider",
  "issued by",
  "from",
  "dienstleister",
  "rechnungsteller",
  "anbieter",
  "lieferant",
  "kunde",
  "facture de",
  "fournisseur",
  "emetteur",
  "facturado por",
  "proveedor",
]

/** Matches a line that begins with a context phrase plus an organisation name. */
const ORG_LINE = new RegExp(
  `^([ \\t]*(?:${ORG_CONTEXT.map((phrase) => phrase.replace(/ /g, "\\s+")).join("|")})[ \\t]*[:\\-]?[ \\t]*)([A-Z0-9][^\\n]{1,60})$`,
  "gim"
)

/** IBAN: two letters, two check digits, then grouped alphanumerics. */
const IBAN = /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{2,4}){3,8}\b/g

/** Card-like runs, with or without separators. */
const CARD = /\b(?:\d[ -]?){13,19}\b/g

/**
 * A bare run of eight or more digits with no decimal point in sight. Invoice
 * references carry separators or letters and survive; a consumer number, an
 * account number and a meter reading do not.
 */
const LONG_DIGIT_RUN = /(?<![\d.,-])\d{8,}(?![\d.,])/g

const EMAIL = /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g

const PHONE = /(?:\+\d{1,3}[\s-]?)?(?:\(\d{2,4}\)[\s-]?)?\d{3,4}[\s-]\d{3,4}(?:[\s-]\d{2,4})?/g

export function redact(text: string): RedactionReport {
  const counts: Record<string, number> = {
    organisation: 0,
    iban: 0,
    card: 0,
    longDigits: 0,
    email: 0,
    phone: 0,
  }

  let out = text

  out = out.replace(ORG_LINE, (_match, prefix: string) => {
    counts.organisation++
    return `${prefix}[CLIENT REDACTED]`
  })

  out = out.replace(IBAN, () => {
    counts.iban++
    return "[ACCOUNT REDACTED]"
  })

  out = out.replace(EMAIL, () => {
    counts.email++
    return "[EMAIL REDACTED]"
  })

  out = out.replace(PHONE, () => {
    counts.phone++
    return "[PHONE REDACTED]"
  })

  out = out.replace(CARD, () => {
    counts.card++
    return "[ACCOUNT REDACTED]"
  })

  out = out.replace(LONG_DIGIT_RUN, () => {
    counts.longDigits++
    return "[ACCOUNT REDACTED]"
  })

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return { text: out, counts, clean: total === 0 }
}

/**
 * Fields that redaction makes deliberately unextractable on the hosted path.
 *
 * The vendor name is what the pass exists to remove, so a hosted run returns a
 * redacted vendor by design rather than by failure. Surfacing that honestly is
 * the difference between a privacy control and a bug report.
 */
export const REDACTED_FIELDS = ["vendor"] as const