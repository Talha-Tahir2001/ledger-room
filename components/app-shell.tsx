"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"

import { RuntimeProvider } from "@/components/runtime-provider"
import { ThemeToggle } from "@/components/landing/theme-toggle"
import { Button } from "@/components/ui/button"
import { cn } from "cn"

const APP_NAV = [
  { href: "/app", label: "Upload" },
  { href: "/app/review", label: "Review" },
  { href: "/app/chase", label: "Chase list" },
  { href: "/app/methodology", label: "Accuracy study" },
  { href: "/app/privacy", label: "Privacy" },
]

export function AppShell({
  children,
  title,
  description,
}: {
  children: React.ReactNode
  title: string
  description: string
}) {
  return (
    <RuntimeProvider>
      <div className="mx-auto flex min-h-svh w-full max-w-72rem flex-col px-4 sm:px-6">
        <AppHeader />
        <main className="flex flex-1 flex-col gap-6 py-6">
          <header className="flex flex-col gap-1.5">
            <h1 className="font-heading text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
              {title}
            </h1>
            <p className="max-w-prose text-sm/relaxed text-secondary-foreground dark:text-muted-foreground">
              {description}
            </p>
          </header>
          {children}
        </main>
        <AppFooter />
      </div>
    </RuntimeProvider>
  )
}

function AppHeader() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-40 -mx-4 border-b border-border bg-background/85 px-4 backdrop-blur sm:-mx-6 sm:px-6">
      <div className="mx-auto flex h-14 max-w-72rem items-center justify-between gap-4">
        <Link
          href="/"
          className="shrink-0 font-heading text-sm font-medium tracking-tight text-foreground"
        >
          Ledger
        </Link>

        <nav aria-label="App sections" className="min-w-0 flex-1">
          {/* Scrolls rather than wraps: five items plus a toggle will not fit a
              phone, and a wrapped nav pushes the whole page down on every
              route change. */}
          <ul className="flex items-center gap-1 overflow-x-auto">
            {APP_NAV.map((item) => {
              const active = pathname === item.href
              return (
                <li key={item.href} className="shrink-0">
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-7 items-center rounded-md px-2 text-xs transition-colors focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-secondary-foreground hover:bg-muted hover:text-foreground dark:text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <ThemeToggle />
          {/* `nativeButton={false}` because this renders an <a>, not a
              <button>. Base UI defaults to expecting real button semantics,
              and without this it logs and loses keyboard activation. */}
          <Button
            variant="outline"
            size="xs"
            nativeButton={false}
            render={<Link href="/">Home</Link>}
          >
            Home
          </Button>
        </div>
      </div>
    </header>
  )
}

function AppFooter() {
  return (
    <footer className="border-t border-border py-6 text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
      <p className="max-w-prose">
        Documents are processed on your device and are not stored or sent anywhere. If you
        turn on sync, only the extracted fields are saved, never the file itself. Payment
        prediction is the only feature that contacts an external service, and it sends
        numbers with hashed client names. Open the network tab and check.
      </p>
      <p className="mt-3">
        <Link href="/app/privacy" className="underline underline-offset-4">
          How to verify this
        </Link>
        <span aria-hidden> · </span>
        <Link href="/app/methodology" className="underline underline-offset-4">
          Accuracy study
        </Link>
      </p>
    </footer>
  )
}