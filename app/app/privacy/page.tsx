import { AppShell } from "@/components/app-shell"
import { PrivacySection } from "@/components/landing/sections"

const PRINCIPLES = [
  {
    title: "Local by default",
    body: "The extraction path performs zero external network calls with document content, and works with the network disconnected after the model download.",
  },
  {
    title: "No retention",
    body: "Documents are processed in memory and never written to disk. There is no document store to breach because there is no document store.",
  },
  {
    title: "Minimise what leaves",
    body: "Where an external call is unavoidable, the payload is the smallest viable projection of the data: numbers and a hash, or redacted text on an explicitly confirmed route.",
  },
  {
    title: "State the caveats",
    body: "Where a provider's terms work against the user, the product says so instead of hiding it. The hosted route controls which endpoints are eligible; it does not control what every intermediary does.",
  },
]

const CHECKLIST = [
  "Every build artifact greps clean for OPENROUTER_API_KEY, TABPFN_API_KEY and MONGODB_URI",
  "DevTools network panel during local extraction shows only 127.0.0.1",
  "Disconnecting the network after the model download does not break local extraction",
  "Sentry transactions contain no document text, client names or amounts",
  "No uploaded file is written to disk or into an upload directory",
  "Atlas sync is off on a fresh load",
  "Atlas collections contain no image or raw-text fields",
]

export default function PrivacyPage() {
  return (
    <AppShell
      title="Data handling"
      description="This is the product's thesis rather than its documentation. Every claim here is enforced by code, and each one is written so that you can check it yourself."
    >
      <section className="grid gap-3 sm:grid-cols-2">
        {PRINCIPLES.map((principle) => (
          <div key={principle.title} className="rounded-lg border border-border bg-card p-4">
            <h2 className="font-heading text-sm font-medium text-foreground">
              {principle.title}
            </h2>
            <p className="mt-1.5 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
              {principle.body}
            </p>
          </div>
        ))}
      </section>

      <PrivacySection />

      <section id="verify" className="scroll-mt-20 py-4">
        <h2 className="font-heading text-xl font-medium tracking-tight text-foreground">
          Verification checklist
        </h2>
        <p className="mt-2 max-w-prose text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
          These were all confirmed before the challenge submission. They are listed so that
          you can run them yourself rather than take the word of the person who wrote the
          app.
        </p>
        <ul className="mt-4 flex flex-col gap-1.5">
          {CHECKLIST.map((item) => (
            <li
              key={item}
              className="flex gap-2 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground"
            >
              <span aria-hidden>✓</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="py-4">
        <h2 className="font-heading text-xl font-medium tracking-tight text-foreground">
          Deliberately absent
        </h2>
        <ul className="mt-3 grid gap-1.5 text-sm/relaxed text-secondary-foreground dark:text-muted-foreground sm:grid-cols-2">
          {[
            "No accounts, no login, no per-user identity",
            "No payment collection",
            "No analytics on document content",
            "No error reporting that attaches file contents",
            "No cloud persistence by default",
            "No document storage of any kind",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden>—</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-prose text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
          MongoDB Atlas is used only if you explicitly opt in, and only to store extracted
          fields. It is not connected by default, and the app behaves identically when it is
          unreachable. Atlas free clusters also pause after 30 days of inactivity, which is
          irrelevant for a challenge demo but is worth knowing before relying on one.
        </p>
      </section>
    </AppShell>
  )
}