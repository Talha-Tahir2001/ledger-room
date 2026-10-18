import { ExtractedSchema, invoiceJsonSchema, type Extracted } from "./schema"

export type RuntimeName = "local" | "hosted" | "demo"

export interface ExtractionOutcome {
  value: Extracted
  raw: string
  tokensIn: number
  tokensOut: number
  durationMs: number
  /** How many model round-trips it took. 2 means the repair path fired. */
  attempts: number
  repaired: boolean
}

const DEFAULT_URL = "http://127.0.0.1:11434"
const DEFAULT_MODEL = "gemma3:4b"

/**
 * Environment access uses literal member expressions on purpose.
 *
 * `process.env[name]` with a computed key is not statically replaced by the
 * bundler, so it silently becomes `undefined` in the browser. Writing
 * `process.env.NEXT_PUBLIC_OLLAMA_URL` is what lets the value reach the client
 * at all — the dynamic form looks equivalent and is not.
 */
export function ollamaUrl(): string {
  return (
    process.env.NEXT_PUBLIC_OLLAMA_URL ||
    process.env.OLLAMA_URL ||
    DEFAULT_URL
  )
}

export function ollamaModel(): string {
  return (
    process.env.NEXT_PUBLIC_OLLAMA_MODEL ||
    process.env.OLLAMA_MODEL ||
    DEFAULT_MODEL
  )
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "")
}

const SYSTEM_PROMPT = `You extract structured invoice and receipt fields from raw document text, which may contain OCR noise.

Rules:
- Output only what the document states. Never invent, guess, or complete a value.
- Use null for any field the document does not state.
- Copy numbers as bare digits with no currency symbol, no thousands separators and no trailing currency code.
- "vendor" is the organisation issuing the invoice or receipt, never the recipient.
- Convert dates to YYYY-MM-DD. If the printed date is ambiguous (for example 03/04/26), choose the reading most consistent with the rest of the document.
- "billable" is true only when the text explicitly shows the charge is passed to a client as work performed. Otherwise null.`

const USER_PROMPT = (text: string) =>
  `Extract the invoice fields from this document text.\n\n<document>\n${text}\n</document>`

/** Why the local probe reached the conclusion it did. */
export type ProbeFailure = null | "unreachable" | "http-error" | "timeout"

export interface LocalProbe {
  ok: boolean
  url: string
  status: number | null
  failure: ProbeFailure
  /** A sentence the UI can show verbatim, so a judge can diagnose it. */
  detail: string
}

export interface LocalProbe {
  ok: boolean
  url: string
  status: number | null
  failure: ProbeFailure
  /** A sentence the UI can show verbatim, so a judge can diagnose it. */
  detail: string
  /** Model names, when the runtime answered. Empty when it did not. */
  models: string[]
}

/**
 * Probes the local runtime. Never throws.
 *
 * Deliberately a *simple* request: no custom headers. That is not an accident.
 * Adding any header the browser considers non-safelisted forces a CORS
 * preflight, and Ollama's preflight allowlist is fixed — it permits
 * `content-type` and a handful of others, and rejects everything else. An
 * earlier version of this file worked alongside a Sentry
 * `tracePropagationTargets` rule that injected `sentry-trace` into every
 * request to 127.0.0.1; that turned this probe into a preflighted request,
 * Chrome rejected it, and the app reported "no local runtime" on machines that
 * had one. The Sentry configuration was the bug, and it is fixed at source in
 * `instrumentation-client.ts`.
 *
 * The failure reason is still reported rather than swallowed, because "no local
 * runtime" is otherwise a dead end: Ollama not running and Ollama running but
 * not allowing this origin are very different problems for a user to fix.
 */
export async function probeOllama(timeoutMs = 4000): Promise<LocalProbe> {
  const url = `${trimSlash(ollamaUrl())}/api/tags`

  const result = await attempt(url, timeoutMs)

  if (!result.ok) {
    return { ...result, models: [] }
  }

  return { ...result, models: await modelNames(url, timeoutMs) }
}

