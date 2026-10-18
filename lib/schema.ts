import { z } from "zod"

/**
 * The 11 fields the model is asked to extract (PRD FR-4). Everything else on an
 * `Invoice` is added by the app after extraction — asking the model for ids,
 * provenance or confidences is asking it to hallucinate them.
 */
export const LineItemSchema = z.object({
  description: z.string().describe("The line item description exactly as printed"),
  quantity: z.number().nullable().describe("Quantity ordered, or null if not printed"),
  unitPrice: z.number().nullable().describe("Price per unit, or null if not printed"),
  amount: z.number().nullable().describe("Line total, or null if not printed"),
})

export const ExtractedSchema = z.object({
  vendor: z
    .string()
    .nullable()
    .describe(
      "The organisation that issued or is owed the invoice — the party being billed FROM. Never the recipient. null if not determinable."
    ),
  invoiceNo: z
    .string()
    .nullable()
    .describe("The invoice / receipt / bill reference number as a string. null if not printed"),
  issueDate: z
    .string()
    .nullable()
    .describe("ISO 8601 date the document was issued, YYYY-MM-DD. null if not printed"),
  dueDate: z
    .string()
    .nullable()
    .describe("ISO 8601 payment due date, YYYY-MM-DD. null if genuinely absent"),
  currency: z
    .string()
    .nullable()
    .describe(
      "ISO 4217 code inferred from the symbol or code printed: USD, EUR, GBP, PKR, etc. null if unclear"
    ),
  subtotal: z
    .number()
    .nullable()
    .describe("Amount before tax, as a bare number with no currency symbol or thousands separators"),
  tax: z
    .number()
    .nullable()
    .describe("Tax / VAT / GST amount as a bare number. null if no tax line is printed"),
  total: z
    .number()
    .nullable()
    .describe("Grand total due as a bare number. Prefer the printed TOTAL row over any sum you compute"),
  category: z
    .string()
    .nullable()
    .describe(
      "A short lowercase expense category inferred from the vendor and line items, e.g. software, hosting, travel, meals, hardware, utilities, fees. null if the document carries no signal"
    ),
  billable: z
    .boolean()
    .nullable()
    .describe(
      "true only if the text explicitly shows this is billed to a client as work performed. null when there is no such signal. Software and utilities are never billable."
    ),
  lineItems: z
    .array(LineItemSchema)
    .describe("The itemised charges. An empty array is correct for a receipt with no itemisation."),
})

/** Everything the app tracks about one processed document. */
export const InvoiceSchema = ExtractedSchema.extend({
  id: z.string(),
  sourceFile: z.string(),
  confidences: z.record(z.string(), z.number()),
  provenance: z.object({
    textLayer: z.boolean(),
    ocrUsed: z.boolean(),
    model: z.string(),
    runtime: z.enum(["local", "hosted", "demo"]),
  }),
  corrected: z.boolean(),
})

export type LineItem = z.infer<typeof LineItemSchema>
export type Extracted = z.infer<typeof ExtractedSchema>
export type Invoice = z.infer<typeof InvoiceSchema>

/** The 11 extracted fields, in the order the review table renders them. */
export const EXTRACTED_FIELDS = [
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
] as const satisfies readonly (keyof Extracted)[]

export type ExtractedField = (typeof EXTRACTED_FIELDS)[number]

/** Numeric fields tolerate formatting differences; these are scored as numbers. */
export const NUMERIC_FIELDS = ["subtotal", "tax", "total"] as const satisfies readonly
  (keyof Extracted)[]

let cachedJsonSchema: unknown

/**
 * The schema handed to the model as a structured-output constraint. Cached
 * because `toJSONSchema` is not free and this is called once per document.
 *
 * `additionalProperties: false` is set because Ollama's grammar compiler reads
 * it to decide where object properties may end, and a model that invents keys
 * then produces output that fails validation for no useful reason.
 */
export function invoiceJsonSchema(): Record<string, unknown> {
  if (!cachedJsonSchema) {
    cachedJsonSchema = z.toJSONSchema(ExtractedSchema, {
      target: "draft-2020-12",
      io: "output",
      unrepresentable: "any",
    })
  }
  return structuredClone(cachedJsonSchema) as Record<string, unknown>
}

/** Stable hash of the schema, so a cached model response can never cross a schema change. */
export function schemaHash(): string {
  const json = JSON.stringify(invoiceJsonSchema())
  let hash = 0x811c9dc5
  for (let i = 0; i < json.length; i++) {
    hash ^= json.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}