# Ledger — Execution Plan

**Project:** Ledger — local-first invoice & receipt sorter for freelancers
**Challenge:** Hacktoberfest Open-Source AI Challenge, Week 2 (`#hf26challenge`)
**Deadline:** 2026-10-19 06:59 UTC (11:59 UTC+5)
**Prepared:** 2026-10-18 UTC+5
**Working budget:** ~30h of the ~35h available

---

## 1. Objective

Ship a deployed, judge-testable web app that converts a folder of mixed
invoices and receipts into an accountant-ready CSV, and predicts which open
invoices will be paid late. Extraction runs on an open-weight model on the
user's own hardware. Everything is documented with a reproducible accuracy
study.

## 2. Hard constraints

| Constraint | Value | Consequence |
|---|---|---|
| No GPU | i7-1165G7, 4C/8T | Only models ≤4B are usable locally |
| Disk | ~16 GB free | Single local model; no 12B/27B pull |
| RAM | 16 GB | 4B Q4 leaves ample headroom |
| No credit card | — | No DigitalOcean, no paid inference |
| Vercel Hobby | Free, no card | **Personal, non-commercial only.** No payment button, no ads, no affiliate links. |
| Vercel Hobby functions | 300 s max duration | Batch extraction must be client-orchestrated, one document per request |
| Vercel Hobby limits | 100 GB transfer, 1M invocations, 4 CPU-h/mo | Fine for a demo; document processing is mostly client-side |
| OpenRouter free tier | 50 req/day, 20 req/min | Local arms first; hosted arm is a declared subset or cached |
| OpenRouter upstream | Google AI Studio, frequently 429 | Backoff, `unavailable` outcomes, demo fallback |
| Time | **13.6h** | Four categories max, no stretch. Cut at hour 22 from an original 30h plan |
| New work | Must start Oct 12+ | Git history must show this |
## 3. Target prize categories (4, $600)

Scope was cut from seven to four when the window shrank to 13.6 hours. Writing
is weighted most heavily by the rubric, so the budget belongs there — three
categories done well beats six rushed.

| # | Category | Amount | Dependency | Effort | Card |
|---|---|---|---|---|---|
| 1 | Gemma | $200 | Ollama + `gemma3:4b`; hosted arm via OpenRouter free Gemma 4 | Core | No |
| 2 | Prior Labs (TabPFN) | $200 | platform.priorlabs.ai free key | ~1.5h | No |
| 3 | MongoDB Atlas | $100 | Free M0 cluster, 512 MB | ~45m | No |
| 4 | Sentry Agent Tracing | $100 | Free developer org | ~30m | No |

**Cut: Render, .tech Domains, Entire.** Render was dropped on the assumption
that Vercel replaces it. Vercel is not a sponsor, but a Render *static* site
from the same branch is ~20 minutes for $200 — the best ratio on the board —
so it is gated rather than abandoned (below). `.tech` dropped: `*.vercel.app`
is an acceptable public URL. Entire dropped: worth $100, but the time is
better spent on the post.

Deliberately never pursued: DigitalOcean (card required), Thinking Machines /
Tinker (needs credits), Backboard, ElevenLabs, GitHub Copilot, SerpApi,
Temporal, Tiger Data, Mastra, Qualcomm Arduino.

### The hour-8 gate

Two items are gated, not committed. Both are additive and neither may block
the core app. Both must not start before the core extraction path works.

| Item | Gate | If not done |
|---|---|---|
| MongoDB Atlas | Hour 8 | Ship without. Category lost, app unaffected. |
| Render static mirror | Hour 8 | Ship without. $200 forfeited. |

## 4. Deployment topology

| Target | Role | What it serves |
|---|---|---|
| `localhost` | Development | Full app, live Ollama, real fixtures |
| Vercel | **Primary and public** | Full build at `*.vercel.app`. Hosts the hosted-path route handlers. |
| Render | Optional mirror, gated | Static export of the same branch, if hour-8 capacity allows |
| MongoDB Atlas | Optional, gated | Opt-in sync of extracted fields only, fire-and-forget |


## 5. Workstreams

### WS1 — Risk retirement (0:00–3:00) `GATE`

The whole project depends on Gemma 3 4B returning schema-valid JSON through
Ollama's structured-outputs `format` field, from the browser, on messy
invoice text. Nothing else is built until this is proven.

- [ ] `ollama run gemma3:4b` responds
- [ ] Define the extraction Zod schema
- [ ] `z.toJSONSchema()` → Ollama `format` field
- [ ] Schema-valid output on 5 hand-written invoices
- [ ] **Browser → Ollama direct call works** (set `OLLAMA_ORIGINS`, confirm no mixed-content block)
- [ ] Measure tokens/sec on this CPU

**Gate:** if browser→Ollama cannot be made to work inside 3 hours, fall back
to routing local extraction through a Next.js route handler during dev only,
and lead the judge demo with the pre-computed dataset. Do not proceed on hope.

