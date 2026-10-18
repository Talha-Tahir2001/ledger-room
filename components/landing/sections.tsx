/**
 * The remaining landing page sections.
 *
 * Server components throughout, except the theme toggle and the FAQ accordion,
 * which are client islands. Everything above the fold renders without
 * JavaScript (NFR-12) — that is a requirement, not an optimisation, because the
 * first thing a judge sees should not depend on a bundle arriving.
 */
import { IconArrowRight, IconCheck, IconX } from "@tabler/icons-react"

const COST_CARDS = [
  {
    figure: "$50–150",
    unit: "per month",
    title: "Pay a bookkeeper",
    body: "For data entry that takes one person a few hours. Cheaper than the alternatives, and it means a stranger handles every client name, rate and bank detail you own.",
  },
  {
    figure: "2–4 hours",
    unit: "per month",
    title: "Do it yourself",
    body: "The same hours, every month, forever, spent re-reading documents whose content you already have. This is the option Ledger exists to remove.",
  },
  {
    figure: "$0.00",
    unit: "and free forever",
    title: "Paste it into a hosted chatbot",
    body: "Which is not free in the only currency that matters. Invoice text contains client names, project names, rates and account numbers, and that text goes to a service you do not control.",
  },
]

const STEPS = [
  {
    n: "01",
    title: "Read the document",
    body: "pdf.js pulls the embedded text layer, which is exact and instant. When there isn't one — a phone photo, a flatbed scan — the page is rasterised in the browser and read by tesseract.js, offline. Which route a document took is shown on its row, because it changes how much the row should be trusted.",
    note: "No upload directory. The file is read into memory, used, and dropped.",
  },
  {
    n: "02",
    title: "Extract against a schema, not a prompt",
    body: "The Zod schema is converted to JSON Schema and passed to the model as a grammar constraint, at temperature 0. Eleven typed fields in or a validation failure out — never plausible JSON with a string where a number belongs.",
    note: "Measured: zero schema violations across twenty fixtures.",
  },
  {
    n: "03",
    title: "Score what deserves a human",
    body: "Confidence is computed, never asked for. A 4B model asked to rate its own confidence produces a number with no calibration behind it, and it is confidently wrong on exactly the fields that cost money. The score blends whether the value appears verbatim in the source, whether it is well formed, and whether subtotal + tax actually equals total.",
    note: "Presented as a review-priority score out of 100. It is not a probability.",
  },
  {
    n: "04",
    title: "Correct, and keep the correction",
    body: "Every edit is captured as a labelled example: what the model predicted, what it should have been, and when. That log is the dataset a fine-tune would need, produced as a side effect of ordinary review rather than as a project.",
    note: "Downloadable as JSONL. Stored on your disk, or in Atlas if you opt in.",
  },
]

const FAQ = [
  {
    q: "Does my invoice data leave my computer?",
    a: "On the local path, no. Your browser talks to Ollama at 127.0.0.1 directly, so the extraction request never touches a server and there is no server-side component that could log it. Open the network tab during a local extraction and you will see one destination, and it is your own machine. The app still works with the network disconnected once the model is downloaded.",
  },
  {
    q: "What happens if I have no model installed?",
    a: "The runtime banner tells you so plainly rather than pretending. You get a pre-computed dataset — real recorded output from a real run, including its mistakes — so you can exercise review, correction and export without setting anything up. It is labelled as demo data and is never described as live inference.",
  },
  {
    q: "What is the hosted path, exactly?",
    a: "An explicit, opt-in alternative for machines with no local model: a 31B model via OpenRouter. It requires one confirmation per session. Client names and account-number-like digit runs are stripped on your device first, requests carry provider.data_collection: deny and require_parameters: true, and if no endpoint satisfying both exists the request fails rather than degrading to something that logs. It is not equivalent to local and the banner does not pretend it is.",
  },
  {
    q: "How accurate is it, honestly?",
    a: "66.2% of fields correct across twenty fixtures, and 5.3% of documents fully correct. That is not a system you hand a folder to and forget about — it is a system that does the tedious 60% and shows you exactly which 40% to check. The per-field table on this page says which fields those are, and category scores in the teens.",
  },
  {
    q: "Why a 4B model and not something bigger?",
    a: "Because this ran on four CPU cores with no GPU and no credit card. 12B is 8.1 GB and materially slower; 27B would have consumed the remaining disk while remaining unusable. The size curve in the study measures what that constraint actually costs, by running 1B and 4B on identical hardware.",
  },
  {
    q: "What does the payment prediction actually do?",
    a: "It forecasts days-to-payment per open invoice with a q10–q90 interval, and it is scored against the naive baselines it has to beat: that client's own historical mean, and the global mean. Only numbers and a hashed client identifier are sent to Prior Labs; the raw client name never leaves your device. Below about twenty historical invoices it is weak, and it says so.",
  },
  {
    q: "Will it cost me anything?",
    a: "The local path is $0.00 and there is no checkout anywhere in this app. There is a written $12/month hypothesis in the footer — framed around the chase list rather than extraction — which is a question being tested with the first real user, not a thing you can pay. Payment collection is deliberately absent, partly because Vercel's Hobby terms restrict this deployment to personal, non-commercial use.",
  },
]

