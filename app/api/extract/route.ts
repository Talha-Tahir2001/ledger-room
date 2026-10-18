/**
 * The hosted extraction path (ADR-014, ADR-015).
 *
 * One document per invocation, because Vercel Hobby functions cap at 300s and
 * a batch would blow straight through it. This is also why the client drives
 * batches: it means no request is ever long enough to time out, and the
 * progress queue can show honest per-document state.
 *
 * The redaction happens here, server-side, as a second pass. The client also
 * redacts before sending, so the raw text has already left the browser by the
 * time it arrives — running it again server-side is what keeps the guarantee
 * true for any caller that did not.
 */
import { NextResponse } from "next/server"

import { redact } from "@/lib/redact"
import { callHosted, HostedUnavailableError, QuotaExhaustedError } from "@/lib/openrouter"
import { recordHostedRequest } from "@/app/api/health/route"

export const dynamic = "force-dynamic"
export const maxDuration = 120

interface ExtractRequest {
  text?: unknown
  /** Set false only by the eval harness, which runs its own redaction. */
  alreadyRedacted?: unknown
}

export async function POST(request: Request) {
  const enabled = (process.env.ENABLE_HOSTED_MODE ?? "false").toLowerCase() === "true"
  if (!enabled || !process.env.OPENROUTER_API_KEY) {
    return NextResponse.json(
      {
        error: "The hosted path is not enabled on this deployment.",
        code: "hosted_disabled",
      },
      { status: 503 }
    )
  }

  let payload: ExtractRequest
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body.", code: "bad_request" }, { status: 400 })
  }

  if (typeof payload.text !== "string" || payload.text.trim().length === 0) {
    return NextResponse.json(
      { error: "A non-empty `text` field is required.", code: "bad_request" },
      { status: 400 }
    )
  }

  const alreadyRedacted = payload.alreadyRedacted === true
  const redacted = alreadyRedacted
    ? { text: payload.text, counts: null, clean: false }
    : redact(payload.text)

  try {
    recordHostedRequest()
    const outcome = await callHosted(redacted.text)
    return NextResponse.json({
      value: outcome.value,
      tokensIn: outcome.tokensIn,
      tokensOut: outcome.tokensOut,
      durationMs: outcome.durationMs,
      provider: outcome.provider,
      redaction: redacted.counts,
    })
  } catch (error) {
    if (error instanceof QuotaExhaustedError) {
      // Explicitly non-retryable. Retrying cannot create quota.
      return NextResponse.json(
        {
          error: error.message,
          code: "quota_exhausted",
          retryable: false,
          resetsAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
        },
        { status: 429 }
      )
    }

    if (error instanceof HostedUnavailableError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "hosted_unavailable",
          retryable: true,
          retryAfterSeconds: error.retryAfterSeconds ?? null,
        },
        { status: 503, headers: { "retry-after": String(error.retryAfterSeconds ?? 30) } }
      )
    }

    return NextResponse.json(
      { error: "The hosted path failed unexpectedly.", code: "hosted_error" },
      { status: 500 }
    )
  }
}