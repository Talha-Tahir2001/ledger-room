# Ledger â€” Product Requirements

**Status:** Draft for Hacktoberfest Week 2
**Version:** 1.1
**Date:** 2026-10-18

---

## 1. Problem

A freelancer ends each month with 30â€“60 invoices and receipts in mixed
formats: emailed PDFs, phone photos of paper receipts, screenshots of
payment confirmations. They need those as structured rows for an accountant
or a tax filing.

There are exactly two options today, and both are bad:

1. **Pay someone.** Bookkeepers charge $50â€“150/month for data entry.
2. **Do it manually.** Two to four hours a month, every month.

The generic alternative â€” paste an invoice into a hosted LLM chat â€” is not
viable, because invoice text contains client names, project names, rates and
bank details, and freelancers are precisely the population least willing to
paste that into a service they do not control.

## 2. Persona

**Sam**, freelance product designer. Three to eight client invoices a month
plus a wall of software and utility receipts. Keeps receipts in a Downloads
folder and an email folder and reconciles monthly, dreading it. Would pay
$10â€“20/month to stop doing it. Will not upload client data to a hosted API.

## 3. Job to be done

> "When my month closes and I have a folder of receipts, turn them into a
> spreadsheet my accountant accepts, without me reading each one â€” and
> without my clients' names leaving my laptop."

## 4. Positioning

Two-part thesis, mirroring the challenge's own framing:

- **Product:** local-first and privacy-first. The default path runs entirely
  on the user's hardware, in the browser, offline after the model download.
- **Evidence:** a measured accuracy study showing exactly what that costs,
  what it buys, and where a hosted approach wins. No hand-waving.

## 5. Scope

### In scope (v1)

1. Multi-file upload of PDF, JPG, PNG
2. PDF text-layer extraction, with OCR fallback
3. Structured field extraction by an open-weight model, schema-constrained
4. Runtime ladder: local â†’ hosted â†’ demo â†’ blocked
5. Best-effort redaction of client identity before any external call
6. Review-and-correct table with confidence flags
7. CSV and JSON export
8. Payment prediction (days-to-payment) from invoice history
9. Opt-in cloud sync of extracted fields
10. Per-document tracing

### Out of scope

- Accounting logic, double-entry, tax computation
- Bank feeds, Plaid, QuickBooks two-way sync
- Multi-user accounts, auth, workspaces
- Payment collection â€” **explicitly excluded, because Vercel Hobby's terms
  restrict it to personal, non-commercial use**
- Receipt image storage. The app does not retain the image after extraction.

## 6. Functional requirements

| ID | Requirement | Acceptance |
|---|---|---|
| FR-1 | Accept PDF/JPG/PNG, up to 100 files per batch | 20-fixture batch completes unattended |
| FR-2 | Use the PDF text layer when present | Verified on text-layer fixtures |
| FR-3 | OCR fallback when the text layer is absent or sparse | Verified on image-only fixtures |
| FR-4 | Extract vendor, invoice no., issue date, due date, line items, subtotal, tax, total, currency, category, billable | â‰¥90% of fields populated on â‰¥90% of fixtures |
| FR-5 | Output must satisfy the Zod schema or be repaired | Zero schema violations reach the UI |
| FR-6 | Per-field confidence shown as flags | Low-confidence fields visually distinguished |
| FR-7 | Inline edit of any field | Edits persist and update the row |
| FR-8 | Capture every correction as a training example | Corrections appended to a durable log |
| FR-9 | Export CSV and JSON | Export round-trips to identical values |
| FR-10 | Predict days-to-payment per open invoice with interval | Interval present on every predicted row |
| FR-11 | Sort the chase list by predicted lateness | Ordered worst-first |
| FR-12 | Emit one trace per document with OCR/LLM/validation spans | Trace visible in Sentry with tags |
| FR-13 | Detect the available runtime on load and display it | Banner names the active provider and its privacy properties |
| FR-14 | Offer a hosted path when local is unavailable | One explicit session confirmation before the first document |
| FR-15 | Offer a pre-computed demo dataset when no runtime is available | Judge can exercise the full flow with zero setup |
| FR-16 | Surface remaining hosted quota before a batch starts | Quota shown in the banner; exhaustion returns a clear, non-retryable error |
| FR-17 | Redact client names and account numbers before any external call | Text leaving the device contains no vendor names or long digit runs |
| FR-18 | Optional cloud sync of extracted fields, default off | Off by default; enabling is an explicit action |
| FR-19 | Landing page at `/` presenting the product as a real product | Twelve sections per `DESIGN.md` §8, complete before deploy |
| FR-20 | Light/dark theme, respecting system preference | Persists explicit choice; no flash of wrong theme on first paint |
| FR-21 | Site header with nav, theme toggle and primary CTA; full footer | Sticky header, multi-column footer with attribution and licence |

## 6a. Design requirements

Specified in full in `DESIGN.md`. Non-negotiable summary:

