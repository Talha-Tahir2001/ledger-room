/**
 * Runtime detection, server half.
 *
 * The client half matters and is easy to get wrong: whether a local Ollama is
 * reachable is a fact about the *user's* machine, and the deployed server has no
 * way to learn it. Probing from Vercel would report "local unavailable" on every
 * user's machine that does have one. So the browser probes 127.0.0.1 itself, and
 * this route only answers what the server actually knows: whether the hosted
 * path is configured, and how much of its shared daily allowance is left.
 *
 * See ARCHITECTURE.md §3.
 */
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const DAILY_ALLOWANCE = Number(process.env.HOSTED_DAILY_ALLOWANCE ?? 50)

/**
 * A day counter, deliberately the simplest thing that works.
 *
 * A file in the deployment is not writable on Vercel, so this is in-memory and
 * resets whenever the instance recycles. That makes it a lower bound on
 * remaining budget rather than an authoritative one, and the UI says "at least
 * N" rather than "N". An honest weak signal beats a precise wrong one.
 */
const usage = new Map<string, number>()

function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

function remainingForToday(): number {
  const day = utcDay()
  const used = usage.get(day) ?? 0
  return Math.max(0, DAILY_ALLOWANCE - used)
}

export function recordHostedRequest(): void {
  const day = utcDay()
  usage.set(day, (usage.get(day) ?? 0) + 1)
}

function resetAt(): string {
  const next = new Date()
  next.setUTCHours(24, 0, 0, 0)
  return next.toISOString()
}

export async function GET() {
  const configured =
    (process.env.ENABLE_HOSTED_MODE ?? "false").toLowerCase() === "true" &&
    Boolean(process.env.OPENROUTER_API_KEY)

  return NextResponse.json(
    {
      hosted: {
        configured,
        provider: process.env.OPENROUTER_HOSTED_MODEL ?? "google/gemma-4-31b-it:free",
        /** Best-effort. The allowance is shared by everyone using this deployment. */
        dailyAllowance: DAILY_ALLOWANCE,
        remainingToday: remainingForToday(),
        remainingIsEstimate: true,
        resetsAt: resetAt(),
        /** The routing rule that makes the hosted path worth offering at all. */
        dataCollection: "deny",
        requiresExplicitConsent: true,
      },
      demo: {
        available: true,
        note: "Pre-computed results for the fixture set. Labelled as demo data, never as inference.",
      },
    },
    {
      headers: {
        // Runtime state must never be cached by a CDN sitting in front of this.
        "cache-control": "no-store",
      },
    }
  )
}