### WS2 — Evaluation harness + fixtures (1:00–2:00)

Built before the UI, because it is what makes the project credible and what
the writeup is built on.

- [ ] Generate **20** synthetic invoices/receipts (trimmed from 35 for time)
- [ ] Author ground-truth JSON for each
- [ ] Scorer: per-field accuracy, exact-record rate, latency, token cost
- [ ] Run against local `gemma3:4b` — headline numbers, no quota consumed
- [ ] Optional: OpenRouter free `gemma-4-31b-it` as the hosted comparison.
      **Consumes the 50/day quota — run last, over a declared subset, with
      response caching keyed by `sha256(fixtureText + modelId + schemaHash)`.**
- [ ] Drop the 1B arm if time is short. It is the weakest of the three rows.

### WS3 — Ingest + OCR (2:00–3:15)

- [ ] PDF text-layer extraction via `pdf.js` in the browser
- [ ] Fallback rasterization → `tesseract.js` (WASM, `eng`)
- [ ] Heuristic: skip OCR when the text layer is dense enough

### WS4 — Core app (3:15–6:15)

- [ ] Next.js 16 + TypeScript + Tailwind + shadcn (Base UI variant), per `DESIGN.md`
- [ ] Upload: drag-drop, multi-file, per-document progress queue
- [ ] Runtime ladder in `/api/health`: local → hosted → demo → blocked, with
      remaining hosted quota surfaced
- [ ] Best-effort redaction pass before any external call (ADR-016)
- [ ] Extraction: schema-constrained, `temperature: 0`, one repair round-trip
- [ ] Review table: inline edit, per-field confidence flags
- [ ] Correction capture → local `corrections.jsonl`
- [ ] CSV + JSON export

### WS5 — TabPFN chase list (6:15–7:30)

Highest value per hour after Gemma. Protect this one.

- [ ] CSV upload of ≥12 months of invoice history
- [ ] `/tabpfn/fit` → `/tabpfn/predict`, `v3.5_default`, `TabPFNRegressor`
- [ ] `output_type: "quantiles"` → predicted days-to-payment + q10/q90 interval
- [ ] Feature engineering: client (hashed), amount, issue lag, client history
      count, that client's historical mean days-to-pay, seasonality
- [ ] Chase list sorted worst-first
- [ ] Naive baselines (client-mean, global-mean) so the result is credible

### WS6 — Persistence (gated, 30–45 min)

Fire-and-forget, silently degradable. See ADR-011 and ADR-017.

- [ ] Atlas M0 cluster, 512 MB, no card
- [ ] Collections: `invoices`, `corrections`, `predictions`
- [ ] Opt-in sync toggle, **default off**, non-blocking writes
- [ ] Store extracted fields only — never the document, never raw OCR text
- [ ] If Atlas is not connected and working within 45 minutes, abandon it

### WS7 — Observability (30 min)

- [ ] Sentry: one transaction per document, spans for OCR / LLM / validation
- [ ] Tags: `llm.model`, `llm.tokens_in`, `llm.tokens_out`, `runtime`
- [ ] Capture 2–3 trace screenshots, including one real bug found and fixed

### WS8 — Landing page (1.75h)

Per `DESIGN.md` §8. Twelve sections, shadcn primitives only, CSS-first motion.
The accuracy-study section renders `EVAL.md` for real, `_TBD_` cells visibly
marked as pending.

- [ ] Header, hero, problem, how-it-works
- [ ] Product preview, accuracy study, privacy, pricing, footer
- [ ] Light/dark across every section, respect system, no flash

### WS9 — Deploy (30 min)

- [ ] Vercel: connect repo, set env vars, verify production build
- [ ] Optional Render static mirror if the gate allows
- [ ] Grep the build output for every secret
- [ ] Confirm the judge path works unaided

### WS10 — Write & publish (2h, starts on time)

**Non-negotiable. Starts when it starts, regardless of build state.**

- [ ] Draft per `POST_OUTLINE.md`
- [ ] Tags: `devchallenge`, `hf26challenge`
- [ ] Publish with buffer

## 6. Schedule (local, UTC+5)

| Start | End | Hours | Block |
|---|---|---|---|
| 22:25 | 00:00 | 1.6 | WS1 risk retirement gate |
| 00:00 | 01:00 | 1.0 | WS2 harness + 20 fixtures |
| 01:00 | 02:15 | 1.25 | WS3 ingest + OCR |
| 02:15 | 05:15 | 3.0 | WS4 core app |
| 05:15 | 06:30 | 1.25 | WS5 TabPFN |
| 06:30 | 07:15 | 0.75 | WS6 Mongo (gated) |
| 07:15 | 07:45 | 0.5 | WS7 Sentry |
| 07:45 | 09:30 | 1.75 | WS8 landing page |
| 09:30 | 10:00 | 0.5 | WS9 deploy |
| **10:00** | **12:00** | **2.0** | **WS10 write and publish** |
| 12:00 | 11:55 | — | Buffer |

