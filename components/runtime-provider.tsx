"use client"

/**
 * The runtime ladder (ADR-015, FR-13).
 *
 *   local  → hosted → demo → blocked
 *
 * The one rule that outranks everything else here: the banner must never claim
 * a path that will fail. A judge who sees "local runtime detected" on a machine
 * with no Ollama is worse off than one told plainly that they need to pull a
 * model, so the local probe is real, run from the browser, and its failure is
 * shown rather than papered over.
 */
import * as React from "react"

import { ollamaModel, ollamaUrl, probeOllama, type LocalProbe } from "@/lib/ollama"

export type RuntimeState = "checking" | "local" | "hosted" | "demo" | "blocked"

export interface HostedStatus {
  configured: boolean
  provider: string
  dailyAllowance: number
  remainingToday: number
  remainingIsEstimate: boolean
  resetsAt: string
  dataCollection: string
  requiresExplicitConsent: boolean
}

interface RuntimeValue {
  state: RuntimeState
  localAvailable: boolean
  localUrl: string
  localModel: string
  /** Why the local probe concluded what it did, for the banner to explain. */
  localProbe: LocalProbe | null
  hosted: HostedStatus | null
  /** One explicit confirmation per session before the first document. */
  hostedConsent: boolean
  grantHostedConsent: () => void
  refresh: () => void
}

const RuntimeContext = React.createContext<RuntimeValue | null>(null)

export function RuntimeProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<RuntimeState>("checking")
  const [localAvailable, setLocalAvailable] = React.useState(false)
  const [localProbe, setLocalProbe] = React.useState<LocalProbe | null>(null)
  const [hosted, setHosted] = React.useState<HostedStatus | null>(null)
  const [hostedConsent, setHostedConsent] = React.useState(false)

  const probe = React.useCallback(async () => {
    setState("checking")

    // Two questions, asked of two different places, because they are facts
    // about two different machines.
    const [local, remote] = await Promise.all([
      probeOllama(),
      fetch("/api/health", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .catch(() => null),
    ])

    setLocalProbe(local)
    setLocalAvailable(local.ok)
    const status: HostedStatus | null = remote?.hosted ?? null
    setHosted(status)

    if (local.ok) {
      setState("local")
      return
    }
    if (status?.configured && status.remainingToday > 0) {
      setState("hosted")
      return
    }
    if (status?.configured) {
      setState("blocked")
      return
    }
    setState("demo")
  }, [])

  React.useEffect(() => {
    // Probing the network is the textbook external-system sync, which is the
    // one case where setting state from an effect is correct.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void probe()
  }, [probe])

  const value = React.useMemo<RuntimeValue>(
    () => ({
      state,
      localAvailable,
      localUrl: ollamaUrl(),
      localModel: ollamaModel(),
      localProbe,
      hosted,
      hostedConsent,
      grantHostedConsent: () => setHostedConsent(true),
      refresh: () => void probe(),
    }),
    [state, localAvailable, localProbe, hosted, hostedConsent, probe]
  )

  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}

export function useRuntime(): RuntimeValue {
  const value = React.useContext(RuntimeContext)
  if (!value) throw new Error("useRuntime must be used inside a RuntimeProvider")
  return value
}

/**
 * The runtime a batch should actually use right now.
 *
 * `hosted` only resolves to `hosted` once consent is granted, so an unattended
 * batch can never quietly start sending documents off the machine.
 */
export function activeRuntime(runtime: RuntimeValue): "local" | "hosted" | "demo" {
  if (runtime.state === "local") return "local"
  if (runtime.state === "hosted" && runtime.hostedConsent) return "hosted"
  if (runtime.state === "blocked") return "demo"
  return "demo"
}