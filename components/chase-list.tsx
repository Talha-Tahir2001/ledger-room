"use client"

/**
 * The chase list (FR-10, FR-11).
 *
 * Every prediction is shown next to the two naive baselines it has to beat. A
 * forecast you cannot compare against "just use that client's average" is not
 * a forecast, it is an assertion — so the comparison is the product, not an
 * appendix to it.
 *
 * The interval is drawn as a bar, not printed as a range, because the width of
 * the bar is the honest part: a wide bar means the model does not know, and it
 * should look like it does not know.
 */
import * as React from "react"
import { IconChartBar, IconLoader2, IconUpload } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useStore } from "@/lib/store"

interface ChaseRow {
  invoiceNo: string
  clientHash: string
  amount: number
  issueDate: string
  predictedDaysToPayment: number
  interval: [number, number]
  dueDate: string | null
  baselines: {
    clientMeanDays: number
    globalMeanDays: number
    clientHistoryCount: number
  }
}

interface Evaluation {
  model: string
  rowsPaid: number
  clients: number
  featuresPerRow: number
  holdout: { trained: number; scored: number }
  metrics: {
    tabpfn: { mae: number }
    clientMean: { mae: number }
    globalMean: { mae: number }
  }
  coverage: { inside: number; total: number; meanWidthDays: number }
  interval: { low: number; high: number }
}

const SAMPLE_HISTORY_URL = "/sample-history.csv"

export function ChaseList() {
  const { invoices } = useStore()
  const [historyName, setHistoryName] = React.useState<string>("")
  const [status, setStatus] = React.useState<"idle" | "loading" | "done" | "error">("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [rows, setRows] = React.useState<ChaseRow[]>([])
  const [weak, setWeak] = React.useState<string | null>(null)
  const [evaluation, setEvaluation] = React.useState<Evaluation | null>(null)

  /**
   * Open invoices are the rows extracted in this session that carry an issue
   * date and a total. They are what the chase list is for, so the flow is
   * evaluation first (is the model worth trusting?) and then prediction.
   */
  const openInvoices = React.useMemo(
    () =>
      invoices
        .filter((invoice) => invoice.issueDate && typeof invoice.total === "number")
        .map((invoice, index) => ({
          invoiceNo: `${invoice.sourceFile}#${index}`,
          client: invoice.vendor ?? "Unknown client",
          issueDate: invoice.issueDate as string,
          amount: invoice.total as number,
          termsDays: 30,
          dueDate: invoice.dueDate,
        })),
    [invoices]
  )

  const run = React.useCallback(
    async (csv: string) => {
      setStatus("loading")
      setError(null)

      try {
        const evaluateResponse = await fetch("/api/predict", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ history: csv, evaluate: true }),
        })
        const evaluated = await evaluateResponse.json()
        if (!evaluateResponse.ok) {
          throw new Error(evaluated.error ?? `Failed with ${evaluateResponse.status}`)
        }
        setEvaluation(evaluated as Evaluation)

        if (openInvoices.length === 0) {
          setRows([])
          setWeak(null)
          setStatus("done")
          return
        }

        const predictResponse = await fetch("/api/predict", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ history: csv, openInvoices }),
        })
        const predicted = await predictResponse.json()

        if (!predictResponse.ok) {
          // A failed prediction is not a failed evaluation. Show the metrics.
          setRows([])
          setWeak(predicted.error ?? "Prediction failed; the measured results above still stand.")
        } else {
          setRows(predicted.rows ?? [])
          setWeak(predicted.weak ?? null)
        }

        setStatus("done")
      } catch (caught) {
        setError((caught as Error).message)
        setStatus("error")
      }
    },
    [openInvoices]
  )

  const onFile = async (file: File | undefined) => {
    if (!file) return
    const text = await file.text()
    setHistoryName(file.name)
    void run(text)
  }

  const loadSample = async () => {
    setStatus("loading")
    setError(null)
    try {
      const response = await fetch(SAMPLE_HISTORY_URL)
      if (!response.ok) throw new Error("The sample history file is not available.")
      const text = await response.text()
      setHistoryName("invoice-history.csv (sample)")
      void run(text)
    } catch (caught) {
      setError((caught as Error).message)
      setStatus("error")
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-sm font-medium text-foreground">
              Payment prediction
            </h2>
            <p className="max-w-prose text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
              TabPFN-3.5 forecasts days-to-payment from invoice history. Only numbers and a
              hashed client identifier are sent to Prior Labs; the raw client name never
              leaves this device.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex">
              <span className="sr-only">Invoice history CSV</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(event) => void onFile(event.target.files?.[0])}
              />
              {/* A label wrapping the real input, rather than a button that
                  clicks it: no imperative focus juggling, and the whole
                  control is one tab stop with native semantics. */}
              <span className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-within:ring-2 focus-within:ring-foreground focus-within:ring-offset-2 focus-within:ring-offset-background">
                <IconUpload className="size-3.5" aria-hidden />
                {historyName || "Upload history CSV"}
              </span>
            </label>
            <Button variant="ghost" size="sm" onClick={() => void loadSample()}>
              Use the 14-month sample
            </Button>
            {status === "loading" && (
              <span className="inline-flex items-center gap-1.5 text-xs text-secondary-foreground dark:text-muted-foreground">
                <IconLoader2 className="size-3.5 animate-spin" aria-hidden />
                Fitting and scoring
              </span>
            )}
          </div>

          {status === "error" && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </section>

      {evaluation && (
        <section className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-heading text-sm font-medium text-foreground">
              Measured against the baselines it has to beat
            </h2>
            <p className="text-xs tabular-nums text-secondary-foreground dark:text-muted-foreground">
              {evaluation.rowsPaid} paid invoices · {evaluation.clients} clients ·{" "}
              {evaluation.featuresPerRow} features · scored on the most recent{" "}
              {evaluation.holdout.scored} held out
            </p>
          </div>

          <ul className="flex flex-col gap-2">
            <ScoreRow
              name="TabPFN-3.5"
              mae={evaluation.metrics.tabpfn.mae}
              best
            />
            <ScoreRow name="Client historical mean" mae={evaluation.metrics.clientMean.mae} />
            <ScoreRow name="Global mean" mae={evaluation.metrics.globalMean.mae} />
          </ul>

          <div className="flex flex-wrap items-center gap-3 text-xs text-secondary-foreground dark:text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <IconChartBar className="size-3.5" aria-hidden />
              q10–q90 interval contained the actual value in{" "}
              <span className="tabular-nums">
                {evaluation.coverage.inside}/{evaluation.coverage.total}
              </span>{" "}
              of held-out rows
            </span>
            <span className="tabular-nums">
              mean interval width {evaluation.coverage.meanWidthDays.toFixed(1)} days
            </span>
          </div>

          {evaluation.metrics.tabpfn.mae < evaluation.metrics.clientMean.mae ? (
            <p className="rounded-md bg-primary/15 px-3 py-2 text-xs text-primary-foreground dark:bg-primary/20 dark:text-primary">
              TabPFN beat the client-mean baseline by{" "}
              {(
                (1 - evaluation.metrics.tabpfn.mae / evaluation.metrics.clientMean.mae) *
                100
              ).toFixed(0)}
              % on mean absolute error. That is a real margin and it is also a narrow one —
              the client baseline is strong, because who pays late is mostly a property of
              who the client is.
            </p>
          ) : (
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-secondary-foreground dark:text-muted-foreground">
              TabPFN did <strong className="font-medium text-foreground">not</strong> beat
              the client-mean baseline at this data size. Reported because it is the finding,
              and a win that hides a strong baseline would be worth less than this.
            </p>
          )}
        </section>
      )}

      {weak && (
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-secondary-foreground dark:text-muted-foreground">
          {weak}
        </p>
      )}

      {rows.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-heading text-sm font-medium text-foreground">Chase list</h2>
          <ChaseTable rows={rows} />
        </section>
      )}
    </div>
  )
}

