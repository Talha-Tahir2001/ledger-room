"use client"

/**
 * Upload and the batch queue (FR-1, FR-14).
 *
 * The client drives the batch, one document at a time. That is forced by
 * Vercel Hobby's 300-second function ceiling, and it turns out to be the
 * better design anyway: no request is long enough to time out, per-document
 * progress is honest rather than a spinner, and in local mode the document text
 * never reaches a server at all.
 */
import * as React from "react"
import { useRouter } from "next/navigation"
import {
  IconAlertTriangle,
  IconCheck,
  IconFileText,
  IconLoader2,
  IconUpload,
  IconX,
} from "@tabler/icons-react"

import { activeRuntime, useRuntime } from "@/components/runtime-provider"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { DEMO_INVOICES } from "@/lib/demo-data"
import { processWithHosted, processWithLocal, traced } from "@/lib/pipeline"
import { redact } from "@/lib/redact"
import { useStore } from "@/lib/store"
import { computeConfidence } from "@/lib/confidence"

type ItemState = "queued" | "processing" | "done" | "failed"

interface QueueItem {
  id: string
  file: File
  state: ItemState
  stage: string
  progress: number
  elapsedMs: number
  error: string | null
  usedOcr: boolean | null
}

const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"

/** FR-1 caps a batch at 100 files. */
const MAX_FILES = 100

