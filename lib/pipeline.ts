"use client"

/**
 * One document, end to end.
 *
 * The stages are the same three the accuracy study measures, which is the
 * point: the app is not a nicer wrapper around a model call, it is the harness
 * with a table bolted on. Anything the study reports about latency, OCR
 * fallback or validation repair is a fact about this function.
 */
import { computeConfidence } from "@/lib/confidence"
import { ingestFile } from "@/lib/ingest"
import { extractInvoice, type RuntimeName } from "@/lib/ollama"
import { redact, REDACTED_FIELDS } from "@/lib/redact"
import type { SpanStatus } from "@sentry/core"

import type { Extracted, Invoice } from "@/lib/schema"

export interface PipelineCallbacks {
  onStage?: (stage: string, ratio: number) => void
}

type SpanRunner = <R>(spanName: string, fn: () => Promise<R>) => Promise<R>

/** Sentry is optional at runtime; without it every span becomes a no-op. */
async function spanOrPassThrough<R>(name: string, fn: () => Promise<R>): Promise<R> {
  try {
    const sentry = await import("@sentry/nextjs")
    return await sentry.startSpan({ name, op: "ledger.stage" }, async () => fn())
  } catch {
    return fn()
  }
}

export interface ProcessedDocument {
  invoice: Invoice
  ms: number
  tokensIn: number
  tokensOut: number
  repaired: boolean
  redactions: Record<string, number> | null
}

function buildInvoice(
  id: string,
  sourceFile: string,
  value: Extracted,
  text: string,
  runtime: RuntimeName,
  model: string,
  ocrUsed: boolean,
  textLayer: boolean
): Invoice {
  return {
    id,
    sourceFile,
    ...value,
    confidences: computeConfidence({ extracted: value, sourceText: text }),
    provenance: { textLayer, ocrUsed, model, runtime },
    corrected: false,
  }
}

export async function processWithLocal(
  file: File,
  id: string,
  callbacks: PipelineCallbacks = {}
): Promise<ProcessedDocument> {
  callbacks.onStage?.("Reading document", 0.05)
  const ingest = await spanOrPassThrough("ingest.text-layer-or-ocr", () =>
    ingestFile(file, {
      onStage: (stage, ratio) => callbacks.onStage?.(`Reading document (${stage})`, ratio * 0.35),
    })
  )

  callbacks.onStage?.("Extracting fields", 0.4)
  const extraction = await spanOrPassThrough("llm.extract.gemma3-4b", () =>
    extractInvoice(ingest.text, {
      onAttempt: (attempt) =>
        callbacks.onStage?.(
          attempt > 1 ? "Extracting fields (repairing schema violation)" : "Extracting fields",
          0.4
        ),
    })
  )

  callbacks.onStage?.("Scoring confidence", 0.95)
  const invoice = await spanOrPassThrough("validate.confidence", async () =>
    buildInvoice(
      id,
      file.name,
      extraction.value,
      ingest.text,
      "local",
      "gemma3:4b",
      ingest.ocrUsed,
      ingest.textLayer
    )
  )

  return {
    invoice,
    ms: extraction.durationMs,
    tokensIn: extraction.tokensIn,
    tokensOut: extraction.tokensOut,
    repaired: extraction.repaired,
    redactions: null,
  }
}

export async function processWithHosted(
  file: File,
  id: string,
  callbacks: PipelineCallbacks = {}
): Promise<ProcessedDocument> {
  callbacks.onStage?.("Reading document", 0.05)
  const ingest = await spanOrPassThrough("ingest.text-layer-or-ocr", () =>
    ingestFile(file, {
      onStage: (stage, ratio) => callbacks.onStage?.(`Reading document (${stage})`, ratio * 0.3),
    })
  )

  // Redaction happens twice on purpose: here so the banner's claim is literally
  // true for what leaves the browser, and again in the route handler so the
  // guarantee holds for any other caller.
  const redacted = redact(ingest.text)

  callbacks.onStage?.("Sending redacted text", 0.4)
  const payload = await spanOrPassThrough("llm.extract.hosted", async () => {
    const response = await fetch("/api/extract", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: redacted.text, alreadyRedacted: true }),
    })

    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      const error = new Error(body.error ?? `The hosted path failed with status ${response.status}`)
      Object.assign(error, { code: body.code, retryable: body.retryable })
      throw error
    }

    return response.json() as Promise<{
      value: Extracted
      tokensIn: number
      tokensOut: number
      durationMs: number
      provider: string
      redaction: Record<string, number>
    }>
  })

  // Whatever redaction removed is now genuinely unextractable. Say so in the
  // data rather than leaving a null the reviewer has to interpret.
  const value: Extracted = { ...payload.value }
  for (const field of REDACTED_FIELDS) {
    if (redacted.counts && redacted.counts.organisation > 0) {
      ;(value as unknown as Record<string, unknown>)[field] = null
    }
  }

  callbacks.onStage?.("Scoring confidence", 0.95)
  const invoice = buildInvoice(
    id,
    file.name,
    value,
    ingest.text,
    "hosted",
    payload.provider ?? "hosted",
    ingest.ocrUsed,
    ingest.textLayer
  )

  return {
    invoice,
    ms: payload.durationMs ?? 0,
    tokensIn: payload.tokensIn ?? 0,
    tokensOut: payload.tokensOut ?? 0,
    repaired: false,
    redactions: payload.redaction ?? redacted.counts,
  }
}

/**
 * One transaction per document (FR-12), tagged with the runtime and the model.
 * Tag values are metadata only: no document text, no client names, no amounts.
 */
export async function traced<T>(
  name: string,
  documentName: string,
  run: (span: SpanRunner) => Promise<T>,
  tags: Record<string, string | number> = {}
): Promise<T> {
  const sentry = await import("@sentry/nextjs")

  return sentry.startSpan(
    {
      name,
      op: "ledger.extract",
      attributes: { "document": documentName, ...tags },
    },
    async (span) => {
      const wrapped: SpanRunner = (spanName, fn) =>
        sentry.startSpan(
          { name: spanName, op: "ledger.stage", parentSpan: span },
          async () => fn()
        )
      try {
        return await run(wrapped)
      } catch (error) {
        span?.setStatus("internal_error" as unknown as SpanStatus)
        throw error
      } finally {
        span?.end()
      }
    }
  )
}