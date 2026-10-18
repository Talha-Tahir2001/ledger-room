/**
 * MongoDB Atlas sync (ADR-011, ADR-018).
 *
 * Deliberately the least interesting file in the project. It is opt-in, off by
 * default, field-only, and fire-and-forget: if Atlas is unreachable the app
 * behaves byte-for-byte identically. That framing is what caps this at 45
 * minutes — it either connects or it does not, and there is no queue, no retry
 * and no conflict resolution to debug.
 *
 * What is stored: extracted structured fields and correction pairs.
 * What is never stored: the document, its bytes, and the raw OCR text.
 *
 * Atlas Vector Search is unavailable on the free M0 tier, so similar-invoice
 * retrieval is a local cosine scan rather than a cloud query. That is not a
 * workaround bolted on — brute force over a few thousand 768-dimension vectors
 * is microseconds in Node, and keeping it local preserves the no-paid-tier
 * property the project is built on.
 */

import { setServers } from "node:dns/promises"
const URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB ?? "ledger"

export function atlasConfigured(): boolean {
  return Boolean(URI)
}

type MongoClient = import("mongodb").MongoClient

let client: MongoClient | null = null
let connecting: Promise<MongoClient | null> | null = null

async function getClient(): Promise<MongoClient | null> {
  if (!URI) return null
  if (client) return client

  // Concurrent first calls share one connection attempt rather than racing to
  // open several, which on a serverless runtime means several cold clusters.
  if (!connecting) {
    connecting = (async () => {
      try {
        const { MongoClient: Client } = await import("mongodb")
        const created = new Client(URI, {
          serverSelectionTimeoutMS: 4000,
          connectTimeoutMS: 4000,
        })
        setServers(['1.1.1.1', '8.8.8.8'])
        await created.connect()
        client = created
        return created
      } catch {
        return null
      } finally {
        connecting = null
      }
    })()
  }

  return connecting
}

export interface SyncInvoice {
  id: string
  sourceFile: string
  vendor: string | null
  invoiceNo: string | null
  issueDate: string | null
  dueDate: string | null
  currency: string | null
  subtotal: number | null
  tax: number | null
  total: number | null
  category: string | null
  billable: boolean | null
  lineItemCount: number
  confidences: Record<string, number>
  provenance: Record<string, unknown>
  corrected: boolean
}

export interface SyncCorrection {
  id: string
  invoiceId: string
  field: string
  predicted: unknown
  actual: unknown
  at: string
}

export interface SyncResult {
  ok: boolean
  invoices: number
  corrections: number
  predictions: number
  reason?: string
}

/**
 * Never throws. Returns `{ ok: false }` with a reason on any failure, because
 * the caller's contract is that the user is not interrupted by the database
 * they explicitly did not require.
 */
export async function syncRecords(input: {
  invoices: SyncInvoice[]
  corrections: SyncCorrection[]
  predictions: Record<string, unknown>[]
}): Promise<SyncResult> {
  if (!atlasConfigured()) {
    return {
      ok: false,
      invoices: 0,
      corrections: 0,
      predictions: 0,
      reason: "MONGODB_URI is not configured.",
    }
  }

  const active = await getClient()
  if (!active) {
    return {
      ok: false,
      invoices: 0,
      corrections: 0,
      predictions: 0,
      reason: "Atlas is unreachable. The local store is unaffected.",
    }
  }

  try {
    const db = active.db(DB_NAME)
    const at = new Date().toISOString()

    await Promise.all([
      input.invoices.length > 0
        ? db.collection("invoices").bulkWrite(
          input.invoices.map((invoice) => ({
            replaceOne: {
              // Filtered on our own key rather than `_id`, which Mongo types
              // as ObjectId. Keeping our string id as a separate field also
              // makes the Atlas UI readable.
              filter: { invoiceId: invoice.id },
              replacement: { ...invoice, syncedAt: at },
              upsert: true,
            },
          }))
        )
        : Promise.resolve(),
      input.corrections.length > 0
        ? db.collection("corrections").insertMany(
          input.corrections.map((correction) => ({ ...correction, syncedAt: at }))
        )
        : Promise.resolve(),
      input.predictions.length > 0
        ? db.collection("predictions").insertMany(
          input.predictions.map((prediction) => ({ ...prediction, syncedAt: at }))
        )
        : Promise.resolve(),
    ])

    return {
      ok: true,
      invoices: input.invoices.length,
      corrections: input.corrections.length,
      predictions: input.predictions.length,
    }
  } catch (error) {
    return {
      ok: false,
      invoices: 0,
      corrections: 0,
      predictions: 0,
      reason: (error as Error).message,
    }
  }
}