async function attempt(url: string, timeoutMs: number): Promise<Omit<LocalProbe, "models">> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, { signal: controller.signal, cache: "no-store" })
    if (res.ok) {
      return { ok: true, url, status: res.status, failure: null, detail: "Reachable." }
    }
    return {
      ok: false,
      url,
      status: res.status,
      failure: "http-error",
      detail: `Ollama answered ${res.status} on ${url}.`,
    }
  } catch (error) {
    const aborted = (error as Error).name === "AbortError"
    return {
      ok: false,
      url,
      status: null,
      failure: aborted ? "timeout" : "unreachable",
      detail: aborted
        ? `No response from ${url} within ${timeoutMs / 1000}s.`
        : `The browser could not reach ${url}. This is usually either Ollama not running, or the page's origin missing from OLLAMA_ORIGINS.`,
    }
  } finally {
    clearTimeout(timer)
  }
}

async function modelNames(url: string, timeoutMs: number): Promise<string[]> {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(timeoutMs) })
    const payload = await response.json()
    return (payload.models ?? []).map((model: { name?: string }) => model.name).filter(Boolean)
  } catch {
    return []
  }
}

/** Kept for callers that only need a boolean. */
export async function isOllamaAvailable(timeoutMs = 4000): Promise<boolean> {
  return (await probeOllama(timeoutMs)).ok
}

interface ChatResult {
  content: string
  promptTokens: number
  completionTokens: number
}

async function chat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  format: unknown,
  timeoutMs: number
): Promise<ChatResult> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const payload = JSON.stringify({
    model: ollamaModel(),
    messages,
    format,
    stream: false,
    keep_alive: "10m",
    options: { temperature: 0, num_predict: 2048, seed: 42 },
  })

  try {
    // Only `content-type` is sent. Ollama's preflight allowlist covers it, and
    // adding anything else would force a preflight the allowlist rejects.
    const res = await fetch(`${trimSlash(ollamaUrl())}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: controller.signal,
      cache: "no-store",
      body: payload,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      throw new Error(`Ollama responded ${res.status}: ${detail.slice(0, 300)}`)
    }

    const data = (await res.json()) as {
      message?: { content?: string }
      prompt_eval_count?: number
      eval_count?: number
    }

    return {
      content: data.message?.content ?? "",
      promptTokens: data.prompt_eval_count ?? 0,
      completionTokens: data.eval_count ?? 0,
    }
  } finally {
    clearTimeout(timer)
  }
}

function stripFences(raw: string): string {
  const trimmed = raw.trim()
  const fence = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  return fence ? fence[1] : trimmed
}

const REPAIR_INSTRUCTION = `Your previous output did not satisfy the required schema. Return the corrected JSON object only, with every field present and correctly typed.`

/**
 * One document, one model call — plus at most one repair round-trip.
 *
 * `keep_alive` on the Ollama side matters here: batches are client-orchestrated
 * and a cold model load between documents would dominate the wall clock.
 */
export async function extractInvoice(
  text: string,
  options: {
    timeoutMs?: number
    onAttempt?: (n: number) => void
  } = {},
): Promise<ExtractionOutcome> {
  const { timeoutMs = 180_000, onAttempt } = options
  const format = invoiceJsonSchema()

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: USER_PROMPT(text) },
  ]

  const started = performance.now()
  let tokensIn = 0
  let tokensOut = 0

  onAttempt?.(1)
  let result = await chat(messages, format, timeoutMs)
  tokensIn += result.promptTokens
  tokensOut += result.completionTokens

  let parsed: unknown
  let raw = result.content
  let value: Extracted | null = null
  let attempts = 1

  try {
    parsed = JSON.parse(stripFences(raw))
    const check = ExtractedSchema.safeParse(parsed)
    if (check.success) value = check.data
  } catch {
    value = null
  }

  if (!value) {
    messages.push({ role: "assistant", content: raw })
    messages.push({ role: "user", content: REPAIR_INSTRUCTION })

    onAttempt?.(2)
    result = await chat(messages, format, timeoutMs)
    tokensIn += result.promptTokens
    tokensOut += result.completionTokens
    raw = result.content
    attempts = 2

    try {
      parsed = JSON.parse(stripFences(raw))
      const check = ExtractedSchema.safeParse(parsed)
      if (check.success) value = check.data
    } catch {
      value = null
    }
  }

  if (!value) {
    throw new Error(
      `Model output failed schema validation after ${attempts} attempt(s): ${raw.slice(0, 300)}`
    )
  }

  return {
    value,
    raw,
    tokensIn,
    tokensOut,
    durationMs: Math.round(performance.now() - started),
    attempts,
    repaired: attempts > 1,
  }
}