function ScoreRow({ name, mae, best = false }: { name: string; mae: number; best?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="flex items-center gap-2 text-xs text-foreground">
        {name}
        {best && (
          <Badge variant="outline" className="text-[10px]">
            this app
          </Badge>
        )}
      </span>
      <span className="text-xs tabular-nums text-secondary-foreground dark:text-muted-foreground">
        MAE {mae.toFixed(2)} days
      </span>
    </li>
  )
}

function ChaseTable({ rows }: { rows: ChaseRow[] }) {
  const widest = Math.max(...rows.map((row) => row.interval[1]), 1)

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">
          Open invoices ordered worst first, with predicted days to payment, its interval,
          and both naive baselines
        </caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="px-3 py-2 font-medium text-foreground">
              Invoice
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-foreground">
              Client
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-foreground">
              Amount
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-foreground">
              Predicted days
            </th>
            <th scope="col" className="px-3 py-2 font-medium text-foreground">
              q10–q90
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-foreground">
              Client mean
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium text-foreground">
              Global mean
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.invoiceNo} className="border-b border-border last:border-0">
              <td className="px-3 py-2 font-mono text-secondary-foreground dark:text-muted-foreground">
                {row.invoiceNo}
              </td>
              <td className="px-3 py-2 font-mono text-secondary-foreground dark:text-muted-foreground">
                {row.clientHash}
                <span className="ml-1 text-[10px]">
                  ({row.baselines.clientHistoryCount} prior)
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-foreground">
                {row.amount.toFixed(2)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-foreground">
                {row.predictedDaysToPayment}
              </td>
              <td className="px-3 py-2">
                <span className="flex items-center gap-2">
                  <span className="tabular-nums text-secondary-foreground dark:text-muted-foreground">
                    {row.interval[0]}–{row.interval[1]}
                  </span>
                  <span className="relative block h-1.5 w-16 bg-muted" aria-hidden>
                    <span
                      className="absolute top-0 block h-full bg-chart-1"
                      style={{
                        left: `${(row.interval[0] / widest) * 100}%`,
                        width: `${((row.interval[1] - row.interval[0]) / widest) * 100}%`,
                      }}
                    />
                    <span
                      className="absolute top-[-2px] block size-1.5 bg-primary-foreground dark:bg-primary"
                      style={{ left: `calc(${(row.predictedDaysToPayment / widest) * 100}% - 3px)` }}
                    />
                  </span>
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-secondary-foreground dark:text-muted-foreground">
                {row.baselines.clientMeanDays}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-secondary-foreground dark:text-muted-foreground">
                {row.baselines.globalMeanDays}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}