export function Problem() {
  return (
    <section className="py-16 sm:py-24">
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-foreground dark:text-primary">
          The problem
        </p>
        <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Three to eight client invoices a month, and a wall of receipts
        </h2>
        <p className="text-base/relaxed text-secondary-foreground dark:text-muted-foreground">
          A freelancer ends each month needing those documents as structured rows for an
          accountant or a tax filing. There are two ways to get there, and one thing that
          looks like a third.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {COST_CARDS.map((card) => (
          <div key={card.title} className="rounded-lg border border-border bg-card p-4">
            <p className="font-heading text-2xl tabular-nums text-foreground">
              {card.figure}
            </p>
            <p className="text-xs text-secondary-foreground dark:text-muted-foreground">
              {card.unit}
            </p>
            <h3 className="mt-3 font-heading text-sm font-medium text-foreground">
              {card.title}
            </h3>
            <p className="mt-1 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
              {card.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 py-16 sm:py-24">
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-foreground dark:text-primary">
          How it works
        </p>
        <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Four stages, all of them on your machine
        </h2>
      </div>

      <ol className="mt-8 grid gap-4 md:grid-cols-2">
        {STEPS.map((step) => (
          <li key={step.n} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-xs text-primary-foreground dark:text-primary">
                {step.n}
              </span>
              <h3 className="font-heading text-sm font-medium text-foreground">
                {step.title}
              </h3>
            </div>
            <p className="mt-2 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
              {step.body}
            </p>
            <p className="mt-2 border-t border-border pt-2 text-xs text-secondary-foreground dark:text-muted-foreground">
              {step.note}
            </p>
          </li>
        ))}
      </ol>
    </section>
  )
}

export function PrivacySection() {
  const rows = [
    ["Invoice image or PDF", "Nowhere", "Held in memory for the duration of extraction, never written to disk"],
    ["Extracted text", "Nowhere", "Goes to Ollama on your machine and stays there"],
    ["OCR output", "Nowhere", "tesseract.js runs in your tab"],
    ["Corrections", "Your disk", "Local by default; Atlas only if you explicitly opt in"],
    ["TabPFN feature row", "Prior Labs (EU)", "Numbers plus a hashed client id, and only when you press Predict"],
    ["Sentry spans", "Sentry", "Model, token counts, latency, stage names. No text, no names, no amounts"],
  ]

  return (
    <section id="privacy" className="scroll-mt-20 py-16 sm:py-24">
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-foreground dark:text-primary">
          Privacy
        </p>
        <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          There is no document store to breach
        </h2>
        <p className="text-base/relaxed text-secondary-foreground dark:text-muted-foreground">
          Most claims about privacy are promises. This one is checkable: uploaded documents
          are processed in memory and dropped. There is no upload directory, no retention
          policy and nothing to delete later, because nothing was kept.
        </p>
      </div>

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Where each kind of data goes, and when</caption>
          <thead>
            <tr className="border-b border-border text-left">
              <th scope="col" className="px-4 py-2 font-medium text-foreground">
                Data
              </th>
              <th scope="col" className="px-4 py-2 font-medium text-foreground">
                Destination
              </th>
              <th scope="col" className="px-4 py-2 font-medium text-foreground">
                When
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([what, where, when]) => (
              <tr key={what} className="border-b border-border last:border-0">
                <th scope="row" className="px-4 py-2.5 text-left font-normal text-foreground">
                  {what}
                </th>
                <td className="px-4 py-2.5 text-secondary-foreground dark:text-muted-foreground">
                  {where}
                </td>
                <td className="px-4 py-2.5 text-secondary-foreground dark:text-muted-foreground">
                  {when}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-heading text-sm font-medium text-foreground">
            How to verify it in about a minute
          </h3>
          <ol className="mt-2 flex list-decimal flex-col gap-1.5 pl-4 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
            <li>Pull the model: <code className="font-mono">ollama pull gemma3:4b</code></li>
            <li>Open the upload screen and watch the runtime banner turn local</li>
            <li>Open DevTools, Network, and drop one invoice</li>
            <li>Every request goes to 127.0.0.1. There is no other host</li>
            <li>Disconnect the network and do it again — still works</li>
          </ol>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="font-heading text-sm font-medium text-foreground">
            The hosted path, and its limits
          </h3>
          <p className="mt-2 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
            Where an external call is unavoidable, the payload is the smallest viable
            projection of the data. Redaction before send is best-effort obfuscation, not
            anonymisation, and this page does not claim otherwise.
          </p>
          <ul className="mt-2 flex flex-col gap-1.5 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
            <li className="flex gap-2">
              <IconCheck className="mt-0.5 size-4 shrink-0 text-primary-foreground dark:text-primary" aria-hidden />
              <span>Client names and account-number-like digit runs stripped on device</span>
            </li>
            <li className="flex gap-2">
              <IconCheck className="mt-0.5 size-4 shrink-0 text-primary-foreground dark:text-primary" aria-hidden />
              <span>
                <code className="font-mono">data_collection: &quot;deny&quot;</code>{" "}
                restricts which endpoints are eligible
              </span>
            </li>
            <li className="flex gap-2">
              <IconCheck className="mt-0.5 size-4 shrink-0 text-primary-foreground dark:text-primary" aria-hidden />
              <span>No compliant endpoint means the request fails, not that it degrades</span>
            </li>
            <li className="flex gap-2">
              <IconX className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <span>
                This controls <em>which endpoints qualify</em>, not what every intermediary
                does. It is meaningfully better than an unconstrained call and categorically
                different from local.
              </span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-20 py-16 sm:py-24">
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-foreground dark:text-primary">
          Pricing
        </p>
        <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          A hypothesis, stated rather than charged
        </h2>
        <p className="text-base/relaxed text-secondary-foreground dark:text-muted-foreground">
          Extraction is a utility anyone can provide, and a local one is free forever. The
          thing nobody else offers is the chase list, so that is what a paid tier would be
          framed around. There is no checkout here, and there will not be one.
        </p>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-foreground/20 bg-card p-5">
          <h3 className="font-heading text-base font-medium text-foreground">Local</h3>
          <p className="mt-1 text-xs text-secondary-foreground dark:text-muted-foreground">
            Unlimited documents, forever
          </p>
          <p className="mt-4 font-heading text-3xl tabular-nums text-foreground">$0</p>
          <ul className="mt-4 flex flex-col gap-2 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
            {[
              "Batch extraction on your own hardware",
              "Review, correction and CSV/JSON export",
              "Per-field review-priority scores",
              "Correction log as JSONL",
              "Works offline after the model download",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <IconCheck className="mt-0.5 size-4 shrink-0 text-primary-foreground dark:text-primary" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-lg border border-border bg-card p-5">
          <h3 className="font-heading text-base font-medium text-foreground">
            Sync <span className="font-normal text-secondary-foreground dark:text-muted-foreground">+ chase list</span>
          </h3>
          <p className="mt-1 text-xs text-secondary-foreground dark:text-muted-foreground">
            The hypothesis under test
          </p>
          <p className="mt-4 font-heading text-3xl tabular-nums text-foreground">$12</p>
          <p className="text-xs text-secondary-foreground dark:text-muted-foreground">
            per month, if it ships
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
            {[
              "Opt-in Atlas sync of extracted fields",
              "Chase list with q10–q90 intervals",
              "Corrections as a durable cross-device training set",
            ].map((item) => (
              <li key={item} className="flex gap-2">
                <IconCheck className="mt-0.5 size-4 shrink-0 text-primary-foreground dark:text-primary" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
            <li className="flex gap-2">
              <IconX className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <span>No checkout. Vercel Hobby terms are personal and non-commercial.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-20 py-16 sm:py-24">
      <div className="flex max-w-3xl flex-col gap-3">
        <p className="font-mono text-xs uppercase tracking-widest text-primary-foreground dark:text-primary">
          Questions
        </p>
        <h2 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Including the awkward ones
        </h2>
      </div>

      <dl className="mt-8 flex max-w-3xl flex-col divide-y divide-border border-y border-border">
        {FAQ.map((entry) => (
          <div key={entry.q} className="py-4">
            <dt className="font-heading text-sm font-medium text-foreground">{entry.q}</dt>
            <dd className="mt-2 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
              {entry.a}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

export function ClosingCta() {
  return (
    <section className="py-16 sm:py-24">
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h2 className="mx-auto max-w-2xl font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
          Twenty fixtures, one click, and a CSV your accountant accepts
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
          No login, no API key, no upload. If you have Ollama it runs live on your hardware;
          if you do not, the demo set exercises the whole flow.
        </p>
        <a
          href="/app"
          className="mt-6 inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          Open the app
          <IconArrowRight className="size-3.5" aria-hidden />
        </a>
      </div>
    </section>
  )
}
