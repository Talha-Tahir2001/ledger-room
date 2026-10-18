"use client"

/**
 * Client state for the whole app.
 *
 * Extracted fields persist to localStorage so a page reload does not cost the
 * user a re-run, and so the review table and chase list can see the same rows.
 * What is stored is fields only — never the document, never the OCR text, never
 * the file bytes. That is the same rule the Atlas sync follows, and it is why
 * there is no "clear my uploads" button: there was nothing to clear.
 */
import * as React from "react"

import type { Invoice, Extracted } from "@/lib/schema"

const STORAGE_KEY = "ledger.room.state.v1"

export type Correction = {
  id: string
  invoiceId: string
  field: string
  predicted: unknown
  actual: unknown
  at: string
}

interface PersistedState {
  invoices: Invoice[]
  corrections: Correction[]
  atlasSyncEnabled: boolean
}

const EMPTY: PersistedState = { invoices: [], corrections: [], atlasSyncEnabled: false }

interface StoreValue extends PersistedState {
  invoices: Invoice[]
  corrections: Correction[]
  atlasSyncEnabled: boolean
  hydrated: boolean
  addInvoices: (invoices: Invoice[]) => void
  /**
   * Swaps in a set of rows identified by runtime, replacing any that are
   * already there. Pressing "use the demo set" twice should leave you with the
   * same twenty rows rather than forty, and it should not discard rows the user
   * actually extracted.
   */
  replaceRuntime: (runtime: "demo" | "local" | "hosted", invoices: Invoice[]) => void
  removeInvoice: (id: string) => void
  clearInvoices: () => void
  /** Edits a field and records the change as a correction (FR-7, FR-8). */
  editField: (invoiceId: string, field: keyof Invoice, value: unknown) => void
  setAtlasSyncEnabled: (enabled: boolean) => void
  clearCorrections: () => void
}

const StoreContext = React.createContext<StoreValue | null>(null)

function readStorage(): PersistedState {
  if (typeof window === "undefined") return EMPTY
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<PersistedState>
    return {
      invoices: Array.isArray(parsed.invoices) ? parsed.invoices : [],
      corrections: Array.isArray(parsed.corrections) ? parsed.corrections : [],
      atlasSyncEnabled: parsed.atlasSyncEnabled === true,
    }
  } catch {
    // A corrupt entry should cost the user their rows, not their session.
    return EMPTY
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<PersistedState>(EMPTY)
  const [hydrated, setHydrated] = React.useState(false)

  // Reading storage after mount keeps the server and first client render
  // identical, which is what stops React complaining about a hydration
  // mismatch. This is the setState-in-effect case the React lint warns about,
  // and it is the case the warning is about: syncing to an external system.
  // useSyncExternalStore would express the read, but the writes still need a
  // state owner, so the honest structure is the same one with the reason here.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(readStorage())
    setHydrated(true)
  }, [])

  React.useEffect(() => {
    if (!hydrated) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota exceeded or storage disabled. The app still works in memory, and
      // export is always available, so this is not worth interrupting anyone.
    }
  }, [state, hydrated])

  const value = React.useMemo<StoreValue>(
    () => ({
      ...state,
      hydrated,
      addInvoices: (incoming) =>
        setState((current) => ({ ...current, invoices: [...current.invoices, ...incoming] })),
      replaceRuntime: (runtime, incoming) =>
        setState((current) => {
          const replaced = new Set(incoming.map((invoice) => invoice.id))
          const kept = current.invoices.filter(
            (invoice) => invoice.provenance?.runtime !== runtime && !replaced.has(invoice.id)
          )
          return {
            ...current,
            invoices: [...kept, ...incoming],
            corrections: current.corrections.filter(
              (correction) => !replaced.has(correction.invoiceId)
            ),
          }
        }),
      removeInvoice: (id) =>
        setState((current) => ({
          ...current,
          invoices: current.invoices.filter((invoice) => invoice.id !== id),
          corrections: current.corrections.filter((correction) => correction.invoiceId !== id),
        })),
      clearInvoices: () => setState((current) => ({ ...current, invoices: [] })),
      editField: (invoiceId, field, next) =>
        setState((current) => {
          const invoices = current.invoices.map((invoice) => {
            if (invoice.id !== invoiceId) return invoice
            const previous = (invoice as unknown as Record<string, unknown>)[field]
            const same = JSON.stringify(previous) === JSON.stringify(next)
            if (same) return invoice
            return { ...invoice, [field]: next, corrected: true } as Invoice
          })

          const target = current.invoices.find((invoice) => invoice.id === invoiceId)
          if (!target) return current
          const previous = (target as unknown as Record<string, unknown>)[field]
          if (JSON.stringify(previous) === JSON.stringify(next)) return current

          // Every correction is a correctly-labelled example of a real failure
          // mode. This log is the training set a fine-tune would need, produced
          // as a side effect of ordinary use.
          const correction: Correction = {
            id: crypto.randomUUID(),
            invoiceId,
            field: String(field),
            predicted: previous,
            actual: next,
            at: new Date().toISOString(),
          }

          return { ...current, invoices, corrections: [...current.corrections, correction] }
        }),
      setAtlasSyncEnabled: (enabled) =>
        setState((current) => ({ ...current, atlasSyncEnabled: enabled })),
      clearCorrections: () => setState((current) => ({ ...current, corrections: [] })),
    }),
    [state, hydrated]
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): StoreValue {
  const store = React.useContext(StoreContext)
  if (!store) throw new Error("useStore must be used inside a StoreProvider")
  return store
}

export function toInvoice(
  id: string,
  sourceFile: string,
  value: Extracted,
  confidences: Record<string, number>,
  provenance: Invoice["provenance"]
): Invoice {
  return { id, sourceFile, ...value, confidences, provenance, corrected: false }
}

/**
 * Serialises the correction log as JSONL, the shape the writeup describes.
 * Offered as a download rather than written silently anywhere.
 */
export function correctionsToJsonl(corrections: Correction[]): string {
  return corrections.map((correction) => JSON.stringify(correction)).join("\n") + "\n"
}