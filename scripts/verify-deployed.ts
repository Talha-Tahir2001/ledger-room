/**
 * End-to-end check of the deployed chase list.
 *
 *   npx tsx scripts/verify-deployed.ts https://ledger-room-indigo.vercel.app
 *
 * Exercises the live /api/predict route against the live Prior Labs API, so a
 * broken TABPFN_API_KEY or a misconfigured route shows up here rather than in
 * front of a judge. Powershell's ConvertTo-Json serialises a raw string as
 * {"value":...}, which is why this is a file and not a shell one-liner.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

const base = (process.argv[2] ?? "https://ledger-room-indigo.vercel.app").replace(/\/+$/, "")

async function main() {
  const csv = readFileSync(join(process.cwd(), "public", "sample-history.csv"), "utf8")

  console.log(`target: ${base}`)
  console.log(`history: ${csv.length} bytes\n`)

  const response = await fetch(`${base}/api/predict`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ history: csv, evaluate: true }),
  })

  const payload = await response.json()

  if (!response.ok) {
    console.error(`status ${response.status}: ${payload.error ?? "unknown error"}`)
    process.exit(1)
  }

  console.log(`mode:      ${payload.mode}`)
  console.log(`model:     ${payload.model}`)
  console.log(`paid rows: ${payload.rowsPaid}`)
  console.log(`clients:   ${payload.clients}`)
  console.log(`features:  ${payload.featuresPerRow}`)
  console.log(`hold-out:  trained ${payload.holdout.trained}, scored ${payload.holdout.scored}\n`)

  const rows: [string, number][] = (
    [
      ["TabPFN-3.5", payload.metrics.tabpfn.mae],
      ["client mean", payload.metrics.clientMean.mae],
      ["global mean", payload.metrics.globalMean.mae],
    ] as [string, number][]
  ).sort((a, b) => a[1] - b[1])

  console.log("ranking")
  for (const [name, mae] of rows) {
    console.log(`  ${mae.toFixed(2).padStart(6)} days  ${name}`)
  }

  const coverage = (payload.coverage.inside / payload.coverage.total) * 100
  console.log(
    `\ninterval coverage ${payload.coverage.inside}/${payload.coverage.total} (${coverage.toFixed(0)}%), mean width ${payload.coverage.meanWidthDays.toFixed(1)} days`
  )
  console.log(
    `TabPFN ${payload.metrics.tabpfn.mae < payload.metrics.clientMean.mae ? "beats" : "does not beat"} the client-mean baseline on the deployed app.`
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})