/**
 * The hosted path (ADR-014). OpenRouter is a gateway, not the provider.
 *
 * Two request fields turn the privacy property into something the request
 * enforces rather than something the UI promises:
 *
 *   provider.data_collection: "deny"   never eligible to route to a logger
 *   require_parameters: true           only endpoints honouring response_format
 *
 * If no compliant endpoint exists the request fails. It does not fall back to
 * something that logs. A privacy control that degrades quietly is not a privacy
 * control.
 *
 * This module is server-side only. `OPENROUTER_API_KEY` must never be
 * `NEXT_PUBLIC_`, and the route handler that calls this is the only caller.
 */
import { ExtractedSchema, invoiceJsonSchema, type Extracted } from "./schema"

const BASE_URL = process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1"
const MODEL = process.env.OPENROUTER_HOSTED_MODEL ?? "google/gemma-4-31b-it:free"

export class HostedUnavailableError extends Error {
  readonly retryAfterSeconds: number | null
  constructor(message: string, retryAfterSeconds: number | null = null) {
    super(message)
    this.name = "HostedUnavailableError"
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class QuotaExhaustedError extends Error {
  constructor(message = "The hosted path's daily allowance is spent. It resets at midnight UTC.") {
    super(message)
    this.name = "QuotaExhaustedError"
  }
}

export function hostedConfigured(): boolean {
  const enabled = (process.env.ENABLE_HOSTED_MODE ?? "false").toLowerCase() === "true"
  return enabled && Boolean(process.env.OPENROUTER_API_KEY)
}

export interface HostedOutcome {
  value: Extracted
  raw: string
  tokensIn: number
  tokensOut: number
  durationMs: number
  provider: string | null
}

const SYSTEM_PROMPT = `You extract structured invoice and receipt fields from raw document text, which may contain OCR noise.

Rules:
- Output only what the document states. Never invent, guess, or complete a value.
- Use null for any field the document does not state.
- Copy numbers as bare digits with no currency symbol, no thousands separators and no trailing currency code.
- "vendor" is the organisation issuing the invoice or receipt, never the recipient. A value reading [CLIENT REDACTED] was removed before this request; report it as null.
- Convert dates to YYYY-MM-DD.
- "billable" is true only when the text explicitly shows the charge is passed to a client as work performed. Otherwise null.`

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Exponential backoff with jitter. Upstream 429s from the free tier are a
 * provider-side saturation signal, not an account limit, so waiting does not
 * always help — hence a bounded number of attempts and a distinct `unavailable`
 * outcome rather than an error that looks like a model failure.
 */
export async function callHosted(
  text: string,
  options: { timeoutMs?: number; attempts?: number } = {}
): Promise<HostedOutcome> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new HostedUnavailableError("No hosted provider key is configured.")

  const { timeoutMs = 90_000, attempts = 4 } = options
  let lastError: Error = new HostedUnavailableError("No attempt was made.")

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    const started = Date.now()

    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `<document>\n${text}\n</document>` },
          ],
          temperature: 0,
          provider: { data_collection: "deny" },
          require_parameters: true,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "invoice",
              strict: true,
              schema: invoiceJsonSchema(),
            },
          },
        }),
      })

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after"))
        const body = await res.text().catch(() => "")
        const quotaSpent = /credits|balance|purchase|limits:credit/i.test(body)
        if (quotaSpent) throw new QuotaExhaustedError()
        lastError = new HostedUnavailableError(
          "The hosted provider is rate limited upstream.",
          Number.isFinite(retryAfter) ? retryAfter : null
        )
        if (attempt === attempts) break
        // Capped at ~30s total across four attempts.
        const backoff = Math.min(8000, 500 * 2 ** (attempt - 1))
        await sleep(backoff + Math.random() * 250)
        continue
      }

      if (!res.ok) {
        const body = await res.text().catch(() => "")
        throw new HostedUnavailableError(
          `Hosted provider responded ${res.status}: ${body.slice(0, 200)}`
        )
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[]
        usage?: { prompt_tokens?: number; completion_tokens?: number }
      }

      const raw = data.choices?.[0]?.message?.content ?? ""
      const parsed = ExtractedSchema.safeParse(JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim()))
      if (!parsed.success) {
        throw new HostedUnavailableError(
          `Hosted output failed schema validation: ${raw.slice(0, 200)}`
        )
      }

      return {
        value: parsed.data,
        raw,
        tokensIn: data.usage?.prompt_tokens ?? 0,
        tokensOut: data.usage?.completion_tokens ?? 0,
        durationMs: Date.now() - started,
        provider: MODEL,
      }
    } catch (error) {
      if (error instanceof QuotaExhaustedError) throw error
      if (error instanceof HostedUnavailableError) {
        lastError = error
        if (attempt === attempts) break
        const backoff = Math.min(8000, 500 * 2 ** (attempt - 1))
        await sleep(backoff + Math.random() * 250)
        continue
      }
      lastError = error as Error
      if (attempt === attempts) break
      await sleep(500 * 2 ** (attempt - 1))
    } finally {
      clearTimeout(timer)
    }
  }

  throw lastError
}