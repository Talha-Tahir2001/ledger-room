"use client"

/**
 * The review table (FR-6, FR-7, FR-8, FR-9).
 *
 * Design notes that are requirements rather than taste:
 *
 *   - Real `<table>` markup with `<th scope>`. A grid of divs is not a table
 *     to a screen reader, and this is the screen a reviewer actually reads.
 *   - Every money, date and count is `tabular-nums`, or digits jitter between
 *     rows and the whole thing reads as unprofessional.
 *   - Confidence and provenance are never colour alone; both carry text.
 *   - On a phone the table becomes cards. A 16-column data grid on a 320px
 *     screen either scrolls sideways or is unreadable, and sideways scroll is
 *     explicitly forbidden.
 */
import * as React from "react"
import {
  IconArrowUp,
  IconCheck,
  IconDownload,
  IconPencil,
  IconTableExport,
  IconTrash,
  IconX,
} from "@tabler/icons-react"

import { ConfidenceBadge, RowConfidence } from "@/components/confidence-badge"
import { ProvenanceTag } from "@/components/provenance-tag"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { bandFor, worstFieldScore } from "@/lib/confidence"
import { exportInvoices, exportInvoicesJson } from "@/lib/csv"
import { EXTRACTED_FIELDS, type Invoice } from "@/lib/schema"
import { correctionsToJsonl, useStore } from "@/lib/store"

type SortKey = "order" | "confidence" | "file" | "total"

