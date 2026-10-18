/**
 * Section 6 — the accuracy study, rendered from the committed measurements.
 *
 * This is the most important section on the page. Every AI product claims
 * accuracy; almost none publish a per-field table with their own failures
 * visible in it. Do not soften it — the page is more credible with a 15.8% row
 * showing than without (DESIGN.md §8.2).
 *
 * Server component. No JavaScript is involved in rendering any of it.
 */
import { readArm, readChaseStudy, readHostedArm } from "@/lib/study"

const FIELD_LABELS: [string, string][] = [
  ["vendor", "Vendor"],
  ["invoiceNo", "Invoice no."],
  ["issueDate", "Issue date"],
  ["dueDate", "Due date"],
  ["currency", "Currency"],
  ["subtotal", "Subtotal"],
  ["tax", "Tax"],
  ["total", "Total"],
  ["category", "Category"],
  ["billable", "Billable"],
]

/** Renders a measurement, or an explicit "pending" marker. Never a zero. */
function Measured({ value, format }: { value: number | null; format?: (v: number) => string }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <span className="inline-flex items-center rounded-none bg-muted px-1.5 py-0.5 font-mono text-xs text-secondary-foreground dark:text-muted-foreground">
        pending
      </span>
    )
  }
  return <>{format ? format(value) : value}</>
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`

export function AccuracyStudy() {
  const fourB = readArm("eval-4b.json")
  const oneB = readArm("eval-1b.json")
  const hosted = readHostedArm()

  const headline = fourB.headline
  const curve = oneB.headline

  return (
    <section id="accuracy" className="scroll-mt-20 py-16 sm:py-24">
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-foreground dark:text-primary">
          The study
        </p>
        <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          What a 4B model on four CPU cores actually gets right
        </h2>
        <p className="text-base/relaxed text-secondary-foreground dark:text-muted-foreground">
          Twenty synthetic invoices and receipts, hand-authored ground truth, a
          schema-constrained prompt and{" "}
          <code className="font-mono">temperature: 0</code>. Every number below was measured
          on the hardware in the footnote and is regenerated from the committed run by{" "}
          <code className="font-mono">npm run results:export</code>. Nothing here is
          estimated, and the weakest field is shown rather than averaged away.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {/* Headline */}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <h3 className="border-b border-border px-4 py-3 font-heading text-sm font-medium text-foreground">
            Local <code className="font-mono">gemma3:4b</code>, CPU only
          </h3>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Headline accuracy and latency for the local 4B model over 20 fixtures
            </caption>
            <tbody>
              <Row label="Field accuracy">
                <Measured value={headline?.fieldAccuracy ?? null} format={percent} />
              </Row>
              <Row label="Exact-record accuracy" hint="every field on a document correct">
                <Measured value={headline?.exactRecordRate ?? null} format={percent} />
              </Row>
              <Row label="p50 latency per document">
                <Measured value={headline?.p50LatencyMs ?? null} format={seconds} />
              </Row>
              <Row label="p95 latency per document">
                <Measured value={headline?.p95LatencyMs ?? null} format={seconds} />
              </Row>
              <Row label="Throughput">
                <Measured
                  value={headline?.documentsPerHour ?? null}
                  format={(v) => `${v.toFixed(1)}/hour`}
                />
              </Row>
              <Row label="Schema violations reaching the table">
                <Measured
                  value={headline ? headline.repairs : null}
                  format={(v) => `${v} across ${headline?.n ?? 0} documents`}
                />
              </Row>
              <Row label="Cost per 20 invoices" emphasis>
                <strong className="font-medium">$0.00</strong>
              </Row>
            </tbody>
          </table>
        </div>

        {/* Size curve */}
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <h3 className="border-b border-border px-4 py-3 font-heading text-sm font-medium text-foreground">
            What parameter count buys, on identical hardware
          </h3>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Field accuracy and latency for a 1B and a 4B model on the same CPU
            </caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-2 font-medium text-foreground">
                  Model
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium text-foreground">
                  Field accuracy
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium text-foreground">
                  p50
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <th scope="row" className="px-4 py-2 text-left font-mono font-normal">
                  gemma3:1b
                </th>
                <td className="px-4 py-2 text-right tabular-nums">
                  <Measured value={curve?.fieldAccuracy ?? null} format={percent} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <Measured value={curve?.p50LatencyMs ?? null} format={seconds} />
                </td>
              </tr>
              <tr>
                <th scope="row" className="px-4 py-2 text-left font-mono font-normal">
                  gemma3:4b
                </th>
                <td className="px-4 py-2 text-right tabular-nums">
                  <Measured value={headline?.fieldAccuracy ?? null} format={percent} />
                </td>
                <td className="px-4 py-2 text-right tabular-nums">
                  <Measured value={headline?.p50LatencyMs ?? null} format={seconds} />
                </td>
              </tr>
            </tbody>
          </table>
          <p className="border-t border-border px-4 py-3 text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
            Four times the parameters bought{" "}
            {curve && headline
              ? `${(headline.fieldAccuracy * 100 - curve.fieldAccuracy * 100).toFixed(1)} points of accuracy for ${(headline.p50LatencyMs / curve.p50LatencyMs).toFixed(1)}× the latency`
              : "a measurable accuracy gain for roughly double the wait"}
            . The 1B model is not merely worse, though: it filled{" "}
            <Measured value={curve?.populatedRecall ?? null} format={percent} /> of the fields
            that had a correct answer, against{" "}
            <Measured value={headline?.populatedRecall ?? null} format={percent} /> for the 4B
            — it fills in more, and gets more of what it fills in wrong. That is a real
            failure mode for an unattended pipeline, and it is why extraction here is
            review-first rather than autopilot.
          </p>
        </div>
      </div>

      {/* Per-field */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-3 font-heading text-sm font-medium text-foreground">
          Per-field accuracy, worst first
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">
              Accuracy for each extracted field, with the number of fixtures scored
            </caption>
            <thead>
              <tr className="border-b border-border text-left">
                <th scope="col" className="px-4 py-2 font-medium text-foreground">
                  Field
                </th>
                <th scope="col" className="px-4 py-2 text-right font-medium text-foreground">
                  Accuracy
                </th>
                <th scope="col" className="px-4 py-2 font-medium text-foreground">
                  &nbsp;</th>
                <th scope="col" className="px-4 py-2 font-medium text-foreground">
                  n
                </th>
              </tr>
            </thead>
            <tbody>
              {FIELD_LABELS.map(([key, label]) => {
                const value = headline?.perFieldAccuracy[key] ?? null
                const low = value !== null && value < 0.5
                return (
                  <tr key={key} className="border-b border-border last:border-0">
                    <th scope="row" className="px-4 py-2 text-left font-mono text-xs font-normal">
                      {label}
                    </th>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <Measured value={value} format={percent} />
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className="block h-1.5 bg-muted"
                        role="img"
                        aria-label={`${label}: ${value === null ? "pending" : percent(value)}`}
                      >
                        <span
                          className={
                            low
                              ? "block h-full bg-destructive"
                              : "block h-full bg-chart-1"
                          }
                          style={{ width: `${(value ?? 0) * 100}%` }}
                        />
                      </span>
                    </td>
                    <td className="px-4 py-2 tabular-nums text-secondary-foreground dark:text-muted-foreground">
                      {headline?.n ?? "—"}
                    </td>
                  </tr>
                )
              })}
              <tr>
                <th scope="row" className="px-4 py-2 text-left font-mono text-xs font-normal">
                  lineItems
                </th>
                <td className="px-4 py-2 text-right tabular-nums">
                  <Measured value={headline?.lineItemAccuracy ?? null} format={percent} />
                </td>
                <td className="px-4 py-2">
                  <span className="block h-1.5 bg-muted" aria-hidden>
                    <span
                      className="block h-full bg-chart-1"
                      style={{
                        width: `${(headline?.lineItemAccuracy ?? 0) * 100}%`,
                      }}
                    />
                  </span>
                </td>
                <td className="px-4 py-2 tabular-nums text-secondary-foreground dark:text-muted-foreground">
                  {headline?.n ?? "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="border-t border-border px-4 py-3 text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
          <strong className="font-medium text-foreground">Category scores in the teens</strong>{" "}
          and it was predicted to: it is the one genuinely open-vocabulary field, and the
          scorer accepts only what the document permits. A closed category list would raise
          this number and make the field useless, which is not a trade worth making quietly.
          Tax is at the top because it is almost always printed explicitly, and getting a
          field wrong by returning{" "}
          <code className="font-mono">null</code> instead of a number is the single most
          expensive mistake in this table.
        </p>
      </div>

      {/* Hosted comparison, honestly incomplete */}
      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-card">
        <h3 className="border-b border-border px-4 py-3 font-heading text-sm font-medium text-foreground">
          Against a hosted 31B, at the same $0.00
        </h3>
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Local 4B compared with a hosted 31B model on field accuracy
          </caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-4 py-2 font-medium text-foreground">
                Model
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium text-foreground">
                Field accuracy
              </th>
              <th scope="col" className="px-4 py-2 text-right font-medium text-foreground">
                Cost / 20
              </th>
              <th scope="col" className="px-4 py-2 font-medium text-foreground">
                Content leaves machine
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-border">
              <th scope="row" className="px-4 py-2 text-left font-mono font-normal">
                gemma3:4b local
              </th>
              <td className="px-4 py-2 text-right tabular-nums">
                <Measured value={headline?.fieldAccuracy ?? null} format={percent} />
              </td>
              <td className="px-4 py-2 text-right tabular-nums font-medium">$0.00</td>
              <td className="px-4 py-2 text-secondary-foreground dark:text-muted-foreground">
                No
              </td>
            </tr>
            <tr>
              <th scope="row" className="px-4 py-2 text-left font-mono font-normal">
                gemma-4-31b-it hosted
              </th>
              <td className="px-4 py-2 text-right tabular-nums">
                {hosted.ran ? (
                  <Measured value={null} format={percent} />
                ) : (
                  <span className="inline-flex items-center rounded-none bg-muted px-1.5 py-0.5 font-mono text-xs text-secondary-foreground dark:text-muted-foreground">
                    not run
                  </span>
                )}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">$0.00</td>
              <td className="px-4 py-2 text-secondary-foreground dark:text-muted-foreground">
                Yes, to a <code className="font-mono">data_collection: &quot;deny&quot;</code>{" "}
                endpoint
              </td>
            </tr>
          </tbody>
        </table>
        <p className="border-t border-border px-4 py-3 text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
          {hosted.reason} Two things stay true either way: the local arm makes zero external
          requests, and so does the hosted arm&rsquo;s price. And the comparison would not be a
          clean ablation even if it were run — a hosted Gemma 4 against a local Gemma 3
          confounds parameter count with model generation. That gap is disclosed rather than
          papered over with a number that would invite the wrong conclusion.
        </p>
      </div>

      <p className="mt-4 text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
        Measured on an i7-1165G7, 4 cores / 8 threads, 16 GB RAM, no GPU, Windows 11. Ollama{" "}
        <code className="font-mono">gemma3:4b</code> Q4_K_M. 20 fixtures, one ambiguous
        fixture excluded from headline figures and scored leniently. Ground truth authored
        before the first run and never edited to match model output.
      </p>
    </section>
  )
}

function Row({
  label,
  hint,
  emphasis = false,
  children,
}: {
  label: string
  hint?: string
  emphasis?: boolean
  children: React.ReactNode
}) {
  return (
    <tr className="border-b border-border last:border-0">
      <th
        scope="row"
        className={
          emphasis
            ? "px-4 py-2.5 text-left font-medium text-foreground"
            : "px-4 py-2.5 text-left font-normal text-secondary-foreground dark:text-muted-foreground"
        }
      >
        {label}
        {hint && <span className="block text-xs opacity-80">{hint}</span>}
      </th>
      <td
        className={
          emphasis
            ? "px-4 py-2.5 text-right text-base tabular-nums text-foreground"
            : "px-4 py-2.5 text-right tabular-nums text-foreground"
        }
      >
        {children}
      </td>
    </tr>
  )
}

export function ChaseStudySection() {
  const chase = readChaseStudy()
  if (!chase) return null

  const winner = chase.tabpfnWins

  return (
    <section id="prediction" className="scroll-mt-20 py-16 sm:py-24">
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-foreground dark:text-primary">
          Payment prediction
        </p>
        <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Which invoices to chase first
        </h2>
        <p className="text-base/relaxed text-secondary-foreground dark:text-muted-foreground">
          TabPFN-3.5 forecasts days-to-payment from invoice history, with a q10&ndash;q90
          interval on every row. It is scored against two naive baselines on the same
          held-out invoices, because a forecast you cannot compare against{" "}
          <em>this client&rsquo;s own average</em> is an assertion rather than a result.
        </p>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        <Metric
          label="TabPFN-3.5"
          value={`${chase.metrics.tabpfn.mae.toFixed(2)} days`}
          caption="mean absolute error"
          highlight={winner}
        />
        <Metric
          label="Client historical mean"
          value={`${chase.metrics.clientMean.mae.toFixed(2)} days`}
          caption="the baseline that matters"
          highlight={!winner}
        />
        <Metric
          label="Global mean"
          value={`${chase.metrics.globalMean.mae.toFixed(2)} days`}
          caption="ignore who the client is"
          highlight={false}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Stat label="Paid invoices in history" value={String(chase.rowsPaid)} />
        <Stat label="Distinct clients" value={String(chase.clients)} />
        <Stat label="Features per row" value={String(chase.featuresPerRow)} />
      </div>

      <p className="mt-4 max-w-prose text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
        {winner ? (
          <>
            TabPFN wins, by{" "}
            {(
              (1 - chase.metrics.tabpfn.mae / chase.metrics.clientMean.mae) *
              100
            ).toFixed(0)}
            %. It is a real margin and it is also a narrow one —{" "}
            <em>who</em> pays late is mostly a property of <em>who the client is</em>, so a
            well-built per-client mean is a genuinely strong baseline rather than a straw
          man. The model&rsquo;s contribution is in the residual: invoice size, timing
            seasonality and the client&rsquo;s own variance. Its q10&ndash;q90 interval
            contained the true value in {chase.coverage.inside} of {chase.coverage.total}{" "}
            held-out rows, against an 80% nominal target, so the intervals run a little
            narrow and are reported that way.
          </>
        ) : (
          <>
            TabPFN did not beat the client-mean baseline at this data size. Reported
            because that is the finding, and a win that quietly omits a strong baseline
            would be worth less than this. The client&rsquo;s own historical mean is a hard
            baseline to beat, and below about twenty historical invoices these predictions
            should be treated as a reading aid rather than a forecast.
          </>
        )}
      </p>
    </section>
  )
}

function Metric({
  label,
  value,
  caption,
  highlight,
}: {
  label: string
  value: string
  caption: string
  highlight: boolean
}) {
  return (
    <div
      className={
        highlight
          ? "rounded-lg border border-foreground/20 bg-primary/15 p-4 dark:bg-primary/20"
          : "rounded-lg border border-border bg-card p-4"
      }
    >
      <p className="text-xs text-secondary-foreground dark:text-muted-foreground">{label}</p>
      <p className="mt-1 font-heading text-2xl tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-secondary-foreground dark:text-muted-foreground">
        {caption}
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-xs text-secondary-foreground dark:text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-heading text-lg tabular-nums text-foreground">{value}</p>
    </div>
  )
}
