/**
 * The accuracy harness (EVAL.md Â§2).
 *
 *   npm run eval -- --model gemma3:4b --out results/eval-4b.json
 *   npm run eval -- --model openrouter-gemma-4-31b --out results/eval-hosted.json
 *
 * Every response is cached to results/cache/ keyed by
 * sha256(fixtureText + modelId + schemaHash), so a repeated run costs nothing
 * and stays deterministic. The hosted arm consumes a shared 50-request/day
 * allowance, which is exactly why the cache exists.
 */
import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { extractInvoice } from "../lib/ollama"
import { callHosted, HostedUnavailableError } from "../lib/openrouter"
import { redact } from "../lib/redact"
import { schemaHash, type Extracted } from "../lib/schema"
import { SCALAR_FIELDS, scoreRecord, type FieldName, type Truth } from "../lib/score"

const FIXTURES_DIR = join(process.cwd(), "fixtures", "invoices")
const CACHE_DIR = join(process.cwd(), "results", "cache")

const LOCAL_ARMS = new Set(["gemma3:4b", "gemma3:1b"])
const HOSTED_ARM = "openrouter-gemma-4-31b"

interface CachedResponse {
  value: Extracted
  raw: string
  tokensIn: number
  tokensOut: number
  durationMs: number
  attempts: number
}

function parseArgs() {
  const args = process.argv.slice(2)
  const get = (name: string, fallback: string) => {
    const index = args.indexOf(`--${name}`)
    return index >= 0 && args[index + 1] ? args[index + 1] : fallback
  }
  return {
    model: get("model", "gemma3:4b"),
    out: get("out", `results/eval-${get("model", "gemma3:4b")}.json`),
    only: get("only", ""),
    noCache: args.includes("--no-cache"),
    redactHosted: !args.includes("--no-redact"),
  }
}

function cacheKey(text: string, model: string): string {
  return createHash("sha256")
    .update(`${text}|${model}|${schemaHash()}`)
    .digest("hex")
    .slice(0, 32)
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)
  return sorted[Math.max(0, index)]
}

