/**
 * Reports which fixtures would MISS the response cache right now, and why.
 *
 *   npx tsx scripts/cache-report.ts
 *
 * Exists because a silent cache miss is indistinguishable from a model
 * regression when you are reading a results file, and because "the cache is
 * stale" and "the corpus changed" are different problems with different fixes.
 */
import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

import { schemaHash } from "../lib/schema"

const FIXTURES = join(process.cwd(), "fixtures", "invoices")
const CACHE = join(process.cwd(), "results", "cache")

const manifest = JSON.parse(readFileSync(join(process.cwd(), "fixtures", "manifest.json"), "utf8"))
const hash = schemaHash()

const present = new Set(
  existsSync(CACHE)
    ? readdirSync(CACHE)
        .filter((name) => name.endsWith(".json"))
        .map((name) => name.replace(/\.json$/, ""))
    : []
)

console.log(`schema hash: ${hash}`)
console.log(`cached entries on disk: ${present.size}`)
console.log()

for (const arm of ["gemma3:4b", "gemma3:1b"]) {
  const missing: string[] = []
  const hit: string[] = []

  for (const entry of manifest.fixtures as any[]) {
    const text = readFileSync(join(FIXTURES, entry.text), "utf8")
    const key = createHash("sha256")
      .update(`${text}|${arm}|${hash}`)
      .digest("hex")
      .slice(0, 32)

    if (present.has(key)) hit.push(entry.id)
    else missing.push(entry.id)
  }

  console.log(`${arm}: ${hit.length} hit, ${missing.length} miss`)
  if (missing.length > 0) {
    for (const id of missing) console.log(`  MISS ${id}`)
  }
  console.log()
}