| Requirement | Detail |
|---|---|
| Accent | Existing lime tokens, used **unmodified**. Surface in both themes; accent text as `text-primary-foreground dark:text-primary` |
| Focus | `ring-2 ring-foreground` with background offset. `--ring` measures 2.32:1 and fails the 3:1 requirement |
| Secondary text | `text-secondary-foreground dark:text-muted-foreground`. `--muted-foreground` alone is 4.26:1 in light |
| Numerals | All money, dates and counts use `tabular-nums` |
| Components | shadcn/ui Base UI variant throughout. No hand-rolled primitives |
| State | Confidence and provenance never conveyed by colour alone — always paired with text or an icon |
| Motion | `tw-animate-css` (already imported) or CSS transitions only, 150–200ms. No animation library. `prefers-reduced-motion` honoured |
| Pending data | `EVAL.md` `_TBD_` cells render as visibly pending, never as zeros |
| Contrast | WCAG AA on every pair actually used. Rules in `DESIGN.md` §2 |

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | Extraction runs on CPU. No GPU, ever |
| NFR-2 | In local mode, document content makes zero external network requests |
| NFR-3 | A judge can exercise the whole flow with no login and no API key |
| NFR-4 | Batch processing is client-orchestrated; no single invocation exceeds 300s |
| NFR-5 | Disk footprint under 6 GB including the model |
| NFR-6 | No secret appears in any build artifact |
| NFR-7 | Every published number is reproducible from a committed script |
| NFR-8 | Hosted requests carry `data_collection: "deny"`; the request fails rather than route to a non-compliant endpoint |
| NFR-9 | Every interactive element keyboard reachable with a visible focus ring |
| NFR-10 | No horizontal scroll at 320px width |
| NFR-11 | Theme applied before first paint â€” no flash of the wrong theme |
| NFR-12 | Landing page content above the fold does not depend on JavaScript |

## 8. Data model

```ts
type Invoice = {
  id: string
  sourceFile: string
  vendor: string | null
  invoiceNo: string | null
  issueDate: string | null       // ISO 8601
  dueDate: string | null         // ISO 8601
  currency: string | null        // ISO 4217
  subtotal: number | null
  tax: number | null
  total: number | null
  category: string | null
  billable: boolean | null
  lineItems: Array<{
    description: string
    quantity: number | null
    unitPrice: number | null
    amount: number | null
  }>
  confidences: Record<string, number>   // field -> 0..1 review-priority score
  provenance: {
    textLayer: boolean
    ocrUsed: boolean
    model: string
    runtime: "local" | "hosted" | "demo"
  }
  corrected: boolean
}

type PaymentPrediction = {
  invoiceId: string
  clientHash: string              // never the raw client name
  amount: number
  predictedDaysToPayment: number
  interval: [number, number]      // q10, q90
  willBeLate: boolean
  features: Record<string, number | string>
  model: string                   // "tabpfn-3.5"
  baselines: {
    clientMeanDays: number
    globalMeanDays: number
  }
}

type Correction = {
  id: string
  invoiceId: string
  field: keyof Invoice
  predicted: unknown
  actual: unknown
  at: string                     // ISO 8601
}
```

## 9. Persistence (optional, default off)

MongoDB Atlas M0, 512 MB, free forever, no credit card.

| Collection | Contents | Never stored |
|---|---|---|
| `invoices` | Extracted structured fields | Document image, raw OCR text |
| `corrections` | Prediction vs actual per field | Document image, raw OCR text |
| `predictions` | TabPFN outputs and feature rows | Raw client names |

Why this is a genuine fit rather than box-ticking: the `corrections` collection
is a **self-growing, correctly-labelled training set**. Every review the user
performs is a labelled example of the exact failure mode they care about. That
is the dataset a fine-tune would need, and it is produced as a side effect of
normal use.

Note: Atlas Vector Search requires a paid search node and is **not** available
on M0. Similar-invoice retrieval is instead implemented as a local cosine
similarity scan over embeddings produced by the local model, which is trivial
at this data size and keeps the "no paid tier" property intact.

## 10. Pricing hypothesis

Free local tier up to 50 documents/month. $12/month for sync and chase-list
forecasting. This is a hypothesis to test with the first user, stated in the
writeup â€” the app must not collect payment, per Vercel Hobby's terms.

## 11. Success metrics

| Metric | Target |
|---|---|
| Field-level accuracy, local 4B | Measured and published, no target |
| Documents per hour, CPU only | Measured and published |
| Cost per 20 invoices | $0.00 on the local path |
| First user would pay $12/mo | Yes or no, recorded honestly |
| Judge completes the flow unaided | Yes |

## 12. Known limitations, stated up front

1. Local 4B extraction is less accurate than a frontier hosted model, and this
   project measures exactly how much less.
2. Ambiguous numeric dates (`03/04/26`) are a known failure mode.
3. Payment prediction needs history. Below ~20 historical invoices it will be
   weak, and the UI should say so rather than showing false precision.
4. Handwriting is out of scope.
5. Vercel Hobby functions cannot exceed 300s, which is why batches are
   client-orchestrated.
6. The hosted path is limited to 50 requests/day and is subject to upstream
   rate limiting. It is a demo path, not production infrastructure.
7. Redaction before external calls is best-effort obfuscation, not
   anonymisation, and the UI says so.
8. The hosted arm of the accuracy study compares a different model generation
   (Gemma 4 hosted) against local Gemma 3, so it is not a controlled
   parameter ablation.

## 13. Attribution

Must be credited in the submission post: shadcn/ui (Base UI variant), Next.js,
Tailwind CSS, Ollama, Google's Gemma 3 weights, Tesseract, TabPFN (Prior
Labs), MongoDB Atlas, Sentry.
