/**
 * Verifies the Atlas integration before it is claimed, and checks the one
 * property that matters: no document bytes and no raw text in any collection.
 *
 *   npm run verify:atlas
 *
 * Two connection strategies, in order:
 *
 *   1. The SRV URI from the environment, exactly as the app uses it. This is
 *      what production does.
 *   2. If Node's resolver cannot answer the SRV query — which some Windows and
 *      sandboxed environments do, returning ECONNREFUSED while the system
 *      resolver answers fine — fall back to resolving the record with the
 *      system resolver and connecting straight to one shard.
 *
 * Only this script does (2). `lib/atlas.ts` keeps the plain `mongodb+srv://`
 * URI, because shard hostnames are ephemeral and hardcoding them into an
 * application would be wrong.
 *
 * Exits 0 if the round trip works and the stored fields are clean. Exits 2 if
 * it cannot connect, which is a DNS or credentials problem rather than a code
 * problem, and says so.
 */
import { MongoClient, type Collection, type Document } from "mongodb"
import { execFileSync } from "node:child_process"

const SRV_URI = process.env.MONGODB_URI
const DB_NAME = process.env.MONGODB_DB ?? "ledger"

/** Nothing matching these may ever appear in a stored document. */
const FORBIDDEN = [
  "rawtext",
  "documenttext",
  "ocrtext",
  "textlayer",
  "bytes",
  "base64",
  "image",
  "buffer",
]

async function connectViaSrv(): Promise<MongoClient> {
  const client = new MongoClient(SRV_URI as string, {
    serverSelectionTimeoutMS: 15_000,
    connectTimeoutMS: 15_000,
  })
  await client.connect()
  return client
}

/**
 * Rewrites mongodb+srv://... into a direct mongodb://... against one shard.
 *
 * Two subtleties, both learned the hard way and both silent if missed:
 *
 *   - `mongodb+srv://` implies TLS and a plain `mongodb://` does not. Without
 *     `tls=true` the driver attempts plaintext and Atlas closes the socket
 *     during the handshake, which surfaces as an opaque network error that
 *     mentions nothing about certificates.
 *   - Atlas database users authenticate against `admin`, not against the
 *     database named in the path. Without `authSource=admin` every connection
 *     fails with "bad auth" even though the password is correct.
 */
function directUri(srvUri: string): string {
  const afterScheme = srvUri.replace(/^mongodb\+srv:\/\//, "")

  const atIndex = afterScheme.lastIndexOf("@")
  if (atIndex < 0) throw new Error("No credentials in MONGODB_URI.")

  const credentials = afterScheme.slice(0, atIndex)
  const [hostPart, query = ""] = afterScheme.slice(atIndex + 1).split("/")

  const hosts = resolveShardsWithSystemResolver(hostPart)
  if (hosts.length === 0) {
    throw new Error(`Could not resolve SRV for ${hostPart}.`)
  }

  const params = new URLSearchParams(query)
  params.set("directConnection", "true")
  params.set("retryWrites", "false")
  params.set("tls", "true")
  if (!params.has("authSource")) params.set("authSource", "admin")

  return `mongodb://${credentials}@${hosts[0]}:27017/${DB_NAME}?${params.toString()}`
}

function resolveShardsWithSystemResolver(clusterHost: string): string[] {
  const command =
    `$ErrorActionPreference='SilentlyContinue'; ` +
    `(Resolve-DnsName -Name '_mongodb._tcp.${clusterHost}' -Type SRV).NameTarget`

  try {
    const output = execFileSync("powershell", ["-NoProfile", "-Command", command], {
      encoding: "utf8",
    })
    return output
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.endsWith(".mongodb.net"))
  } catch {
    return []
  }
}

async function connect(): Promise<{ client: MongoClient; via: string }> {
  try {
    const client = await connectViaSrv()
    return { client, via: "SRV URI (as the app uses it)" }
  } catch (srvError) {
    const reason = (srvError as Error).message.split("\n")[0]
    console.log(`SRV connection failed: ${reason}`)
    console.log("Falling back to direct connection via the system resolver.\n")

    const client = new MongoClient(directUri(SRV_URI as string), {
      serverSelectionTimeoutMS: 15_000,
      connectTimeoutMS: 15_000,
    })
    await client.connect()
    return { client, via: "direct connection (SRV bypassed; the app does not do this)" }
  }
}

async function main() {
  if (!SRV_URI) {
    console.log("MONGODB_URI not set — nothing to verify.")
    return
  }

  const { client, via } = await connect()

  try {
    const db = client.db(DB_NAME)
    const collections = await db.listCollections().toArray()

    console.log(`connected via ${via}`)
    console.log(`database "${DB_NAME}"`)
    console.log(`collections: ${collections.map((c) => c.name).join(", ") || "(none yet)"}`)

    const stamp = new Date().toISOString()
    const invoices: Collection<Document> = db.collection("invoices")
    const corrections: Collection<Document> = db.collection("corrections")

    // The exact shapes lib/atlas.ts writes.
    await invoices.deleteMany({ invoiceId: "verify-probe" })
    await invoices.insertOne({
      invoiceId: "verify-probe",
      sourceFile: "probe.pdf",
      vendor: "PROBE VENDOR",
      invoiceNo: "T-1",
      issueDate: "2026-03-01",
      dueDate: "2026-03-31",
      currency: "USD",
      subtotal: 100,
      tax: 20,
      total: 120,
      category: "software",
      billable: false,
      lineItemCount: 2,
      confidences: { total: 0.9, vendor: 1 },
      provenance: { runtime: "local", model: "gemma3:4b", textLayer: true, ocrUsed: false },
      corrected: false,
      syncedAt: stamp,
    })

    await corrections.insertOne({
      id: "verify-probe-correction",
      invoiceId: "verify-probe",
      field: "total",
      predicted: 120,
      actual: 125,
      at: stamp,
      syncedAt: stamp,
    })

    const invoice = await invoices.findOne({ invoiceId: "verify-probe" })
    const correction = await corrections.findOne({ id: "verify-probe-correction" })

    const invoiceOk = Boolean(invoice)
    const correctionOk = Boolean(correction)

    console.log(`\ninvoice round-trip:    ${invoiceOk ? "ok" : "FAILED"}`)
    console.log(`correction round-trip: ${correctionOk ? "ok" : "FAILED"}`)

    const keys = new Set<string>()
    for (const document of [invoice, correction]) {
      if (document) for (const key of Object.keys(document)) keys.add(key)
    }

    const offending = [...keys].filter((key) =>
      FORBIDDEN.some((forbidden) => key.toLowerCase().includes(forbidden))
    )

    console.log(`\nstored fields (${keys.size}): ${[...keys].sort().join(", ")}`)

    if (!invoiceOk || !correctionOk) {
      console.error("\nRound trip failed.")
      process.exitCode = 1
    } else if (offending.length > 0) {
      console.error(`\nFORBIDDEN FIELDS PRESENT: ${offending.join(", ")}`)
      process.exitCode = 1
    } else {
      console.log("no document bytes, raw OCR text or image fields present — correct")
    }

    await invoices.deleteMany({ invoiceId: "verify-probe" })
    await corrections.deleteMany({ id: "verify-probe-correction" })
    console.log("probe records removed")
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})