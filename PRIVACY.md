# Ledger — Data Handling

This document is the product's thesis and doubles as evidence in the
challenge submission. Every claim here is enforced by the code, not by
intent.

---

## 1. Principles

1. **Local by default.** The extraction path performs zero external network
   calls with document content, and works with the network disconnected after
   the model download.
2. **No retention.** Documents are processed in memory and never written to
   disk. There is no document store to breach because there is no document
   store.
3. **Minimise what leaves.** Where an external call is unavoidable, the
   payload is the smallest viable projection of the data.
4. **State the caveats.** Where a provider's terms work against the user, the
   product says so instead of hiding it.

---

## 2. Data flow

| Data | Destination | When |
|---|---|---|
| Invoice image / PDF | **Nowhere** — memory only | Never persisted |
| Extracted text | **Nowhere** — Ollama, local | Stays on the machine |
| Prompt and completion | **Nowhere** — Ollama, local | Stays on the machine |
| OCR output | **Nowhere** — tesseract.js in-browser | Never persisted |
| Corrections | `corrections.jsonl`, local | Default store. User's disk only |
| Corrections (if sync enabled) | MongoDB Atlas M0 | Explicit opt-in |
| Atlas records | **Fields only** | Never the image, never raw OCR text |
| TabPFN feature row | Prior Labs API (EU) | Only on explicit "Predict payments" |
| Client identity | Hashed client-side before the TabPFN call | Raw name never sent |
| Sentry spans | Sentry | Metadata only: model, token counts, latency, stage names. **No document text, no client names, no amounts.** |
| Hosted-path request | OpenRouter → compliant endpoint | Explicit opt-in. Routed with `data_collection: "deny"`. Raw client names are stripped before this call |

### Why Atlas is opt-in

Storing extracted fields in a free cloud database is a reasonable product
decision — it is what makes corrections a durable training set across devices.
Storing the documents would not be. So sync is a deliberate, user-initiated
action that persists structured fields only, and the UI states exactly what
is stored before the first sync.

Atlas free (M0) clusters pause after 30 days of inactivity. Irrelevant for a
challenge demo; noted in the README so nobody is surprised later.

---

## 3. Hosted paths and what they cost you

Two hosted options were evaluated for the comparison path. They are not
equivalent, and the difference is worth being precise about.

### 3.1 Google AI Studio, free tier — rejected

The published pricing table lists, for the **Free** tier:
*"Content used to improve our products — Yes."* The **paid** tier: *"No."*

That is a published term applying to exactly the class of data this app
processes. It is still the clearest available illustration of why a hosted
free tier is not the same as a local model, and it is cited in `EVAL.md` and
the submission post as the motivating example. It is simply not where this
project sends data.

### 3.2 OpenRouter free tier — selected, with enforced routing

OpenRouter's documented position is that they route only to providers which
do not log or train on prompts and completions, *unless data collection is
explicitly enabled*. That default is favourable — and it can be turned from a
promise into a technical guarantee, per request:

```jsonc
{
  "provider": {
    "data_collection": "deny"   // never route to a provider that logs
  },
  "require_parameters": true    // only endpoints supporting response_format
}
```

`data_collection: "deny"` is a routing instruction, not a request to a
trusted party. If no compliant endpoint exists, the request fails rather than
silently degrading to a provider that logs. That failure mode is the point.

`require_parameters: true` guarantees the structured-output schema is honoured
rather than approximated by an endpoint that ignores `response_format`.

### 3.3 Residual risk, stated plainly

The model served is Google's, and the backing inference provider is Google AI
Studio. What is controlled is *which endpoints are eligible to serve the
request*, not what every intermediary does with it. This is meaningfully
better than an unconstrained hosted call and categorically different from the
local path — but it is not the same guarantee, and the product does not claim
it is.

The local path remains the default for exactly this reason. Hosted mode is
opt-in, shows its provenance before the first document is sent, and is never
presented as equivalent.

### 3.4 Availability, not privacy, is the real constraint

Free OpenRouter models are capped at **50 requests/day** without $10 of
purchased credits (1,000 with), and 20 requests/minute either way. The Gemma 4
free endpoints have also been observed returning `429 temporarily
rate-limited upstream` when Google AI Studio is saturated — the failure comes
from the provider, not OpenRouter's own counters.

This is a demo and evaluation path. It is not production infrastructure, and
the writeup says so rather than implying otherwise.

---

## 4. Deliberately absent

- No accounts, no login, no per-user identity
- No payment collection (also required by Vercel Hobby's non-commercial terms)
- No analytics on document content
- No error reporting that attaches file contents
- No cloud persistence by default
- No document storage of any kind

---

## 5. Verification checklist

Confirm before the challenge submission:

- [ ] Every build artifact greps clean for `OPENROUTER_API_KEY`, `TABPFN_API_KEY`, `MONGODB_URI`
- [ ] DevTools network panel during local extraction shows only `127.0.0.1`
- [ ] Disconnecting the network after model download does not break local extraction
- [ ] Sentry transactions contain no PII fields
- [ ] No uploaded file is written to disk or into an upload directory
- [ ] Atlas sync is off on a fresh load
- [ ] Atlas collections contain no image or raw-text fields

---

## 6. User-facing copy

On the upload screen, in plain language:

> Documents are processed on your device and are not stored or sent anywhere.
> If you turn on sync, only the extracted fields are saved — never the file
> itself. Payment prediction is the only feature that contacts an external
> service, and it sends numbers with hashed client names.

The product invites the user to verify this by opening the network tab.