export function UploadDropzone() {
  const router = useRouter()
  const runtime = useRuntime()
  const { addInvoices, replaceRuntime } = useStore()

  const [items, setItems] = React.useState<QueueItem[]>([])
  const [dragging, setDragging] = React.useState(false)
  const [running, setRunning] = React.useState(false)
  const runningRef = React.useRef(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const runtimeKind = activeRuntime(runtime)
  // Hoisted out of the queue loop so the batch callback does not depend on a
  // nullable chain that only changes when the user presses Re-check.
  const localTransport = runtime.localProbe?.transport ?? "direct"

  const patch = React.useCallback((id: string, changes: Partial<QueueItem>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...changes } : item))
    )
  }, [])

  const enqueue = React.useCallback(
    (files: File[]) => {
      const accepted = files.filter((file) =>
        /\.(pdf|jpe?g|png)$/i.test(file.name) || /^image\/(jpeg|png)$|^application\/pdf$/.test(file.type)
      )

      setItems((current) => {
        const room = MAX_FILES - current.length
        if (room <= 0) return current
        return [
          ...current,
          ...accepted.slice(0, room).map((file) => ({
            id: crypto.randomUUID(),
            file,
            state: "queued" as ItemState,
            stage: "Queued",
            progress: 0,
            elapsedMs: 0,
            error: null,
            usedOcr: null,
          })),
        ]
      })
    },
    []
  )

  const runQueue = React.useCallback(async () => {
    if (runningRef.current) return
    runningRef.current = true
    setRunning(true)

    const pending = items.filter((item) => item.state === "queued" || item.state === "failed")

    for (const item of pending) {
      const started = performance.now()
      patch(item.id, { state: "processing", stage: "Starting", progress: 0.02, error: null })

      const tick = window.setInterval(() => {
        patch(item.id, { elapsedMs: Math.round(performance.now() - started) })
      }, 250)

      try {
        const outcome =
          runtimeKind === "hosted"
            ? await traced("extract.hosted", item.file.name, () =>
                processWithHosted(item.file, item.id, {
                  onStage: (stage, ratio) => patch(item.id, { stage, progress: ratio }),
                })
              )
            : await traced(
                "extract.local",
                item.file.name,
                () =>
                  processWithLocal(
                    item.file,
                    item.id,
                    { onStage: (stage, ratio) => patch(item.id, { stage, progress: ratio }) },
                    localTransport
                  ),
                { runtime: "local", transport: localTransport }
              )

        addInvoices([outcome.invoice])
        patch(item.id, {
          state: "done",
          stage: "Done",
          progress: 1,
          elapsedMs: Math.round(performance.now() - started),
          usedOcr: outcome.invoice.provenance.ocrUsed,
        })
      } catch (error) {
        patch(item.id, {
          state: "failed",
          stage: "Failed",
          error: (error as Error).message,
          elapsedMs: Math.round(performance.now() - started),
        })
      } finally {
        window.clearInterval(tick)
      }
    }

    runningRef.current = false
    setRunning(false)
  }, [items, runtimeKind, localTransport, addInvoices, patch])

  const loadDemo = React.useCallback(() => {
    replaceRuntime(
      "demo",
      DEMO_INVOICES.map((entry) => ({
        id: entry.id,
        sourceFile: entry.sourceFile,
        ...entry.value,
        confidences: computeConfidence({
          extracted: entry.value,
          sourceText: entry.sourceText,
        }),
        provenance: {
          textLayer: entry.textLayer,
          ocrUsed: !entry.textLayer,
          model: entry.model,
          runtime: "demo" as const,
        },
        corrected: false,
      }))
    )
    router.push("/app/review")
  }, [replaceRuntime, router])

  const doneCount = items.filter((item) => item.state === "done").length
  const failedCount = items.filter((item) => item.state === "failed").length

  const needsConsent = runtime.state === "hosted" && !runtime.hostedConsent

  return (
    <div className="flex flex-col gap-4">
      {needsConsent && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-border bg-muted px-3 py-3 text-xs/relaxed sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0 text-secondary-foreground dark:text-muted-foreground">
            <strong className="font-medium text-foreground">Nothing will be sent yet.</strong> The
            hosted path needs one confirmation per session. Redacted text goes to{" "}
            <code className="font-mono">{runtime.hosted?.provider}</code> on a{" "}
            <code className="font-mono">data_collection: &quot;deny&quot;</code> route. Client
            names and account-number-like digit runs are stripped on this device first.
          </div>
          <Button
            className="shrink-0"
            size="sm"
            onClick={() => runtime.grantHostedConsent()}
          >
            Allow hosted extraction this session
          </Button>
        </div>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          enqueue(Array.from(event.dataTransfer.files))
        }}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border bg-card"
        }`}
      >
        <span
          className="inline-flex size-11 items-center justify-center rounded-full bg-primary/15 text-primary-foreground dark:bg-primary/20 dark:text-primary"
          aria-hidden
        >
          <IconUpload className="size-5" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-heading text-base font-medium text-foreground">
            Drop invoices and receipts here
          </p>
          <p className="text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
            PDF, JPG or PNG. Up to {MAX_FILES} files per batch. Files are read in this tab and
            never written to disk.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
          <Button variant="ghost" size="sm" onClick={loadDemo}>
            Use the 20-document demo set
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => {
            enqueue(Array.from(event.target.files ?? []))
            event.target.value = ""
          }}
        />
      </div>

      {items.length > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-heading text-xs font-medium text-foreground">
              Batch queue
              <span className="ml-2 font-normal tabular-nums text-secondary-foreground dark:text-muted-foreground">
                {doneCount}/{items.length} done
                {failedCount > 0 ? `, ${failedCount} failed` : ""}
              </span>
            </p>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => void runQueue()}
                disabled={running || doneCount + failedCount === items.length}
              >
                {running ? (
                  <>
                    <IconLoader2 className="size-3.5 animate-spin" aria-hidden />
                    Processing
                  </>
                ) : (
                  `Extract ${items.length - doneCount - failedCount} remaining`
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setItems([])}
                disabled={running}
              >
                Clear
              </Button>
            </div>
          </div>

          <ul className="flex max-h-96 flex-col gap-1.5 overflow-y-auto">
            {items.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-1.5 rounded-md border border-border px-2.5 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <IconFileText className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate text-xs text-foreground">{item.file.name}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <StateIcon state={item.state} />
                    <span className="tabular-nums text-xs text-secondary-foreground dark:text-muted-foreground">
                      {item.state === "done" || item.state === "failed"
                        ? `${(item.elapsedMs / 1000).toFixed(1)}s`
                        : item.stage}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) => current.filter((entry) => entry.id !== item.id))
                      }
                      disabled={running && item.state === "processing"}
                      aria-label={`Remove ${item.file.name} from the queue`}
                      className="rounded-sm text-secondary-foreground transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:text-muted-foreground"
                    >
                      <IconX className="size-3.5" aria-hidden />
                    </button>
                  </span>
                </div>

                {item.state === "processing" && (
                  <Progress value={Math.round(item.progress * 100)} className="h-1" />
                )}

                {item.error && (
                  <p className="flex items-start gap-1.5 text-xs text-destructive">
                    <IconAlertTriangle className="mt-0.5 size-3 shrink-0" aria-hidden />
                    {item.error}
                  </p>
                )}

                {item.state === "done" && item.usedOcr !== null && (
                  <p className="text-xs text-secondary-foreground dark:text-muted-foreground">
                    {item.usedOcr
                      ? "Read by OCR — no usable text layer in this file"
                      : "Read from the PDF text layer"}
                  </p>
                )}
              </li>
            ))}
          </ul>

          {doneCount > 0 && (
            <Button variant="outline" size="sm" className="self-end" onClick={() => router.push("/app/review")}>
              Review {doneCount} {doneCount === 1 ? "row" : "rows"}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function StateIcon({ state }: { state: ItemState }) {
  if (state === "done") {
    return <IconCheck className="size-3.5 text-primary-foreground dark:text-primary" aria-label="Done" />
  }
  if (state === "processing") {
    return <IconLoader2 className="size-3.5 animate-spin" aria-label="Processing" />
  }
  if (state === "failed") {
    return <IconAlertTriangle className="size-3.5 text-destructive" aria-label="Failed" />
  }
  return <span className="size-3.5 rounded-full border border-border" aria-hidden />
}

/** Redaction counts shown before a hosted batch starts, never after it runs. */
export function summariseRedaction(text: string): string {
  const report = redact(text)
  const total = Object.values(report.counts).reduce((a, b) => a + b, 0)
  return total === 0 ? "nothing to redact in this text" : `${total} substitutions`
}