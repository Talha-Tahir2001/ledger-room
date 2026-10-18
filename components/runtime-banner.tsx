"use client"

import * as React from "react"
import { IconAlertTriangle, IconCloudOff, IconCpu, IconInfoCircle, IconRefresh } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRuntime } from "@/components/runtime-provider"

/**
 * Honest chrome, designed as a first-class component rather than an error
 * afterthought (DESIGN.md §1.5).
 *
 * It names the active provider, says where the data goes, and — critically —
 * never describes the demo dataset as live inference.
 */
export function RuntimeBanner({ compact = false }: { compact?: boolean }) {
  const runtime = useRuntime()

  if (runtime.state === "checking") {
    return (
      <BannerShell tone="neutral" label="Checking runtimes" role="status">
        Looking for a local model on this machine.
      </BannerShell>
    )
  }

  if (runtime.state === "local") {
    return (
      <BannerShell
        tone="good"
        role="status"
        label="Local runtime"
        icon={<IconCpu className="size-3.5" aria-hidden />}
        badge={
          <Badge variant="outline" className="tabular-nums">
            {runtime.localModel}
          </Badge>
        }
        action={
          <Button variant="ghost" size="xs" onClick={runtime.refresh} aria-label="Re-check runtimes">
            <IconRefresh className="size-3" aria-hidden />
            Re-check
          </Button>
        }
      >
        Nothing leaves your device. Documents are read in this tab, extracted by
        {` ${runtime.localModel} `}on {runtime.localUrl}, and never written to disk. This
        request goes straight from your browser to your own machine and is never proxied
        through a server.
      </BannerShell>
    )
  }

  if (runtime.state === "hosted") {
    const hosted = runtime.hosted
    const quotaLow = hosted ? hosted.remainingToday <= 5 : false

    return (
      <BannerShell
        tone={runtime.hostedConsent ? "warn" : "warn"}
        role="status"
        label="Hosted runtime"
        icon={<IconInfoCircle className="size-3.5" aria-hidden />}
        badge={
          hosted ? (
            <Badge variant="outline" className="tabular-nums">
              at least {hosted.remainingToday}/{hosted.dailyAllowance} hosted requests left today
            </Badge>
          ) : null
        }
        action={
          <Button variant="ghost" size="xs" onClick={runtime.refresh} aria-label="Re-check runtimes">
            <IconRefresh className="size-3" aria-hidden />
            Re-check
          </Button>
        }
      >
        <strong className="font-medium text-foreground">
          No local model found on this machine.
        </strong>{" "}
        {hosted?.provider} is available as an explicit alternative. Before the first
        document: client names and account-number-like digit runs are stripped on this
        device, and requests are routed only to endpoints that publish{" "}
        <code className="font-mono">data_collection: &quot;deny&quot;</code>. If no
        compliant endpoint exists the request fails rather than routing somewhere that logs.
        {quotaLow ? " The shared allowance is nearly spent." : ""}
      </BannerShell>
    )
  }

  if (runtime.state === "blocked") {
    const hosted = runtime.hosted
    return (
      <BannerShell
        tone="bad"
        role="status"
        label="Hosted quota spent"
        icon={<IconAlertTriangle className="size-3.5" aria-hidden />}
        badge={
          hosted ? (
            <Badge variant="outline" className="tabular-nums">
              resets {new Date(hosted.resetsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Badge>
          ) : null
        }
        action={
          <Button variant="ghost" size="xs" onClick={runtime.refresh} aria-label="Re-check runtimes">
            <IconRefresh className="size-3" aria-hidden />
            Re-check
          </Button>
        }
      >
        The hosted allowance is spent for today, and a spent allowance does not recover by
        retrying. To run extraction for real, install Ollama and pull{" "}
        <code className="font-mono">{runtime.localModel}</code> — then the whole app runs
        locally and this stops mattering.
      </BannerShell>
    )
  }

  return (
    <BannerShell
      tone="neutral"
      role="status"
      label="Demo data"
      icon={<IconCloudOff className="size-3.5" aria-hidden />}
      badge={<Badge variant="outline">pre-computed</Badge>}
      action={
        <Button variant="ghost" size="xs" onClick={runtime.refresh} aria-label="Re-check runtimes">
          <IconRefresh className="size-3" aria-hidden />
          Re-check
        </Button>
      }
    >
      <strong className="font-medium text-foreground">
        No runtime was available on this machine.
      </strong>{" "}
      What you see is the pre-computed results for the fixture set — real model output,
      recorded once, not live inference. Review, correction and export all work normally.
      {!compact && runtime.localProbe?.failure && (
        <span className="block pt-1">{runtime.localProbe.detail}</span>
      )}
      {!compact && runtime.localProbe?.failure === "unreachable" && (
        <div className="block pt-2">
          <p className="text-foreground">
            Ollama ignores requests from an origin it does not list, and the browser reports
            that only as &ldquo;CORS blocked&rdquo; — which is indistinguishable from Ollama not
            running. If Ollama <em>is</em> running, this is almost certainly the cause.
          </p>

          {/* Read after mount, because `window` does not exist during the server
              render and reading it there would be a hydration mismatch. */}
          <OriginFix />

          <p className="pt-2">
            Then restart Ollama and press Re-check. If Ollama is genuinely not running, start
            it and pull <code className="font-mono">{runtime.localModel}</code> instead.
          </p>
        </div>
      )}
      {!compact && runtime.localProbe?.failure !== "unreachable" && (
        <span className="block pt-1">
          To run extraction for real, install Ollama and pull{" "}
          <code className="font-mono">{runtime.localModel}</code>, then press Re-check.
        </span>
      )}
    </BannerShell>
  )
}

/**
 * The exact command to allow this page's origin, with the origin already filled
 * in.
 *
 * This exists because the failure is otherwise a dead end. Ollama answers a
 * request from a disallowed origin with a 403 and no
 * `Access-Control-Allow-Origin`, which the browser surfaces only as "CORS
 * blocked" — visually identical to Ollama not running, and requiring the user to
 * work out their own origin to fix it. Handing over a runnable command is the
 * difference between a five-second fix and an afternoon.
 */
function OriginFix() {
  // Read after mount, because `window` does not exist during the server render
  // and reading it there would be a hydration mismatch. useSyncExternalStore
  // expresses that honestly with no effect and no cascading render.
  const origin = React.useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => ""
  )

  if (!origin) return null

  return (
    <div className="mt-1.5 flex flex-col gap-1">
      <p className="text-foreground">
        Allow this page&rsquo;s origin (<code className="font-mono">{origin}</code>):
      </p>
      <pre className="overflow-x-auto rounded-md bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
        {`[Environment]::SetEnvironmentVariable(` +
          `\n  "OLLAMA_ORIGINS", ` +
          `\n  "http://localhost:3000,${origin}", ` +
          `\n  "User")`}
      </pre>
      <p className="text-xs">
        PowerShell, on Windows. <code className="font-mono">OLLAMA_ORIGINS</code> is a
        comma-separated list read by Ollama at startup, so append to whatever is already
        there rather than replacing it &mdash; the value above keeps local development
        working as well. Then restart Ollama, which reads the variable only at startup.
      </p>
    </div>
  )
}

type Tone = "good" | "warn" | "bad" | "neutral"

const TONE_CLASS: Record<Tone, string> = {
  // The lime rule: lime is a surface in light mode and text only in dark, so
  // the "good" state never paints lime type on white.
  good: "bg-primary/15 text-primary-foreground dark:bg-primary/20 dark:text-primary",
  warn: "bg-muted text-foreground",
  bad: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  neutral: "bg-muted text-secondary-foreground dark:text-muted-foreground",
}

function BannerShell({
  tone,
  label,
  icon,
  badge,
  action,
  children,
  role = "status",
}: {
  tone: Tone
  label: string
  icon?: React.ReactNode
  badge?: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  role?: "status" | "alert"
}) {
  return (
    <div
      role={role}
      aria-live="polite"
      className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5 text-xs/relaxed sm:flex-row sm:items-start sm:gap-3"
    >
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`inline-flex size-6 items-center justify-center rounded-full ${TONE_CLASS[tone]}`}
          aria-hidden
        >
          {icon}
        </span>
        <span className="font-heading text-xs font-medium text-foreground">{label}</span>
        {badge}
      </div>
      <div className="min-w-0 flex-1 text-secondary-foreground dark:text-muted-foreground">
        {children}
      </div>
      <div className="shrink-0 sm:self-center">{action}</div>
    </div>
  )
}