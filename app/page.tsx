import Link from "next/link"

import { AccuracyStudy, ChaseStudySection } from "@/components/landing/accuracy-study"
import {
  ClosingCta,
  Faq,
  HowItWorks,
  PrivacySection,
  Pricing,
  Problem,
} from "@/components/landing/sections"
import { SiteFooter } from "@/components/landing/site-footer"
import { LandingThemeToggle } from "@/components/landing/theme-toggle"

const NAV = [
  { href: "#how", label: "How it works" },
  { href: "#accuracy", label: "Accuracy" },
  { href: "#prediction", label: "Prediction" },
  { href: "#privacy", label: "Privacy" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
]

/**
 * The landing page. A server component, so the content above the fold and the
 * study below it render without any client JavaScript at all — the theme toggle
 * is the only island (DESIGN.md §8, NFR-12).
 */
export default function LandingPage() {
  return (
    <div className="mx-auto w-full max-w-72rem px-4 sm:px-6">
      <header className="sticky top-0 z-50 -mx-4 border-b border-border bg-background/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto flex h-14 max-w-72rem items-center justify-between gap-4">
          <Link
            href="/"
            className="shrink-0 rounded-sm font-heading text-sm font-medium tracking-tight text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            Ledger
          </Link>

          <nav aria-label="Sections" className="min-w-0 flex-1">
            <ul className="flex items-center justify-center gap-1 overflow-x-auto">
              {NAV.map((item) => (
                <li key={item.href} className="shrink-0">
                  <a
                    href={item.href}
                    className="inline-flex h-7 items-center rounded-md px-2 text-xs text-secondary-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:text-muted-foreground"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex shrink-0 items-center gap-1.5">
            <LandingThemeToggle />
            <a
              href="/app"
              className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              Open the app
            </a>
          </div>
        </div>
      </header>

      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <AccuracyStudy />
        <ChaseStudySection />
        <PrivacySection />
        <Pricing />
        <Faq />
        <ClosingCta />
      </main>

      <SiteFooter />
    </div>
  )
}

function Hero() {
  return (
    <section className="py-16 sm:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center">
        <div className="flex flex-col gap-5">
          <p className="font-mono text-xs uppercase tracking-widest text-primary-foreground dark:text-primary">
            Local-first · open-weight · measured
          </p>
          <h1 className="font-heading text-4xl font-medium leading-[1.1] tracking-tight text-foreground sm:text-5xl">
            An invoice sorter that keeps your clients&rsquo; names off the internet
          </h1>
          <p className="max-w-prose text-lg/relaxed text-secondary-foreground dark:text-muted-foreground">
            Drop a folder of invoices and receipts. Ledger reads each one, extracts eleven
            typed fields with a 4B open-weight model running on your own CPU, shows you which
            fields to double-check, and exports a CSV your accountant accepts — for{" "}
            <strong className="font-medium text-foreground">$0.00</strong>.
          </p>
          <p className="max-w-prose text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
            A 31B hosted model is also free, and it is more accurate. We measured both, and
            the table is on this page.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="/app"
              className="inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              Open the app
            </a>
            <a
              href="#accuracy"
              className="inline-flex h-10 items-center rounded-md border border-border bg-background px-5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
            >
              See the accuracy study
            </a>
          </div>

          <dl className="grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-5">
            <HeroStat label="Field accuracy" value="66.2%" note="local 4B, CPU only" />
            <HeroStat label="Schema violations" value="0" note="across 20 fixtures" />
            <HeroStat label="Cost per 20" value="$0.00" note="and no upload" />
          </dl>
        </div>

        <HeroVisual />
      </div>
    </section>
  )
}

function HeroStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <dt className="text-xs text-secondary-foreground dark:text-muted-foreground">{label}</dt>
      <dd className="font-heading text-xl tabular-nums text-foreground">{value}</dd>
      <dd className="text-xs text-secondary-foreground dark:text-muted-foreground">{note}</dd>
    </div>
  )
}

/**
 * A static depiction of the review table, rendered from real fixture output so
 * the hero shows the product rather than describing it (DESIGN.md §1.4).
 */
function HeroVisual() {
  const rows = [
    { file: "NW-2026-0431.pdf", vendor: "NORTHWIND ANALYTICS", total: "781.20", score: 92, path: "text layer" },
    { file: "1P-8842.pdf", vendor: "INKWELL PRINT SHOP", total: "480.00", score: 41, path: "OCR" },
    { file: "RM-2026-330871.pdf", vendor: "TELIA MOBIL", total: "46.92", score: 88, path: "text layer" },
    { file: "HC-2026-0219.pdf", vendor: "HARLAN & CO LLP", total: "3,188.50", score: 57, path: "OCR" },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="font-heading text-xs font-medium text-foreground">Review</p>
        <span className="inline-flex items-center gap-1.5 rounded-none bg-primary/15 px-2 py-0.5 text-xs text-primary-foreground dark:bg-primary/20 dark:text-primary">
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          Local runtime · gemma3:4b · on this machine
        </span>
      </div>

      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">
          An example of the review table, showing real output from the fixture corpus
        </caption>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col" className="px-4 py-2 font-medium text-foreground">
              Document
            </th>
            <th scope="col" className="px-4 py-2 font-medium text-foreground">
              Vendor
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium text-foreground">
              Total
            </th>
            <th scope="col" className="px-4 py-2 text-right font-medium text-foreground">
              Check
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.file} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-mono text-secondary-foreground dark:text-muted-foreground">
                {row.file}
                <span className="ml-1.5 text-[10px] opacity-80">({row.path})</span>
              </td>
              <td className="px-4 py-2 text-foreground">{row.vendor}</td>
              <td className="px-4 py-2 text-right tabular-nums text-foreground">{row.total}</td>
              <td className="px-4 py-2 text-right">
                <span
                  className={
                    row.score < 50
                      ? "inline-flex items-center gap-1 rounded-none bg-destructive/10 px-1.5 py-0.5 tabular-nums text-destructive dark:bg-destructive/20"
                      : "inline-flex items-center gap-1 rounded-none px-1.5 py-0.5 tabular-nums text-secondary-foreground dark:text-muted-foreground"
                  }
                >
                  {row.score < 50 && <span aria-hidden>⚠</span>}
                  {row.score}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="border-t border-border px-4 py-3 text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
        The Check column is a review-priority score out of 100, not a probability. Rows read
        by OCR are marked, because that changes how much they deserve trust.
      </p>
    </div>
  )
}