export function InvoiceTable() {
  const { invoices, corrections, editField, removeInvoice, clearInvoices, hydrated } = useStore()
  const [sort, setSort] = React.useState<SortKey>("order")
  const [showOnlyFlagged, setShowOnlyFlagged] = React.useState(false)

  const rows = React.useMemo(() => {
    const list = showOnlyFlagged
      ? invoices.filter((invoice) => worstFieldScore(invoice.confidences) < 0.5)
      : invoices

    const sorted = [...list]
    if (sort === "confidence") {
      sorted.sort(
        (a, b) => worstFieldScore(a.confidences) - worstFieldScore(b.confidences)
      )
    } else if (sort === "file") {
      sorted.sort((a, b) => a.sourceFile.localeCompare(b.sourceFile))
    } else if (sort === "total") {
      sorted.sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
    }
    return sorted
  }, [invoices, sort, showOnlyFlagged])

  const flaggedCount = invoices.filter(
    (invoice) => worstFieldScore(invoice.confidences) < 0.5
  ).length

  if (!hydrated) {
    return (
      <p className="text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
        Loading saved rows…
      </p>
    )
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-10 text-center">
        <p className="font-heading text-sm font-medium text-foreground">No rows yet</p>
        <p className="mt-1 text-xs/relaxed text-secondary-foreground dark:text-muted-foreground">
          Extract a batch from the upload screen, or load the pre-computed demo set.
        </p>
        <a
          href="/app"
          className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-xs font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          Go to upload
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="tabular-nums">
            {invoices.length} rows
          </Badge>
          {flaggedCount > 0 && (
            <Button
              variant={showOnlyFlagged ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setShowOnlyFlagged((value) => !value)}
            >
              {showOnlyFlagged ? "Showing flagged only" : `Show ${flaggedCount} flagged`}
            </Button>
          )}
          {corrections.length > 0 && (
            <Badge variant="outline" className="tabular-nums">
              {corrections.length} {corrections.length === 1 ? "correction" : "corrections"}
            </Badge>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {corrections.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() =>
                downloadText(
                  "ledger-corrections.jsonl",
                  correctionsToJsonl(corrections)
                )
              }
            >
              <IconDownload className="size-3" aria-hidden />
              Corrections (.jsonl)
            </Button>
          )}
          <Button variant="outline" size="xs" onClick={() => exportInvoices(invoices)}>
            <IconTableExport className="size-3" aria-hidden />
            Export CSV
          </Button>
          <Button variant="outline" size="xs" onClick={() => exportInvoicesJson(invoices)}>
            Export JSON
          </Button>
          <Button variant="ghost" size="xs" onClick={clearInvoices}>
            <IconTrash className="size-3" aria-hidden />
            Clear
          </Button>
        </div>
      </div>

      {/* Desktop: a real table. */}
      <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead
                label="File"
                sortKey="file"
                active={sort}
                onSort={setSort}
                className="min-w-40"
              />
              <TableHead scope="col" className="min-w-44">
                Vendor
              </TableHead>
              <TableHead scope="col" className="min-w-28">
                Invoice no.
              </TableHead>
              <TableHead scope="col" className="min-w-24">
                Issue
              </TableHead>
              <TableHead scope="col" className="min-w-24">
                Due
              </TableHead>
              <TableHead scope="col" className="min-w-20 text-right">
                Total
              </TableHead>
              <TableHead scope="col" className="min-w-16">
                Cur.
              </TableHead>
              <TableHead scope="col" className="min-w-24">
                Category
              </TableHead>
              <TableHead scope="col" className="min-w-20">
                Billable
              </TableHead>
              <TableHead scope="col" className="min-w-36">
                Provenance
              </TableHead>
              <SortableHead
                label="Confidence"
                sortKey="confidence"
                active={sort}
                onSort={setSort}
              />
              <TableHead scope="col" className="w-10">
                <span className="sr-only">Remove</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((invoice) => (
              <TableRow key={invoice.id}>
                <TableCell className="font-mono text-xs">
                  <span className="flex items-center gap-1.5">
                    {invoice.sourceFile}
                    {invoice.corrected && (
                      <IconPencil className="size-3 shrink-0" aria-label="Edited" />
                    )}
                  </span>
                </TableCell>
                <EditableCell
                  invoice={invoice}
                  field="vendor"
                  editField={editField}
                  type="text"
                />
                <EditableCell
                  invoice={invoice}
                  field="invoiceNo"
                  editField={editField}
                  type="text"
                  mono
                />
                <EditableCell
                  invoice={invoice}
                  field="issueDate"
                  editField={editField}
                  type="text"
                  mono
                />
                <EditableCell
                  invoice={invoice}
                  field="dueDate"
                  editField={editField}
                  type="text"
                  mono
                />
                <EditableCell
                  invoice={invoice}
                  field="total"
                  editField={editField}
                  type="number"
                  align="right"
                />
                <EditableCell
                  invoice={invoice}
                  field="currency"
                  editField={editField}
                  type="text"
                  mono
                />
                <EditableCell
                  invoice={invoice}
                  field="category"
                  editField={editField}
                  type="text"
                />
                <EditableCell
                  invoice={invoice}
                  field="billable"
                  editField={editField}
                  type="boolean"
                />
                <TableCell>
                  <ProvenanceTag provenance={invoice.provenance} />
                </TableCell>
                <TableCell>
                  <RowConfidence
                    score={worstFieldScore(invoice.confidences)}
                    count={EXTRACTED_FIELDS.length}
                  />
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeInvoice(invoice.id)}
                    aria-label={`Remove ${invoice.sourceFile}`}
                  >
                    <IconX />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile: one card per document. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((invoice) => (
          <li key={invoice.id} className="rounded-lg border border-border bg-card p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-secondary-foreground dark:text-muted-foreground">
                  {invoice.sourceFile}
                </p>
                <p className="truncate font-heading text-sm text-foreground">
                  {invoice.vendor ?? "—"}
                </p>
              </div>
              <RowConfidence
                score={worstFieldScore(invoice.confidences)}
                count={EXTRACTED_FIELDS.length}
              />
            </div>

            <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {(["invoiceNo", "issueDate", "dueDate", "total", "currency", "category"] as const).map(
                (field) => (
                  <div key={field} className="min-w-0">
                    <dt className="text-xs text-secondary-foreground dark:text-muted-foreground">
                      {field === "invoiceNo"
                        ? "Invoice no."
                        : field === "issueDate"
                          ? "Issue"
                          : field === "dueDate"
                            ? "Due"
                            : field === "total"
                              ? "Total"
                              : field === "currency"
                                ? "Currency"
                                : "Category"}
                    </dt>
                    <dd className="truncate text-xs tabular-nums text-foreground">
                      {formatValue(invoice, field)}
                    </dd>
                  </div>
                )
              )}
            </dl>

            <div className="mt-2 flex items-center justify-between gap-2">
              <ProvenanceTag provenance={invoice.provenance} />
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => removeInvoice(invoice.id)}
                aria-label={`Remove ${invoice.sourceFile}`}
              >
                <IconTrash />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function SortableHead({
  label,
  sortKey,
  active,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  active: SortKey
  onSort: (key: SortKey) => void
  className?: string
}) {
  return (
    <TableHead scope="col" className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 rounded-sm uppercase tracking-wide transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        {label}
        <IconArrowUp
          className={`size-3 ${active === sortKey ? "opacity-100" : "opacity-0"}`}
          aria-hidden
        />
      </button>
    </TableHead>
  )
}

function EditableCell({
  invoice,
  field,
  editField,
  type,
  align = "left",
  mono = false,
}: {
  invoice: Invoice
  field: keyof Invoice
  editField: (invoiceId: string, field: keyof Invoice, value: unknown) => void
  type: "text" | "number" | "boolean"
  align?: "left" | "right"
  mono?: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const score = invoice.confidences[field as string] ?? 0
  const band = bandFor(score)
  const value = (invoice as unknown as Record<string, unknown>)[field]

  const start = () => {
    setDraft(value === null || value === undefined ? "" : String(value))
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    if (type === "number") {
      const trimmed = draft.trim()
      if (trimmed === "") {
        if (value !== null) editField(invoice.id, field, null)
        return
      }
      const parsed = Number(trimmed.replace(/[^0-9.\-]/g, ""))
      if (Number.isFinite(parsed) && parsed !== value) editField(invoice.id, field, parsed)
      return
    }
    const trimmed = draft.trim()
    const next = trimmed === "" ? null : trimmed
    if (next !== value) editField(invoice.id, field, next)
  }

  if (type === "boolean") {
    return (
      <TableCell className="align-middle">
        <span className="flex items-center gap-1.5">
          <span className="text-xs text-foreground">
            {value === true ? "billable" : value === false ? "not billable" : "no signal"}
          </span>
          <ConfidenceBadge score={score} field={String(field)} />
        </span>
      </TableCell>
    )
  }

  if (editing) {
    return (
      <TableCell className="p-1 align-middle">
        <div className="flex items-center gap-1">
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commit()
              if (event.key === "Escape") setEditing(false)
            }}
            aria-label={`Edit ${String(field)}`}
            className={`h-7 text-xs ${mono ? "font-mono tabular-nums" : ""}`}
          />
          <Button variant="ghost" size="icon-xs" onClick={commit} aria-label="Save">
            <IconCheck />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setEditing(false)}
            aria-label="Cancel"
          >
            <IconX />
          </Button>
        </div>
      </TableCell>
    )
  }

  const display = formatValue(invoice, field)

  return (
    <TableCell
      className={`group align-middle ${align === "right" ? "text-right" : ""}`}
      // A low score gets a visible wash, and the number beside it, so the
      // signal is never colour on its own.
      style={
        band === "low"
          ? { backgroundColor: "color-mix(in oklch, var(--destructive) 7%, transparent)" }
          : undefined
      }
    >
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={start}
          className={`min-w-0 truncate rounded-sm text-left transition-colors hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none dark:hover:text-primary ${mono ? "font-mono text-xs tabular-nums" : "text-xs"}`}
          aria-label={`Edit ${String(field)}, currently ${display}`}
        >
          {display}
        </button>
        <ConfidenceBadge score={score} field={String(field)} />
      </span>
    </TableCell>
  )
}

function formatValue(invoice: Invoice, field: string): string {
  const value = (invoice as unknown as Record<string, unknown>)[field]
  if (value === null || value === undefined || value === "") return "—"
  if (field === "total" || field === "subtotal" || field === "tax") {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric.toFixed(2) : String(value)
  }
  if (field === "billable") return value === true ? "yes" : value === false ? "no" : "no signal"
  return String(value)
}

function downloadText(filename: string, contents: string) {
  const blob = new Blob([contents], { type: "application/x-ndjson;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}