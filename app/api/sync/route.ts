/**
 * Opt-in Atlas sync (FR-18).
 *
 * Default off, and the toggle is an explicit action rather than a default. The
 * response never blocks the caller: a failure is reported, not thrown, because
 * the local store is the source of truth and Atlas is a convenience copy
 * (ADR-018).
 */
import { NextResponse } from "next/server"

import { atlasConfigured, syncRecords, type SyncCorrection, type SyncInvoice } from "@/lib/atlas"

export const dynamic = "force-dynamic"
export const maxDuration = 30

export async function GET() {
  return NextResponse.json({
    configured: atlasConfigured(),
    defaultEnabled: false,
    stores: ["invoices", "corrections", "predictions"],
    neverStores: ["document bytes", "raw OCR text", "client names"],
  })
}

export async function POST(request: Request) {
  if (!atlasConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        reason: "MONGODB_URI is not configured on this deployment.",
      },
      { status: 503 }
    )
  }

  let payload: {
    invoices?: SyncInvoice[]
    corrections?: SyncCorrection[]
    predictions?: Record<string, unknown>[]
  }

  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: "Invalid JSON body." }, { status: 400 })
  }

  // Strip anything that is not a field, so a caller cannot accidentally widen
  // what this route is willing to persist.
  const invoices: SyncInvoice[] = (payload.invoices ?? []).map((invoice) => ({
    id: String(invoice.id ?? ""),
    sourceFile: String(invoice.sourceFile ?? ""),
    vendor: invoice.vendor ?? null,
    invoiceNo: invoice.invoiceNo ?? null,
    issueDate: invoice.issueDate ?? null,
    dueDate: invoice.dueDate ?? null,
    currency: invoice.currency ?? null,
    subtotal: invoice.subtotal ?? null,
    tax: invoice.tax ?? null,
    total: invoice.total ?? null,
    category: invoice.category ?? null,
    billable: invoice.billable ?? null,
    lineItemCount: invoice.lineItemCount ?? 0,
    confidences: invoice.confidences ?? {},
    provenance: invoice.provenance ?? {},
    corrected: invoice.corrected ?? false,
  }))

  const corrections: SyncCorrection[] = (payload.corrections ?? []).map((correction) => ({
    id: String(correction.id ?? ""),
    invoiceId: String(correction.invoiceId ?? ""),
    field: String(correction.field ?? ""),
    predicted: correction.predicted ?? null,
    actual: correction.actual ?? null,
    at: String(correction.at ?? new Date().toISOString()),
  }))

  const result = await syncRecords({
    invoices,
    corrections,
    predictions: payload.predictions ?? [],
  })

  return NextResponse.json(result, { status: result.ok ? 200 : 200 })
}
