/**
 * Deterministic synthetic invoice history for the chase list.
 *
 *   npm run history
 *
 * Real history would be the obviously better demo and is exactly what must not
 * be committed to a public repository (ADR-008). What matters for the model is
 * the *shape* of a freelancer's history, and that is reproducible: a few dozen
 * rows, one target column, a handful of numeric features, a handful of clients
 * with genuinely different payment habits.
 *
 * The habits are modelled, not random. Each client gets a base days-to-pay, a
 * spread, and a late-bias, which is what makes the naive client-mean baseline a
 * real baseline rather than a straw man.
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"

/** mulberry32 — small, fast, and identical on every platform. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface Client {
  name: string
  baseDays: number
  spread: number
  lateBias: number
  /** Relative invoice size, drives whether size correlates with lateness. */
  sizeScale: number
}

const CLIENTS: Client[] = [
  { name: "Halcyon Robotics", baseDays: 41, spread: 6, lateBias: 0.08, sizeScale: 1.0 },
  { name: "Northwind Analytics", baseDays: 28, spread: 4, lateBias: 0.05, sizeScale: 0.8 },
  { name: "Meridian Labs", baseDays: 52, spread: 9, lateBias: 0.22, sizeScale: 1.4 },
  { name: "Kestrel & Roe", baseDays: 19, spread: 3, lateBias: 0.04, sizeScale: 0.6 },
  { name: "Foundry Twelve", baseDays: 34, spread: 7, lateBias: 0.14, sizeScale: 0.9 },
  { name: "Atlas Freight Co", baseDays: 63, spread: 11, lateBias: 0.31, sizeScale: 1.2 },
  { name: "Bright Harbour", baseDays: 24, spread: 5, lateBias: 0.06, sizeScale: 0.7 },
  { name: "Vantage Point Media", baseDays: 46, spread: 8, lateBias: 0.18, sizeScale: 1.1 },
]

const CATEGORIES = ["retainer", "project", "licensing", "consulting", "support"]
const CURRENCY = "USD"

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function main() {
  const random = rng(20260418)
  const rows: string[][] = []

  // 14 months of history ending 2026-03-31, so the open invoices in the app
  // sit just past it and the prediction problem is the obvious one.
  const start = new Date(Date.UTC(2025, 1, 1))
  const end = new Date(Date.UTC(2026, 2, 31))

  let invoiceNumber = 1000
  let months = 0
  const cursor = new Date(start)

  while (cursor <= end) {
    const year = cursor.getUTCFullYear()
    const month = cursor.getUTCMonth()

    for (const client of CLIENTS) {
      // Not every client invoices every month.
      if (random() < 0.22) continue

      const issue = new Date(Date.UTC(year, month, 1 + Math.floor(random() * 27)))
      const amount = Math.round(
        (800 + random() * 6200) * client.sizeScale * 100
      ) / 100

      const noise = (random() + random() + random() - 1.5) * client.spread
      const late = random() < client.lateBias ? 14 + random() * 26 : 0
      const daysToPayment = Math.max(
        3,
        Math.round(client.baseDays + noise + late)
      )

      const termsDays = client.baseDays > 45 ? 45 : 30
      const paid = new Date(issue.getTime() + daysToPayment * 86400000)

      invoiceNumber += 1
      rows.push([
        `RDS-${year}-${String(invoiceNumber).padStart(4, "0")}`,
        client.name,
        isoDate(issue),
        isoDate(paid),
        String(daysToPayment),
        String(termsDays),
        amount.toFixed(2),
        CURRENCY,
        CATEGORIES[Math.floor(random() * CATEGORIES.length)],
      ])
    }

    months += 1
    cursor.setUTCMonth(cursor.getUTCMonth() + 1)
  }

  const header = [
    "invoice_no",
    "client",
    "issue_date",
    "paid_date",
    "days_to_payment",
    "terms_days",
    "amount",
    "currency",
    "category",
  ]

  const outDir = join(process.cwd(), "fixtures", "history")
  mkdirSync(outDir, { recursive: true })
  const path = join(outDir, "invoice-history.csv")

  writeFileSync(path, [header.join(","), ...rows.map((row) => row.join(","))].join("\n") + "\n")

  const target = rows.map((row) => Number(row[4]))
  const mean = target.reduce((a, b) => a + b, 0) / target.length
  const sorted = [...target].sort((a, b) => a - b)

  console.log(`${rows.length} invoices across ${months} months -> ${path}`)
  console.log(`  ${CLIENTS.length} clients, mean ${mean.toFixed(1)} days to pay`)
  console.log(`  median ${sorted[Math.floor(sorted.length / 2)]}, min ${sorted[0]}, max ${sorted[sorted.length - 1]}`)
}

main()