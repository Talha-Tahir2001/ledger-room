/**
 * Proves the TabPFN integration against the live API and scores it against the
 * naive baselines, which is the comparison EVAL.md §3.5 has to report whether
 * or not the model wins.
 *
 *   npm run chase:eval
 *
 * Hold-out method: the most recent 20% of paid invoices are held out, the model
 * is fitted on the rest, and every predictor is scored on the same rows.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import {
  buildDataset,
  hashClient,
  meanAbsoluteError,
  parseHistory,
  type FeatureRow,
} from "../lib/features"
import { fitRegressor, MODEL_PATH, QUANTILE_HIGH, QUANTILE_LOW, tabpfnConfigured } from "../lib/tabpfn"

async function main() {
  if (!tabpfnConfigured()) {
    console.error("TABPFN_API_KEY is not set.")
    process.exit(1)
  }

  const csv = readFileSync(
    join(process.cwd(), "fixtures", "history", "invoice-history.csv"),
    "utf8"
  )
  const history = parseHistory(csv).sort((a, b) => a.issueDate.localeCompare(b.issueDate))
  const dataset = buildDataset(history)

  const heldOutSize = Math.max(5, Math.round(dataset.train.length * 0.2))
  const train = dataset.train.slice(0, dataset.train.length - heldOutSize)
  const test = dataset.train.slice(dataset.train.length - heldOutSize)

  console.log(`model: ${MODEL_PATH}`)
  console.log(`rows: ${dataset.train.length} paid, ${dataset.test.length} open`)
  console.log(
    `hold-out: fit on ${train.length}, score on ${test.length} (most recent ${Math.round(
      (heldOutSize / dataset.train.length) * 100
    )}%)`
  )
  console.log(`features: ${train[0]?.featureNames.length} per row\n`)

  // --- baselines, computed from the training rows only ---------------------

  // Keyed by the same hash the feature rows use. Keying one side by the raw
  // client name and the other by the hash makes every lookup miss, which looks
  // exactly like the two baselines agreeing.
  const trainingIds = new Set(train.map((row) => row.invoiceNo))
  const seen = history.filter(
    (row) => row.daysToPayment !== null && trainingIds.has(row.invoiceNo)
  )

  const clientMeans = new Map<string, number[]>()
  for (const row of seen) {
    const key = hashClient(row.client)
    const list = clientMeans.get(key) ?? []
    list.push(row.daysToPayment as number)
    clientMeans.set(key, list)
  }

  const globalMean =
    seen.reduce((sum, row) => sum + (row.daysToPayment as number), 0) / (seen.length || 1)

  const clientMeanPrediction = (row: FeatureRow) => {
    const list = clientMeans.get(row.clientHash)
    return list && list.length > 0
      ? list.reduce((a, b) => a + b, 0) / list.length
      : globalMean
  }

  const actuals = test.map((row) => row.daysToPayment as number)

  const clientMae = meanAbsoluteError(test.map(clientMeanPrediction), actuals)
  const globalMae = meanAbsoluteError(test.map(() => globalMean), actuals)

  console.log("baselines (computed on the same held-out rows)")
  console.log(`  client historical mean   MAE ${clientMae.toFixed(2)} days`)
  console.log(`  global mean              MAE ${globalMae.toFixed(2)} days\n`)

  // --- the model ------------------------------------------------------------

  const started = Date.now()
  const model = await fitRegressor(
    train.map((row) => row.features),
    train.map((row) => row.daysToPayment as number)
  )

  const predictions = await model.predict(test.map((row) => row.features))
  const elapsedMs = Date.now() - started

  const modelMae = meanAbsoluteError(
    predictions.map((prediction) => prediction.predicted),
    actuals
  )

  // Interval calibration: how often the actual fell inside q10..q90.
  const inside = predictions.filter((prediction, index) => {
    const actual = actuals[index]
    return actual >= prediction.q10 && actual <= prediction.q90
  }).length

  const meanWidth =
    predictions.reduce((sum, prediction) => sum + (prediction.q90 - prediction.q10), 0) /
    (predictions.length || 1)

  console.log("TabPFN")
  console.log(`  MAE ${modelMae.toFixed(2)} days`)
  console.log(
    `  q${QUANTILE_LOW * 100}-q${QUANTILE_HIGH * 100} coverage ${inside}/${predictions.length} ` +
      `(${((inside / (predictions.length || 1)) * 100).toFixed(0)}%, target 80%)`
  )
  console.log(`  mean interval width ${meanWidth.toFixed(1)} days`)
  console.log(`  wall clock ${(elapsedMs / 1000).toFixed(1)}s\n`)

  const best = [
    { name: "TabPFN-3.5", mae: modelMae },
    { name: "client mean", mae: clientMae },
    { name: "global mean", mae: globalMae },
  ].sort((a, b) => a.mae - b.mae)

  console.log("ranking")
  for (const entry of best) {
    const marker = entry.name === "TabPFN-3.5" ? (entry === best[0] ? " <- wins" : " <- loses") : ""
    console.log(`  ${entry.mae.toFixed(2).padStart(6)} days  ${entry.name}${marker}`)
  }

  console.log(
    `\n${modelMae < clientMae
      ? "TabPFN beat the client-mean baseline at this data size."
      : "TabPFN did NOT beat the client-mean baseline at this data size."}`
  )

  writeFileSync(
    join(process.cwd(), "results", "tabpfn.json"),
    JSON.stringify(
      {
        model: MODEL_PATH,
        modelPath: MODEL_PATH,
        rowsPaid: dataset.train.length,
        rowsOpen: dataset.test.length,
        clients: dataset.clientStats.size,
        featuresPerRow: train[0]?.featureNames.length ?? 0,
        featureNames: train[0]?.featureNames ?? [],
        holdout: { trained: train.length, scored: test.length },
        interval: { low: QUANTILE_LOW, high: QUANTILE_HIGH },
        metrics: {
          tabpfn: { mae: modelMae },
          clientMean: { mae: clientMae },
          globalMean: { mae: globalMae },
        },
        coverage: { inside: inside, total: predictions.length, meanWidthDays: meanWidth },
        elapsedMs,
        tabpfnWins: modelMae < clientMae,
      },
      null,
      2
    ) + "\n",
    "utf8"
  )
  console.log("wrote results/tabpfn.json")
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})