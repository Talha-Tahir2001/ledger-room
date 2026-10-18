/**
 * Verifies the generated corpus rather than trusting it.
 *
 *   npm run ingest:verify
 *
 * Three things are checked, one per ingest requirement:
 *   FR-2  a text-layer PDF yields its text through pdf.js
 *   FR-3  an image-only PDF yields nothing, so OCR is the only option
 *   the density heuristic routes each fixture the way its manifest claims
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { DENSITY_THRESHOLD, extractTextLayer } from "../lib/ingest"

const DOCS = join(process.cwd(), "fixtures", "invoices")
const manifest = JSON.parse(readFileSync(join(process.cwd(), "fixtures", "manifest.json"), "utf8"))

async function main() {
  let ok = 0
  let failed = 0

  for (const entry of manifest.fixtures as any[]) {
    const buffer = readFileSync(join(DOCS, entry.document))
    const started = performance.now()
    const result = await extractTextLayer(new Uint8Array(buffer))
    const ms = Math.round(performance.now() - started)

    const expectation = entry.medium === "image-only" ? "no text" : "text"
    const behaved = entry.medium === "image-only" ? result.chars < 20 : result.chars >= DENSITY_THRESHOLD

    const route = result.textLayerDense ? "text-layer" : "ocr"
    const shouldRoute = entry.medium === "image-only" ? "ocr" : "text-layer"

    if (behaved && route === shouldRoute) ok++
    else failed++

    console.log(
      `${behaved && route === shouldRoute ? "PASS" : "FAIL"}  ${entry.id.padEnd(28)} ` +
        `expect=${expectation.padEnd(8)} chars=${String(result.chars).padStart(5)} ` +
        `pages=${result.pages} dense=${result.textLayerDense} route=${route} ${ms}ms`
    )

    if (result.chars > 0) {
      const preview = result.text.replace(/\s+/g, " ").trim().slice(0, 64)
      console.log(`      "${preview}..."`)
    }
  }

  console.log("---")
  console.log(`${ok} correct, ${failed} incorrect`)
  if (failed > 0) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})