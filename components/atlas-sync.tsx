"use client"

/**
 * Atlas sync toggle (FR-18).
 *
 * Off by default, and the copy states exactly what will be stored before the
 * first sync rather than after it. Enabling it is an explicit action; there is
 * no prompt, no banner asking for consent, and no default-on path.
 */
import * as React from "react"
import { IconCloudUpload } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import type { Invoice } from "@/lib/schema"
import { useStore } from "@/lib/store"

interface SyncStatus {
  configured: boolean
  defaultEnabled: boolean
  stores: string[]
  neverStores: string[]
}

export function AtlasSync() {
  const { invoices, corrections, atlasSyncEnabled, setAtlasSyncEnabled, hydrated } = useStore()
  const [status, setStatus] = React.useState<SyncStatus | null>(null)
  const [state, setState] = React.useState<"idle" | "syncing" | "done" | "error">("idle")
  const [message, setMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/sync", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null))
  }, [])

  const sync = async () => {
    setState("syncing")
    setMessage(null)

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          invoices: invoices.map((invoice: Invoice) => ({
            id: invoice.id,
            sourceFile: invoice.sourceFile,
            vendor: invoice.vendor,
            invoiceNo: invoice.invoiceNo,
            issueDate: invoice.issueDate,
            dueDate: invoice.dueDate,
            currency: invoice.currency,
            subtotal: invoice.subtotal,
            tax: invoice.tax,
            total: invoice.total,
            category: invoice.category,
            billable: invoice.billable,
            lineItemCount: invoice.lineItems.length,
            confidences: invoice.confidences,
            provenance: invoice.provenance,
            corrected: invoice.corrected,
          })),
          corrections,
        }),
      })

      const result = await response.json()
      if (result.ok) {
        setState("done")
        setMessage(
          `Synced ${result.invoices} invoice${result.invoices === 1 ? "" : "s"} and ${result.corrections} correction${result.corrections === 1 ? "" : "s"}.`
        )
      } else {
        setState("error")
        setMessage(result.reason ?? "Sync failed.")
      }
    } catch (error) {
      setState("error")
      setMessage((error as Error).message)
    }
  }

  if (!hydrated) return null

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className="font-heading text-sm font-medium text-foreground">
              Sync extracted fields to Atlas
            </h3>
            <Badge variant="outline">off by default</Badge>
          </div>
          <p className="max-w-prose text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
            {status?.configured
              ? `Stores ${status.stores.join(", ")}. Never stores ${status.neverStores.join(", ")}. The correction log is a correctly-labelled training set, so syncing it is what makes corrections carry across devices.`
              : "No Atlas cluster is configured on this deployment, so this does nothing. The app behaves identically either way."}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Switch
            checked={atlasSyncEnabled}
            onCheckedChange={(checked: boolean) => setAtlasSyncEnabled(checked)}
            aria-label="Enable Atlas sync of extracted fields"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => void sync()}
            disabled={!atlasSyncEnabled || !status?.configured || state === "syncing" || invoices.length === 0}
          >
            <IconCloudUpload className="size-3.5" aria-hidden />
            {state === "syncing" ? "Syncing" : "Sync now"}
          </Button>
        </div>
      </div>

      {message && (
        <p
          role="status"
          className={
            state === "error"
              ? "mt-3 text-xs text-destructive"
              : "mt-3 text-xs text-secondary-foreground dark:text-muted-foreground"
          }
        >
          {message}
        </p>
      )}
    </div>
  )
}