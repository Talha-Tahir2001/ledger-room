/**
 * Dumps the raw shape of a TabPFN quantile response.
 *
 * Written because the documented `"quantiles"` output has no stated response
 * shape, and guessing it wrong silently produced 3 "predictions" for 17 rows.
 * Run it once, read it, keep it as the reference for lib/tabpfn.ts.
 *
 *   npx tsx --env-file=.env scripts/probe-tabpfn.ts
 */
import { readFileSync } from "node:fs"
import { join } from "node:path"

import { buildDataset, parseHistory } from "../lib/features"

const BASE_URL = process.env.TABPFN_BASE_URL ?? "https://api.priorlabs.ai"

async function main() {
  const history = parseHistory(
    readFileSync(join(process.cwd(), "fixtures", "history", "invoice-history.csv"), "utf8")
  ).sort((a, b) => a.issueDate.localeCompare(b.issueDate))

  const dataset = buildDataset(history)
  const train = dataset.train.slice(0, -3)
  const test = dataset.train.slice(-3)

  const header = (n: number) => Array.from({ length: n }, (_, i) => `f${i}`)
  const csv = (rows: number[][], head?: string[]) =>
    [head ? head.join(",") : null, ...rows.map((r) => r.join(","))].filter(Boolean).join("\n") + "\n"

  const auth = {
    Authorization: `Bearer ${process.env.TABPFN_API_KEY}`,
    "Content-Type": "application/json",
  }

  const prepared = await (
    await fetch(`${BASE_URL}/tabpfn/prepare_train_set_upload`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        x_train_info: { format: "csv" },
        y_train_info: { format: "csv" },
      }),
    })
  ).json()

  for (const [key, body] of [
    ["x_train_info", csv(train.map((r) => r.features), header(12))],
    ["y_train_info", csv(train.map((r) => [r.daysToPayment as number]), ["y"])],
  ] as const) {
    await fetch(prepared[key].signed_urls[0], {
      method: "PUT",
      headers: prepared[key].required_headers,
      body,
    })
  }

  const fitted = await (
    await fetch(`${BASE_URL}/tabpfn/fit`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        train_set_upload_id: prepared.train_set_upload_id,
        task_config: {
          task: "regression",
          tabpfn_config: { model_path: "v3.5_default" },
        },
      }),
    })
  ).text()

  const fittedJson = JSON.parse(fitted)
  console.log("fit status:", fittedJson.status, "| id:", fittedJson.fitted_train_set_id?.slice(0, 8))

  const preparedTest = await (
    await fetch(`${BASE_URL}/tabpfn/prepare_test_set_upload`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        fitted_train_set_id: fittedJson.fitted_train_set_id,
        x_test_info: { format: "csv" },
      }),
    })
  ).json()

  await fetch(preparedTest.x_test_info.signed_urls[0], {
    method: "PUT",
    headers: preparedTest.x_test_info.required_headers,
    body: csv(test.map((r) => r.features), header(12)),
  })

  const predicted = await (
    await fetch(`${BASE_URL}/tabpfn/predict`, {
      method: "POST",
      headers: auth,
      body: JSON.stringify({
        test_set_upload_id: preparedTest.test_set_upload_id,
        fitted_train_set_id: fittedJson.fitted_train_set_id,
        task_config: {
          task: "regression",
          predict_params: {
            output_type: "quantiles",
            quantiles: [0.1, 0.5, 0.9],
          },
        },
      }),
    })
  ).text()

  const parsed = JSON.parse(predicted)
  const prediction = parsed.prediction

  console.log("\nactual days_to_payment:", test.map((r) => r.daysToPayment))
  console.log("prediction outer length:", prediction.length)
  console.log("prediction is array of arrays:", Array.isArray(prediction[0]))
  console.log("\nraw prediction:")
  console.log(JSON.stringify(prediction, null, 2).slice(0, 1200))
  console.log("\nmetadata keys:", Object.keys(parsed.metadata ?? {}).join(", "))
  console.log("metadata.quantiles:", JSON.stringify((parsed.metadata ?? {}).quantiles))
  console.log("test_set_num_rows:", (parsed.metadata ?? {}).test_set_num_rows)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})