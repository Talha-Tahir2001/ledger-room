/**
 * Sentry initialisation (FR-12).
 *
 * Metadata only. Model name, token counts, latency, stage names, runtime. Never
 * document text, never a client name, never an amount — see PRIVACY.md §2. The
 * `beforeSend` scrub below is the mechanism, not a promise: it walks the event
 * and drops anything that looks like it came from a document.
 */

/** Keys that would carry user content if a span were ever tagged wrong. */
const FORBIDDEN_KEYS = new Set([
  "text",
  "document",
  "document_text",
  "source_text",
  "prompt",
  "completion",
  "vendor",
  "client",
  "client_name",
  "amount",
  "total",
  "invoiceNo",
  "invoice_no",
  "raw",
  "body",
])

function scrub(value: unknown, depth = 0): unknown {
  if (depth > 6 || value === null || typeof value !== "object") return value

  if (Array.isArray(value)) return value.slice(0, 20).map((entry) => scrub(entry, depth + 1))

  const output: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key)) continue
    output[key] = typeof entry === "string" && entry.length > 200 ? `${entry.slice(0, 200)}…` : scrub(entry, depth + 1)
  }
  return output
}

export async function register(): Promise<void> {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (!dsn) return

  const Sentry = await import("@sentry/nextjs")

  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 1),
    environment: process.env.NODE_ENV,
    // No session replay. A replay of this app would be a recording of someone's
    // invoices, which is the exact thing the product promises never to store.
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    beforeSend(event) {
      return scrub(event) as typeof event
    },
    beforeSendTransaction(event) {
      return scrub(event) as typeof event
    },
  })
}