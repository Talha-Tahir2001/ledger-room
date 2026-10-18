/**
 * Checks that the baselines are actually baselines.
 *
 *   npm run chase:check
 *
 * A client-mean baseline that silently falls back to the global mean does not
 * error, does not warn, and reports a plausible number. It just makes the model
 * look better than it is — which is the one failure mode this project cannot
 * afford, given that its entire argument is "we published our own numbers".
 *
 * That is not hypothetical: it shipped once. The route handler keyed per-client
 * history off a lookup that could never match, so the client baseline was the
 * global mean and the deployed app reported a 35% margin that did not exist.
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildDataset,
  hashClient,
  meanAbsoluteError,
  parseHistory,
  type FeatureRow,
} from "../lib/features"

const MIN_EXPECTED_CLIENT_EDGE = 2

function fail(message: string): never {
  console.error(`\nFAIL: ${message}`)
  process.exit(1)
}

function main() {
  const history = parseHistory(
    readFileSync(join(process.cwd(), "fixtures", "history", "invoice-history.csv"), "utf8")
  ).sort((a, b) => a.issueDate.localeCompare(b.issueDate))

  const dataset = buildDataset(history)
  const heldOutSize = Math.max(5, Math.round(dataset.train.length * 0.2))
  const train = dataset.train.slice(0, dataset.train.length - heldOutSize)
  const test = dataset.train.slice(dataset.train.length - heldOutSize)

  const trainIds = new Set(train.map((row) => row.invoiceNo))
  const seen = history.filter(
    (row) => row.daysToPayment !== null && trainIds.has(row.invoiceNo)
  )

  // Exactly what the route handler does. If the two drift apart, this stops
  // testing the thing that ships.
  const perClient = new Map<string, number[]>()
  for (const row of seen) {
    const key = hashClient(row.client)
    const list = perClient.get(key) ?? []
    list.push(row.daysToPayment as number)
    perClient.set(key, list)
  }

  const globalMean =
    seen.reduce((sum, row) => sum + (row.daysToPayment as number), 0) / (seen.length || 1)

  const clientBaseline = (row: FeatureRow) => {
    const list = perClient.get(row.clientHash)
    return list && list.length > 0
      ? list.reduce((a, b) => a + b, 0) / list.length
      : globalMean
  }

  const actuals = test.map((row) => row.daysToPayment as number)
  const clientMae = meanAbsoluteError(test.map(clientBaseline), actuals)
  const globalMae = meanAbsoluteError(test.map(() => globalMean), actuals)

  const coveredTestRows = test.filter((row) => perClient.has(row.clientHash)).length

  console.log(`paid rows:            ${dataset.train.length}`)
  console.log(`clients in history:   ${dataset.clientStats.size}`)
  console.log(`clients with history: ${perClient.size}`)
  console.log(`held-out rows scored: ${test.length}`)
  console.log(`held-out rows whose client has history: ${coveredTestRows}`)
  console.log(`\nclient-mean MAE: ${clientMae.toFixed(2)} days`)
  console.log(`global-mean MAE: ${globalMae.toFixed(2)} days`)

  if (perClient.size === 0) {
    fail("per-client map is empty — the client baseline is silently the global mean")
  }

  if (coveredTestRows === 0) {
    fail(
      "no held-out row matched a client in the training set — the client baseline cannot beat anything"
    )
  }

  if (Math.abs(clientMae - globalMae) < 0.01) {
    fail(
      `client mean and global mean are identical (${clientMae.toFixed(2)}). ` +
        "The per-client lookup is not matching and the baseline has degraded to the global mean."
    )
  }

  const edge = globalMae - clientMae
  console.log(`\nclient mean beats global mean by ${edge.toFixed(2)} days`)

  if (edge < MIN_EXPECTED_CLIENT_EDGE) {
    fail(
      `client mean beats global mean by only ${edge.toFixed(2)} days, which is ` +
        "implausibly small. Check the per-client grouping is not collapsing to one client."
    )
  }

  console.log("\nPASS: the client-mean baseline is distinct and meaningfully stronger.")
}

main()