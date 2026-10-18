/**
 * CSV and JSON export (FR-9), plus the CSV reader the chase list needs for a
 * freelancer's invoice history.
 *
 * The round-trip matters: exporting and re-importing must give back identical
 * values, so the writer quotes defensively and the reader undoes exactly that.
 */
import type { Invoice } from "./schema"

const COLUMNS = [
  "sourceFile",
  "vendor",
  "invoiceNo",
  "issueDate",
  "dueDate",
  "currency",
  "subtotal",
  "tax",
  "total",
  "category",
  "billable",
  "lineItems",
  "provenance.runtime",
  "provenance.model",
  "provenance.textLayer",
  "provenance.ocrUsed",
  "corrected",
  "confidence",
] as const

/** Line items become a single cell so the file stays one row per invoice. */
export function formatLineItems(invoice: Invoice): string {
  if (!invoice.lineItems || invoice.lineItems.length === 0) return ""
  return invoice.lineItems
    .map((item) => {
      const quantity = item.quantity ?? ""
      const unitPrice = item.unitPrice ?? ""
      const amount = item.amount ?? ""
      return `${item.description} | ${quantity} | ${unitPrice} | ${amount}`
    })
    .join(" ;; ")
}

function get(invoice: Invoice, column: (typeof COLUMNS)[number]): string {
  switch (column) {
    case "sourceFile":
      return invoice.sourceFile ?? ""
    case "provenance.runtime":
      return invoice.provenance?.runtime ?? ""
    case "provenance.model":
      return invoice.provenance?.model ?? ""
    case "provenance.textLayer":
      return String(invoice.provenance?.textLayer ?? "")
    case "provenance.ocrUsed":
      return String(invoice.provenance?.ocrUsed ?? "")
    case "corrected":
      return String(invoice.corrected ?? false)
    case "confidence": {
      const values = Object.values(invoice.confidences ?? {})
      if (values.length === 0) return ""
      return (Math.min(...values) / 100).toFixed(4)
    }
    case "lineItems":
      return formatLineItems(invoice)
    default: {
      const value = (invoice as unknown as Record<string, unknown>)[column]
      if (value === null || value === undefined) return ""
      return String(value)
    }
  }
}

/**
 * RFC 4180 quoting. A leading =, +, - or @ is prefixed with a tab as well,
 * because a spreadsheet otherwise treats the cell as a formula — which is a
 * real injection vector for data that came from a document the app did not write.
 */
function escapeCell(value: string): string {
  const needsGuard = /^[=+\-@\t\r]/.test(value)
  const guarded = needsGuard ? `\t${value}` : value
  return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded
}

export function toCsv(invoices: Invoice[]): string {
  const lines = [COLUMNS.join(",")]
  for (const invoice of invoices) {
    lines.push(COLUMNS.map((column) => escapeCell(get(invoice, column))).join(","))
  }
  return lines.join("\r\n") + "\r\n"
}

export function toJson(invoices: Invoice[]): string {
  return JSON.stringify(invoices, null, 2) + "\n"
}

export interface ParsedRow {
  [column: string]: string
}

/** RFC 4180 reader. Handles quoted fields, embedded commas and embedded newlines. */
export function parseCsv(input: string): ParsedRow[] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false
  let index = 0

  const text = input.replace(/^\uFEFF/, "")

  const endCell = () => {
    row.push(cell)
    cell = ""
  }
  const endRow = () => {
    endCell()
    rows.push(row)
    row = []
  }

  while (index < text.length) {
    const char = text[index]

    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"'
          index += 2
          continue
        }
        quoted = false
        index++
        continue
      }
      cell += char
      index++
      continue
    }

    if (char === '"') {
      quoted = true
      index++
      continue
    }
    if (char === ",") {
      endCell()
      index++
      continue
    }
    if (char === "\r") {
      if (text[index + 1] === "\n") index++
      endRow()
      index++
      continue
    }
    if (char === "\n") {
      endRow()
      index++
      continue
    }

    cell += char
    index++
  }

  if (cell !== "" || row.length > 0) endRow()

  const header = rows.shift()
  if (!header) return []

  return rows
    .filter((entry) => entry.some((value) => value !== ""))
    .map((entry) => {
      const record: ParsedRow = {}
      header.forEach((name, position) => {
        record[name.trim()] = entry[position] ?? ""
      })
      return record
    })
}

export function download(filename: string, contents: string, mime: string): void {
  const blob = new Blob([contents], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function exportInvoices(invoices: Invoice[]): void {
  const stamp = new Date().toISOString().slice(0, 10)
  download(`ledger-invoices-${stamp}.csv`, toCsv(invoices), "text/csv")
}

export function exportInvoicesJson(invoices: Invoice[]): void {
  const stamp = new Date().toISOString().slice(0, 10)
  download(`ledger-invoices-${stamp}.json`, toJson(invoices), "application/json")
}