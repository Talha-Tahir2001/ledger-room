import Link from "next/link"

const COLUMNS = [
  {
    title: "Product",
    links: [
      { href: "/app", label: "Upload" },
      { href: "/app/review", label: "Review and export" },
      { href: "/app/chase", label: "Chase list" },
      { href: "/app/methodology", label: "Accuracy study" },
    ],
  },
  {
    title: "Project",
    links: [
      { href: "/app/privacy", label: "Data handling" },
      { href: "/app/privacy#verify", label: "How to verify" },
      { href: "https://github.com", label: "Source" },
      {
        href: "https://dev.to/tags/hf26challenge",
        label: "Hacktoberfest challenge",
      },
    ],
  },
]

const ATTRIBUTION = [
  "Next.js",
  "Tailwind CSS",
  "shadcn/ui (Base UI)",
  "Ollama",
  "Google Gemma 3 weights",
  "Tesseract",
  "TabPFN (Prior Labs)",
  "MongoDB Atlas",
  "Sentry",
  "pdf.js",
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-12">
      <div className="grid gap-8 md:grid-cols-3">
        <div className="flex flex-col gap-2">
          <p className="font-heading text-sm font-medium text-foreground">Ledger</p>
          <p className="max-w-xs text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
            A local-first invoice and receipt sorter for freelancers, with a measured accuracy
            study of what the privacy costs.
          </p>
          <p className="mt-2 text-xs text-secondary-foreground dark:text-muted-foreground">
            MIT licensed. Built for the Hacktoberfest Open-Source AI Challenge.
          </p>
        </div>

        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title} className="flex flex-col gap-2">
            <p className="font-heading text-xs font-medium uppercase tracking-widest text-foreground">
              {column.title}
            </p>
            <ul className="flex flex-col gap-1.5">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="rounded-sm text-xs text-secondary-foreground underline-offset-4 transition-colors hover:text-primary-foreground hover:underline focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:text-muted-foreground dark:hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-10 border-t border-border pt-6">
        <p className="text-xs text-secondary-foreground dark:text-muted-foreground">
          Built with{" "}
          {ATTRIBUTION.map((name, index) => (
            <span key={name}>
              {index > 0 && ", "}
              {name}
            </span>
          ))}
          .
        </p>
        <p className="mt-2 max-w-prose text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
          Every fixture is synthetic. No real client invoice was ever committed to this
          repository or sent anywhere.
        </p>
      </div>
    </footer>
  )
}