async function main() {
  const options = parseArgs()
  const { model } = options
  const isHosted = model === HOSTED_ARM

  if (!isHosted && !LOCAL_ARMS.has(model)) {
    console.error(
      `Unknown model "${model}". Use one of: ${[...LOCAL_ARMS].join(", ")}, ${HOSTED_ARM}`
    )
    process.exit(1)
  }

  // Local arms select the Ollama model through the environment, matching the
  // app rather than inventing a second code path the app would not use.
  if (!isHosted) process.env.NEXT_PUBLIC_OLLAMA_MODEL = model

  mkdirSync(CACHE_DIR, { recursive: true })
  mkdirSync(join(process.cwd(), "results"), { recursive: true })

  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "fixtures", "manifest.json"), "utf8")
  )

  let fixtures = manifest.fixtures as any[]
  if (options.only) {
    const wanted = new Set(options.only.split(",").map((id) => id.trim()))
    fixtures = fixtures.filter((entry) => wanted.has(entry.id))
  }

  console.log(`arm: ${model}`)
  console.log(`schema hash: ${schemaHash()}`)
  console.log(`fixtures: ${fixtures.length}`)
  if (isHosted && options.redactHosted) console.log("hosted arm: redacting before send (ADR-016)\n")

  const records: any[] = []
  const startedAt = new Date().toISOString()

  for (const [index, entry] of fixtures.entries()) {
    const text = readFileSync(join(FIXTURES_DIR, entry.text), "utf8")
    const truth = JSON.parse(readFileSync(join(FIXTURES_DIR, entry.truth), "utf8")) as Truth
    const acceptable = entry.acceptable ?? {}

    const key = cacheKey(text, model)
    const cachePath = join(CACHE_DIR, `${key}.json`)

    let value: Extracted | undefined
    let tokensIn = 0
    let tokensOut = 0
    let durationMs = 0
    let attempts = 0
    let fromCache = false
    let outcome = "ok"
    let note: string | null = null
    let redactionCounts: Record<string, number> | null = null

    if (!options.noCache && existsSync(cachePath)) {
      const cached = JSON.parse(readFileSync(cachePath, "utf8")) as CachedResponse
      value = cached.value
      tokensIn = cached.tokensIn
      tokensOut = cached.tokensOut
      durationMs = cached.durationMs
      attempts = cached.attempts
      fromCache = true
    } else {
      try {
        if (isHosted) {
          const redacted = options.redactHosted ? redact(text) : { text, counts: null, clean: true }
          redactionCounts = redacted.counts
          const outcomeHosted = await callHosted(redacted.text)
          value = outcomeHosted.value
          tokensIn = outcomeHosted.tokensIn
          tokensOut = outcomeHosted.tokensOut
          durationMs = outcomeHosted.durationMs
          attempts = 1
        } else {
          const outcomeLocal = await extractInvoice(text)
          value = outcomeLocal.value
          tokensIn = outcomeLocal.tokensIn
          tokensOut = outcomeLocal.tokensOut
          durationMs = outcomeLocal.durationMs
          attempts = outcomeLocal.attempts
        }

        writeFileSync(
          cachePath,
          JSON.stringify({ value, raw: "", tokensIn, tokensOut, durationMs, attempts }, null, 2)
        )
      } catch (error) {
        if (error instanceof HostedUnavailableError) {
          outcome = "unavailable"
          note = error.message
        } else {
          outcome = "failed"
          note = (error as Error).message
        }
      }
    }

    if (outcome === "ok" && value) {
      const score = scoreRecord(value, truth, acceptable)
      records.push({
        id: entry.id,
        name: entry.name,
        medium: entry.medium,
        mess: entry.mess,
        ambiguous: entry.ambiguous,
        outcome,
        fromCache,
        tokensIn,
        tokensOut,
        durationMs,
        attempts,
        redactionCounts,
        score,
        predicted: value,
      })

      const wrong = SCALAR_FIELDS.filter((field) => !score.fields[field].correct)
      const linePct =
        score.lineItems.totalCells > 0
          ? Math.round((score.lineItems.correctCells / score.lineItems.totalCells) * 100)
          : null

      console.log(
        `[${String(index + 1).padStart(2)}/${fixtures.length}] ${entry.id.padEnd(28)} ` +
          `${score.cellsCorrect}/${score.cellsTotal} ` +
          `(${(score.cellsCorrect / score.cellsTotal * 100).toFixed(0)}%) ` +
          `lines=${linePct === null ? "n/a" : linePct + "%"} ` +
          `${(durationMs / 1000).toFixed(1)}s${fromCache ? " [cache]" : ""}`
      )
      if (wrong.length) console.log(`      missed: ${wrong.join(", ")}`)
    } else {
      records.push({ id: entry.id, name: entry.name, outcome, note, fromCache })
      // A missing measurement is not a model failure. It is excluded from the
      // denominator and reported as an exclusion, never as a zero.
      console.log(`[${String(index + 1).padStart(2)}/${fixtures.length}] ${entry.id.padEnd(28)} ${outcome.toUpperCase()}: ${note}`)
    }
  }

  // --- aggregate ------------------------------------------------------------

  const scored = records.filter((record) => record.outcome === "ok")
  const ambiguousScored = scored.filter((record) => record.ambiguous)
  const headline = scored.filter((record) => !record.ambiguous)

  const aggregate = (subset: any[]) => {
    if (subset.length === 0) return null

    const durations = subset.map((r) => r.durationMs).sort((a, b) => a - b)
    const cellsTotal = subset.reduce((sum, r) => sum + r.score.cellsTotal, 0)
    const cellsCorrect = subset.reduce((sum, r) => sum + r.score.cellsCorrect, 0)
    const exact = subset.filter((r) => r.score.exact).length

    const perField = {} as Record<FieldName, { correct: number; total: number }>
    for (const field of SCALAR_FIELDS) {
      perField[field] = { correct: 0, total: 0 }
    }
    for (const record of subset) {
      for (const field of SCALAR_FIELDS) {
        perField[field].total++
        if (record.score.fields[field].correct) perField[field].correct++
      }
    }

    const lineCorrect = subset.reduce((sum, r) => sum + r.score.lineItems.correctCells, 0)
    const lineTotal = subset.reduce((sum, r) => sum + r.score.lineItems.totalCells, 0)

    const populatedFields = subset.reduce((sum, r) => sum + r.score.populatedFields, 0)
    const populatedRecovered = subset.reduce((sum, r) => sum + r.score.populatedRecovered, 0)

    return {
      n: subset.length,
      fieldAccuracy: cellsCorrect / cellsTotal,
      scalarAccuracy:
        subset.reduce((sum, r) => sum + r.score.scalarCorrect, 0) / (subset.length * SCALAR_FIELDS.length),
      exactRecordRate: exact / subset.length,
      perFieldAccuracy: Object.fromEntries(
        Object.entries(perField).map(([field, value]) => [field, value.correct / value.total])
      ),
      lineItemAccuracy: lineTotal > 0 ? lineCorrect / lineTotal : null,
      lineItemSpurious: subset.reduce((sum, r) => sum + r.score.lineItems.spuriousItems, 0),
      populatedRecall: populatedFields > 0 ? populatedRecovered / populatedFields : null,
      p50LatencyMs: percentile(durations, 50),
      p95LatencyMs: percentile(durations, 95),
      meanLatencyMs: durations.reduce((a, b) => a + b, 0) / subset.length,
      documentsPerHour: 3600_000 / (durations.reduce((a, b) => a + b, 0) / subset.length),
      tokensInMean: subset.reduce((sum, r) => sum + r.tokensIn, 0) / subset.length,
      tokensOutMean: subset.reduce((sum, r) => sum + r.tokensOut, 0) / subset.length,
      repairs: subset.filter((r) => r.attempts > 1).length,
      costUsd: 0,
    }
  }

  const result = {
    arm: model,
    schemaHash: schemaHash(),
    startedAt,
    finishedAt: new Date().toISOString(),
    cacheHits: records.filter((r) => r.fromCache).length,
    headline: aggregate(headline),
    allScored: aggregate(scored),
    excludingAmbiguous: scored.length - headline.length,
    exclusions: records.filter((r) => r.outcome !== "ok").map((r) => ({ id: r.id, outcome: r.outcome, note: r.note })),
    byMedium: {
      "text-layer": aggregate(scored.filter((r) => r.medium === "text-layer")),
      "image-only": aggregate(scored.filter((r) => r.medium === "image-only")),
    },
    ambiguousFixtures: aggregate(ambiguousScored),
    records,
  }

  writeFileSync(join(process.cwd(), options.out), `${JSON.stringify(result, null, 2)}\n`, "utf8")

  console.log("\n--- headline (ambiguous fixtures excluded) ---")
  if (result.headline) {
    const h = result.headline
    console.log(`field accuracy        ${(h.fieldAccuracy * 100).toFixed(1)}%  (n=${h.n})`)
    console.log(`scalar accuracy       ${(h.scalarAccuracy * 100).toFixed(1)}%`)
    console.log(`exact record rate     ${(h.exactRecordRate * 100).toFixed(1)}%`)
    console.log(`line item accuracy    ${h.lineItemAccuracy === null ? "n/a" : (h.lineItemAccuracy * 100).toFixed(1) + "%"}`)
    console.log(`populated recall      ${h.populatedRecall === null ? "n/a" : (h.populatedRecall * 100).toFixed(1) + "%"}`)
    console.log(`p50 / p95 latency     ${(h.p50LatencyMs / 1000).toFixed(1)}s / ${(h.p95LatencyMs / 1000).toFixed(1)}s`)
    console.log(`throughput            ${h.documentsPerHour.toFixed(1)} documents/hour`)
    console.log(`tokens in / out       ${h.tokensInMean.toFixed(0)} / ${h.tokensOutMean.toFixed(0)}`)
    console.log(`repairs needed        ${h.repairs}`)
    console.log(`cost                  $${h.costUsd.toFixed(2)}`)
  }
if (result.exclusions.length) {
    console.log(`\nexcluded ${result.exclusions.length}:`)
    for (const exclusion of result.exclusions) {
      console.log(`  ${exclusion.id}: ${exclusion.outcome} — ${exclusion.note}`)
    }
  }

  // Stated plainly, because the cache is committed and a run that did no
  // inference at all otherwise looks identical to one that did.
  const cached = result.cacheHits
  if (cached > 0) {
    const fresh = scored.length - cached
    console.log(
      fresh === 0
        ? `\nAll ${cached} responses came from the committed cache — no model was run.\n` +
          `Delete results/cache/ or pass --no-cache to force a real run.`
        : `\n${cached} of ${scored.length} responses came from the committed cache; ` +
          `${fresh} were generated by the model in this run.`
    )
  }

  console.log(`\nwrote ${options.out}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})