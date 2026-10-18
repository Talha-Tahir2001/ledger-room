import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Reads the committed measurement files so the landing page renders the actual
 * study rather than a summary of it.
 *
 * A missing file, or a missing value inside one, resolves to `null` — which the
 * UI renders as *pending*. That distinction is the point. Showing a zero, or a
 * dash that reads as "nothing to report", would let a gap in the study pass as
 * a result, and the whole credibility of the page rests on gaps looking like
 * gaps (DESIGN.md §8.2).
 *
 * The page is statically prerendered, so the numbers on the deployed site are
 * the numbers in the committed `results/`. They cannot drift from the run.
 */

export interface StudyMetrics {
  n: number
  fieldAccuracy: number
  exactRecordRate: number
  p50LatencyMs: number
  p95LatencyMs: number
  documentsPerHour: number
  tokensInMean: number
  tokensOutMean: number
  repairs: number
  perFieldAccuracy: Record<string, number>
  lineItemAccuracy: number | null
  populatedRecall: number | null
  costUsd: number
}

export interface StudyArm {
  arm: string
  headline: StudyMetrics | null
}

export interface ChaseStudy {
  model: string
  rowsPaid: number
  clients: number
  featuresPerRow: number
  holdout: { trained: number; scored: number }
  metrics: {
    tabpfn: { mae: number }
    clientMean: { mae: number }
    globalMean: { mae: number }
  }
  coverage: { inside: number; total: number; meanWidthDays: number }
  tabpfnWins: boolean
}

const RESULTS = join(process.cwd(), "results")

function readJson<T>(name: string): T | null {
  const path = join(RESULTS, name)
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T
  } catch {
    return null
  }
}

export interface ArmFile {
  arm?: string
  headline?: StudyMetrics | null
}

export function readArm(arm: string): StudyArm {
  const result = readJson<ArmFile>(arm)
  return { arm: result?.arm ?? arm, headline: result?.headline ?? null }
}

export function readChaseStudy(): ChaseStudy | null {
  return readJson<ChaseStudy>("tabpfn.json")
}

/** The hosted arm was not run, and the page says so rather than omitting it. */
export function readHostedArm(): { ran: boolean; reason: string } {
  const result = readJson<ArmFile>("eval-hosted.json")
  if (!result) {
    return {
      ran: false,
      reason:
        "Not run. The free OpenRouter tier allows 50 requests per day and the local arms produce the headline numbers without touching that allowance.",
    }
  }
  return { ran: true, reason: "" }
}
