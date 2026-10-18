/**
 * Deterministic fixture generator. Run it and the corpus is byte-identical:
 *
 *   npm run fixtures
 *
 * Output per fixture:
 *   fixtures/invoices/<id>.txt        the document text the model is scored on
 *   fixtures/invoices/<id>.truth.json authored ground truth
 *   fixtures/invoices/<id>.pdf        a real document, text layer or image only
 *   fixtures/manifest.json            index, mess attributes, alternatives
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { FIXTURES } from "./fixtures.data"
import { encodePng, rasterize, rotate } from "./raster"
import { imageOnlyPdf, textLayerPdf } from "./pdf"

const ROOT = join(process.cwd(), "fixtures")
const DOCS = join(ROOT, "invoices")

/** Fixtures whose scanned look is part of the point. Keyed by fixture id. */
const SCAN_TREATMENT: Record<string, { degrees?: number; scale?: number; ink?: number; paper?: number }> = {
  "04-hardware-ocr-garbled": { scale: 3, ink: 20 },
  "11-legal-retainer": { scale: 3, ink: 10 },
  "15-insurance-premium": { scale: 2, ink: 70, paper: 235 }, // low contrast
  "18-print-shop": { scale: 3, degrees: -4 },
}

function main() {
  mkdirSync(DOCS, { recursive: true })

  const manifest = {
    generatedBy: "scripts/gen-fixtures.ts",
    note:
      "Ground truth is authored in scripts/fixtures.data.ts before the first eval run and is never edited to match model output.",
    fixtures: FIXTURES.map((fixture) => {
      const scanned = fixture.text.trim()
      const treatment = SCAN_TREATMENT[fixture.id] ?? {}

      let raster = rasterize(scanned, {
        scale: treatment.scale ?? 3,
        ink: treatment.ink ?? 0,
        paper: treatment.paper ?? 255,
      })
      if (treatment.degrees) raster = rotate(raster, treatment.degrees)

      const png = encodePng(raster)

      let document: Buffer
      let filename: string

      if (fixture.medium === "image-only") {
        // No text operators anywhere: pdf.js returns an empty text layer and
        // the app must fall back to OCR (FR-3).
        document = imageOnlyPdf(raster)
        filename = `${fixture.id}.pdf`
        writeFileSync(join(DOCS, `${fixture.id}.png`), png)
      } else {
        document = textLayerPdf(fixture.text)
        filename = `${fixture.id}.pdf`
      }

      writeFileSync(join(DOCS, `${fixture.id}.txt`), fixture.text, "utf8")
      writeFileSync(join(DOCS, `${fixture.id}.truth.json`), `${JSON.stringify(fixture.truth, null, 2)}\n`, "utf8")
      writeFileSync(join(DOCS, filename), document)

      return {
        id: fixture.id,
        name: fixture.name,
        medium: fixture.medium,
        mess: fixture.mess,
        ambiguous: fixture.ambiguous ?? false,
        document: filename,
        image: fixture.medium === "image-only" ? `${fixture.id}.png` : null,
        text: `${fixture.id}.txt`,
        truth: `${fixture.id}.truth.json`,
        acceptable: fixture.acceptable ?? {},
      }
    }),
  }

  writeFileSync(join(ROOT, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8")

  const textCount = manifest.fixtures.filter((f: any) => f.medium === "text-layer").length
  const imageCount = manifest.fixtures.length - textCount
  console.log(`${FIXTURES.length} fixtures -> ${DOCS}`)
  console.log(`  ${textCount} text-layer, ${imageCount} image-only`)
  console.log(`  ${manifest.fixtures.filter((f: any) => f.ambiguous).length} ambiguous`)
}

main()