/**
 * WS1 gate. Nothing else gets built until this passes.
 *
 * Proves that Gemma 3 4B returns schema-valid JSON through Ollama's
 * structured-output `format` field, on messy invoice text, from this CPU.
 */
import { extractInvoice, isOllamaAvailable, ollamaModel, ollamaUrl } from "../lib/ollama"
import { invoiceJsonSchema } from "../lib/schema"

const SAMPLES: { name: string; text: string }[] = [
  {
    name: "saas-subscription",
    text: `NORTHWIND ANALYTICS
Suite 400, 1200 Market Street
San Francisco, CA 94102

INVOICE
Invoice Number: NW-2026-0431
Issue Date: 2026-03-14
Due Date: 2026-04-13

Bill To:
Sam Rivera
Rivera Design Studio

Description                     Qty    Unit Price     Amount
Analytics Pro - Team plan        12 mo      49.00      588.00
Additional seats                  3        19.00       57.00
Priority support                  1        75.00       75.00

Subtotal                                  720.00
Sales Tax (8.5%)                            61.20
TOTAL DUE                                 781.20 USD`,
  },
  {
    name: "restaurant-receipt",
    text: `THE GREEN KITCHEN
88 Rosemont Ave, Austin TX

Table 12          Server: Dana
03/22/2026        1:04 PM

1x Espresso                 3.50
2x House sandwich          11.00
1x Soup of the day          7.25
3x Sparkling water          9.00
1x Tiramisu                 8.50

Subtotal                   39.25
Tax                         3.34
TOTAL                      42.59`,
  },
  {
    name: "euro-prose-total",
    text: `Rechnung

Dienstleister: Ludwig & Sohn GmbH
Rechnungsnummer: 2026-0455
Rechnungsdatum: 14.03.2026
Fällig am: 13.04.2026

Leistung                 Netto        MwSt        Brutto
Beratung Design          2.400,00 EUR  456,00 EUR  2.856,00 EUR

Rechnungsbetrag                                   2.856,00 EUR
Zahlbar innerhalb 30 Tagen ohne Abzug.`,
  },
  {
    name: "no-total-row-ocr-noise",
    text: `~ S C A N   R E C E I P T ~
VENDOR:  Pixel Forge Hardware
DATE:    2 0 2 6 - 0 2 - 0 9
REF:     PF-99-2214
QTY  ITEM              AMOUNT
  1  34" ultrawide     549.00
  2  USB-C dock         89.95
             GRAND TOTAL   728.90
Currency: EUR`,
  },
  {
    name: "pakistani-utility",
    text: `K-ELECTRIC BILL
Consumer No: 4110229837
Billing Period: 01/01/2026 - 31/01/2026
Meter Reading Prev: 48210
Meter Reading Current: 49188

Units Consumed: 978
Tariff: Residential
Amount Payable: Rs 21,516
Due Date: 20/02/2026`,
  },
]

async function main() {
  console.log(`Ollama: ${ollamaUrl()}  model: ${ollamaModel()}`)

  const available = await isOllamaAvailable()
  if (!available) {
    console.error("GATE FAILED: no local runtime reachable at " + ollamaUrl())
    process.exit(1)
  }
  console.log("runtime reachable\n")

  const schema = invoiceJsonSchema()
  console.log("schema fields:", Object.keys((schema as any).properties ?? {}).join(", "))
  console.log()

  let passed = 0
  let repaired = 0
  const durations: number[] = []
  const outTokens: number[] = []

  for (const sample of SAMPLES) {
    const t0 = performance.now()
    try {
      const outcome = await extractInvoice(sample.text)
      const seconds = (performance.now() - t0) / 1000
      durations.push(seconds)
      outTokens.push(outcome.tokensOut)
      if (outcome.repaired) repaired++

      passed++
      const v = outcome.value
      console.log(`PASS  ${sample.name}  (${seconds.toFixed(1)}s, attempts=${outcome.attempts})`)
      console.log(
        `      vendor=${JSON.stringify(v.vendor)} no=${JSON.stringify(v.invoiceNo)} ` +
          `issue=${JSON.stringify(v.issueDate)} due=${JSON.stringify(v.dueDate)} cur=${JSON.stringify(v.currency)}`
      )
      console.log(
        `      sub=${JSON.stringify(v.subtotal)} tax=${JSON.stringify(v.tax)} ` +
          `total=${JSON.stringify(v.total)} cat=${JSON.stringify(v.category)} ` +
          `billable=${JSON.stringify(v.billable)} items=${v.lineItems.length}`
      )
      console.log(
        `      tok in/out ${outcome.tokensIn}/${outcome.tokensOut} = ` +
          `${(outcome.tokensOut / seconds).toFixed(1)} tok/s`
      )
    } catch (error) {
      console.log(`FAIL  ${sample.name}: ${(error as Error).message}`)
    }
    console.log()
  }

  durations.sort((a, b) => a - b)
  const p50 = durations[Math.floor(durations.length / 2)] ?? 0
  const meanToks = outTokens.reduce((a, b) => a + b, 0) / (outTokens.length || 1)
  const meanSecs = durations.reduce((a, b) => a + b, 0) / (durations.length || 1)

  console.log("---")
  console.log(`${passed}/${SAMPLES.length} schema-valid, ${repaired} needed repair`)
  console.log(`p50 ${p50.toFixed(1)}s, mean ${meanSecs.toFixed(1)}s/document`)
  console.log(`${(meanToks / meanSecs).toFixed(1)} output tok/s on CPU`)
  console.log(`projected: ${Math.round(3600 / meanSecs)} documents/hour`)

  if (passed < SAMPLES.length) {
    console.error("\nGATE FAILED")
    process.exit(1)
  }
  console.log("\nGATE PASSED")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})