**Total planned work: 13.0h against a 13.5h window. There is effectively no
slack, which is why the gates below exist.**

### Hard checkpoints

| Time | Check | If failing |
|---|---|---|
| 00:00 | Schema-constrained extraction works | JSON-mode + repair fallback; if still broken, pivot the whole product to the demo dataset and write about that |
| 02:15 | Core app demonstrable | Ship a thinner app: single-file upload, no batch queue |
| 05:15 | TabPFN working | Drop to client-mean baseline only and report that honestly. Category still claimable if TabPFN is called at all |
| 07:00 | Mongo gate | Abandon. Category lost, app unaffected |
| 09:30 | Deploy working | Publish anyway with a local-demo GIF. A post with no live URL still scores |
| **10:00** | **Writing starts. Always.** | Non-negotiable |

**Nothing starts late and nothing runs long.** The gates are ordered by
prize-per-hour so the most valuable work is protected first.

## 7. Synthetic fixture set

**20 documents**, trimmed from an original 35 for the shorter window.
Deliberately varied to stress the extractor:

- Text-layer PDF versus image-only scan (forces the OCR path)
- SaaS subscriptions, utilities, restaurants, coworking, hardware,
  international vendors
- Currencies: USD, EUR, GBP, PKR
- Layouts: table line-items versus prose totals
- Deliberate mess: rotated scans, low contrast, stamp overlap, missing total
  row, ambiguous dates (`03/04/26`), thousands separators versus decimal commas

Real client data is never used. See `PRIVACY.md`.

A smaller honest set beats a larger rushed one: 20 fixtures with authored
ground truth produces a real per-field breakdown, and every field is the same
work either way.

## 8. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Gemma 4B fails schema compliance | Medium | Critical | Gate at 00:00; JSON-mode + repair-retry fallback |
| Browser → Ollama blocked by CORS or mixed content | Medium | Critical | WS1 gate. `OLLAMA_ORIGINS`; localhost is a secure context. Fallback: route handler in dev, demo dataset for judges |
| Running out of time | **High** | **Fatal** | Hard checkpoints above. Writing starts at 10:00 regardless |
| TabPFN key approval delayed | Medium | High | Apply at hour 0; build against a recorded fixture meanwhile |
| Ollama too slow for a live judge demo | High | Medium | Demo dataset is pre-computed and instant; hosted path gives real extraction; live local path in the GIF |
| CPU accuracy below 60% per field | Medium | Medium | Report honestly. The deficit *is* the finding |
| Hosted 50/day quota exhausted by demo traffic | High | Medium | Quota surfaced in the banner before a batch starts; `blocked` falls back to demo |
| Upstream 429 on Gemma 4 free | High | Low | Backoff; `unavailable` recorded distinctly from failure; exclusions reported |
| History too small for meaningful prediction | High | Medium | Ship synthetic history CSV in repo; state n and intervals plainly |
| Vercel Hobby non-commercial terms | Low | High | No payment processing, no ads, no affiliate links. Pricing stays a written hypothesis |
| Atlas free cluster pauses after 30 days idle | Low | Low | Irrelevant for a challenge; note it in the README |
| Scope creep | **High** | **High** | Hard cap at four categories. Non-negotiable |
| Missing the deadline | Low | Fatal | Publish at 10:00 with whatever works |

## 9. Definition of done

- [ ] Live URL on `*.vercel.app`, HTTPS, no login required
- [ ] 20 fixtures → valid CSV in one click
- [ ] Runtime banner correctly reports local / hosted / demo / blocked
- [ ] Review table editable; corrections captured and persisted
- [ ] Chase list renders TabPFN predictions with intervals and baselines
- [ ] `EVAL.md` results table filled with measured numbers only
- [ ] ≥2 Sentry trace screenshots, ≥1 showing a fixed bug
- [ ] Landing page complete per `DESIGN.md` §8, light and dark
- [ ] README, LICENSE, `.env.example` present
- [ ] No secret present in any build artifact
- [ ] First-user feedback recorded, whatever it says
- [ ] DEV post published with both required tags

## 10. No-credit-card dependency checklist

| Service | Requirement | Notes |
|---|---|---|
| Ollama | Local install | Already done |
| OpenRouter | Free tier | No card. 50 req/day. Gemma 4 31B `:free` |
| Google AI Studio | Free tier | **Not used.** Free tier: "content used to improve our products" |
| platform.priorlabs.ai | Free non-commercial licence | No card |
| sentry.io | Developer org | No card |
| Vercel | Hobby | No card. **Non-commercial use only** |
| MongoDB Atlas | M0 free cluster | No card. 512 MB. No Atlas Vector Search on M0. Pauses after 30 days idle |
| Render | Hobby | No card. Optional, hour-8 gated |
| get.tech | Hacktoberfest promo claim | Cut — `*.vercel.app` accepted |
| DevRelay | MyMLH login | Cut — Entire category dropped |
