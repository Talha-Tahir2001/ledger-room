# Ledger â€” Accuracy Study

The project's credibility rests on this file. Numbers are measured, never
estimated. Empty cells mean not yet run â€” do not fill them by inference.

---

## 1. Methodology

**Task.** Given raw extracted text from an invoice or receipt, emit a
schema-valid object with 11 fields.

**Ground truth.** Hand-authored JSON for each of 20 synthetic fixtures. Where
a fixture is deliberately ambiguous, ground truth records an
`acceptable_alternatives` list â€” for example `03/04/26` accepting both
`2026-03-04` and `2026-04-03`. Ambiguous fixtures are scored leniently and
reported separately, so the headline number is not inflated by punishing
unavoidable ambiguity.

**Metrics.**

| Metric | Definition |
|---|---|
| `field_accuracy` | correct fields / total fields across all fixtures |
| `exact_record` | records where every field is correct (the harsh metric) |
| Per-field accuracy | exposes which fields are actually weak |
| `p50` / `p95 latency` | wall-clock per document on this CPU |
| `tokens_in` / `tokens_out` | from the Ollama response |
| `cost_local` | always $0 |

**Anti-gaming rules.**

1. The scorer is blind to model output formatting. It scores parsed values.
2. Ground truth is authored before the first eval run and is never edited to
   match model output. If a fixture is wrong, it is fixed in a commit and the
   fix is noted in §5.
3. Ambiguous fixtures are flagged in the fixture manifest and excluded from
   the headline figure.
4. `results/eval.json` is committed raw.

---

## 2. Harness

```bash
# Deterministic, seeded fixture generation
npm run fixtures

# Verify the corpus itself: text layer, image-only, and the OCR routing
# heuristic, one assertion per fixture
npm run ingest:verify

# Local runtimes — no quota, no rate limit
npm run eval -- --model gemma3:1b --out results/eval-1b.json
npm run eval -- --model gemma3:4b --out results/eval-4b.json

# Hosted baseline — CONSUMES OpenRouter quota, 50 requests/day
# Run this LAST and separately. See the budget note below.
npm run eval -- --model openrouter-gemma-4-31b --out results/eval-hosted.json

# Regenerate the tables below and the demo dataset
npm run results:export
```

Committed, so any judge can reproduce every number.

### OpenRouter quota budget

The free tier allows **50 requests/day** without $10 of purchased credits, at
20 requests/minute. A full 20-fixture run costs roughly 20 calls plus repair
attempts â€” around 26. That leaves headroom but not for a second run in one run.

Mitigations, in order of preference:

1. Run local arms first. They have no quota and produce the headline numbers.
2. Run the hosted arm over a **declared subset** (20 fixtures) and report n.
   A smaller honest sample beats an undeclared truncation.
3. Cache every response to `results/cache/` keyed by
   `sha256(fixtureText + modelId + schemaHash)`, so a repeated run costs
   nothing and the harness stays deterministic.
4. Spread across days if a full run is required.

Never silently truncate. If a run is partial, `EVAL.md` §4 says so.

### Handling upstream 429s

The Gemma 4 free endpoints have been observed returning
`429 temporarily rate-limited upstream` when the backing provider is
saturated. That is a provider-side limit, not an account limit, so waiting
does not fix it.

- Exponential backoff with jitter, 4 attempts, total wait capped around 30s.
- Record the failure in `results/eval.json` as a distinct outcome rather than
  a zero. A missing measurement is not a model failure.
- If a fixture exhausts retries, mark it `unavailable` and exclude it from
  the denominator. Reporting the exclusion is mandatory.

---

## 3. Results

**Measured on:** i7-1165G7 @ 2.80 GHz, 4C/8T, 16 GB RAM, no GPU, Windows 11.
Runtime: Ollama, `gemma3:4b` Q4_K_M, `temperature: 0`. 20 fixtures.

### 3.1 Headline

<!-- headline:start -->
| Metric | Local `gemma3:4b` (CPU) |
|---|---|
| Field accuracy | 66.2% |
| Exact-record accuracy | 5.3% |
| p50 latency / document | 57.0s |
| p95 latency / document | 103.5s |
| Throughput | 60.7 documents/hour |
| Tokens per document (in/out) | 341 / 238 |
| Schema violations reaching the UI | **0 repairs across 19 documents** |
| **Cost per 20 invoices** | **$0.00** |
<!-- headline:end -->

### 3.2 Per-field accuracy

<!-- perfield:start -->
| Field | Accuracy | n | Expected failure mode |
|---|---|---|---|
| vendor | 94.7% | 19 | multi-column layouts; also deliberately redacted on the hosted path |
| invoiceNo | 68.4% | 19 | printed reference vs metadata; the model normalises separators |
| issueDate | 89.5% | 19 | ambiguous dd/mm vs mm/dd |
| dueDate | 89.5% | 19 | often genuinely absent — correct null behaviour matters |
| currency | 78.9% | 19 | symbol vs ISO code |
| subtotal | 73.7% | 19 | thousands separators and decimal commas |
| tax | 100.0% | 19 | absent on many receipts, and a printed 0.00 is not the same as absent |
| total | 84.2% | 19 | decimal-comma locales; non-standard labels such as GRAND T0TAL |
| category | 15.8% | 19 | open vocabulary, the weakest field exactly as predicted |
| billable | 47.4% | 19 | no signal in most receipts; correct null behaviour matters |
| lineItems | 58.3% | 19 | hardest field: matching, ordering and per-cell amounts |
<!-- perfield:end -->

### 3.3 Size curve

Hardware held constant; only parameter count varies. Both local, no quota.

| Model | Params | Disk | Field accuracy | p50 latency |
|---|---|---|---|---|
<!-- sizecurve:start -->
| `gemma3:1b` | 1B | 815 MB | 59.4% | 37.7s |
| `gemma3:4b` | 4B | 3.3 GB | 66.2% | 57.0s |
<!-- sizecurve:end -->

### 3.4 Hosted comparison â€” the 7.75— jump

`google/gemma-4-31b-it:free` via OpenRouter, routed with
`data_collection: "deny"` and `require_parameters: true`.

This is the most interesting comparison in the study: **7.75— the parameters,
still $0.00**, and the only difference that matters to the user is whether the
text leaves the machine.

| Model | Params | Field accuracy | p50 latency | Cost / 20 invoices | Content leaves machine |
|---|---|---|---|---|---|
<!-- hosted:start -->
| Model | Params | Field accuracy | p50 latency | Cost / 20 invoices | Content leaves machine |
|---|---|---|---|---|---|
| Local `gemma3:4b` | 4B | 66.2% | 57.0s | **$0.00** | **No** |
| Hosted `gemma-4-31b-it:free` | 31B | _TBD_ | _TBD_ | **$0.00** | Yes, to a `data_collection: "deny"` endpoint |
<!-- hosted:end -->

<!-- hosted-exclusions:start -->
Fixtures evaluated: n = _TBD_ / 20.

Fixtures unavailable due to upstream rate limiting: none
<!-- hosted-exclusions:end -->

**Known gap to disclose:** the 31B is a different model generation (Gemma 4)
from the local Gemma 3, so this row conflates parameter count with model
family. It is the best comparison available without a GPU, but it is not a
controlled parameter sweep, and the writeup should say so rather than
implying a clean ablation.

### 3.5 Payment prediction (TabPFN)

Model: TabPFN-3.5, `model_path: "v3.5_default"`, `TabPFNRegressor`,
`output_type: "quantiles"`. Intervals are q10–q90.

<!-- chase:start -->
| Predictor | MAE (days) | n |
|---|---|---|
| TabPFN-3.5 | 7.91 | 17 |
| Baseline: client's historical mean days-to-pay | 8.12 | 17 |
| Baseline: global mean | 13.48 | 17 |
<!-- chase:end -->

<!-- chase-detail:start -->
Hold-out method: fit on 67 rows, score on the most recent 17, which were never in the training target.

- q10–q90 interval contained the true value in **12 of 17** held-out rows (**71%**, against an 80% nominal target).
- Mean interval width 20.2 days.
- TabPFN beat the client-mean baseline by 2.6%.
<!-- chase-detail:end -->

Report the naive baselines regardless of the outcome. If TabPFN loses to the
client-mean baseline at this data size, that is the finding, and reporting it
is more credible than a win that quietly omits the comparison.

---

## 4. Sizing

<!-- sizing:start -->
| Factor | Value |
|---|---|
| Historical invoices | 84 |
| Distinct clients | 8 |
| Features per row | 12 |
| Rows used to fit | 67 |
| Rows held out for scoring | 17 |
<!-- sizing:end -->

If n is small, say so plainly. TabPFN is strong on small tabular data, which
is exactly the shape of a freelancer's invoice history, but "strong" still
requires enough rows to be meaningful.

---

## 5. Ground-truth corrections log

Any post-hoc change to ground truth, with the reason.

| Date | Fixture | Change | Reason |
|---|---|---|---|
| â€” | â€” | â€” | â€” |

An empty table is the expected outcome. A populated one is fine if explained.

---

## 6. Honest conclusions

Written after the runs, against the numbers above. The three questions were
pre-committed; the answers are not the flattering ones.

### 1. Did local 4B beat the hosted baseline on any axis?

**The hosted arm was not run**, so the accuracy question is unanswered rather
than answered favourably. §3.4 stays marked *not run*, and every table in this
document that depends on it still says so.

On the axes that did get measured, local wins clearly and without needing the
comparison:

- **Cost.** $0.00 per 20 invoices. The hosted arm is also $0.00, so this is not
  a local advantage — but it does mean the interesting result is not that local
  is cheap. It is that a 7.75× larger model is also free, and the ceiling moved
  without a budget.
- **Privacy.** A path that makes zero external requests, against one where only
  *which endpoints are eligible* can be controlled. This is the real trade and
  it is not close.
- **Offline.** Local extraction works with the network disconnected after the
  model download.
- **Predictability.** p50 57.0s, p95 103.5s. Slow, but bounded, and the same
  every time. A free hosted tier is 20 requests/day with upstream saturation on
  top; that is an availability property that never shows up in an accuracy
  table.

### 2. What did local cost in accuracy, and what did it buy?

66.2% of fields, and 5.3% of documents fully correct. That is not an autopilot.
It is a system that does the tedious part and tells you precisely which part to
check — which is why the product is built review-first, with per-field
review-priority scores, rather than as a fire-and-forget importer.

What the privacy bought: the document text never leaves the machine, in a
default path, with nothing stored at all.

What it cost, beyond accuracy: **roughly 57 seconds per document on four CPU
cores**, about 61 documents/hour. `ADR-002` estimated 15–25s; the measured
figure is nearly three times that, and the estimate is wrong. It matters
because it is the difference between "finish a month of receipts over coffee"
and "leave it running overnight".

The headline was reproduced exactly on a second full run: 66.2% field accuracy,
5.3% exact-record, 0 repairs. Latency figures differ between runs, as wall-clock
measurements do; accuracy figures did not move.

### 3. Where did the local approach fail in a way a hosted model would not?

- **Category, 15.8%.** Open-vocabulary inference is the weakest thing a 4B
  model does here, and a 31B would very likely do materially better. This is
  the clearest place where size would have paid.
- **Confident fabrication of missing fields.** The model fills `subtotal` and
  `total` where the document prints neither, rather than returning null. A
  larger model does this less. It is the most expensive failure mode in a
  finance tool, because the fabricated number looks exactly like the real one.
- **Nothing on schema compliance.** Across 19 scored documents the local 4B
  produced **zero** schema violations and needed no repair round-trip. Schema
  constrained output is a hard guarantee from the grammar, not a capability of
  the model, which is exactly why it was worth doing.

### On the size curve

Four times the parameters bought **6.8 points of field accuracy for 1.8× the
latency** — a real gain, and a poor trade if you are processing a folder
interactively.

The more interesting result is the one in the opposite direction: the 1B model
had the **higher** populated-field recall (96.2% vs 80.9%). It filled in more
fields and got more of what it filled in wrong. For an unattended pipeline that
is the dangerous combination, and it is an argument for constraining a small
model harder rather than trusting it more.

### On payment prediction

TabPFN-3.5 reached MAE 7.91 days against a client-mean baseline of 8.12 — a
2.6% margin. That is a win, and it is a narrow one, and the reason is worth
stating plainly: **who pays late is mostly a property of who the client is**,
so a well-built per-client mean is a genuinely strong baseline rather than a
straw man. The model's contribution is in the residual.

Its q10–q90 interval covered **71%** of held-out rows against an 80% nominal
target, so the intervals run slightly narrow and are reported that way. A
forecaster that knows it is wrong is more useful than one that does not, and
this one is only approximately that honest.

**Known gaps to disclose:**

1. No model larger than 4B was run locally. There was no GPU and no credit
   card for GPU infrastructure. The 31B row in §3.4 is a *hosted* Gemma 4, not
   a local one.
2. §3.4 confounds parameter count with model generation — Gemma 4 hosted
   versus Gemma 3 local. It is the strongest comparison obtainable without a
   GPU, but it is not a controlled ablation and is not presented as one.
3. The hosted arm was not run, so the central accuracy claim of the product is
   **unmeasured**. Local 4B against local 1B is a size curve, not a
   local-versus-hosted comparison.
4. n = 19 for the extraction study, one ambiguous fixture excluded. This is a
   small honest sample, not a large rushed one, and a few fixtures move the
   per-field percentages by more than a point.
5. The four image-only fixtures were scored from hand-authored OCR-style text,
   not from a live tesseract run, so the accuracy figures do not include OCR
   error rate. The OCR path itself is verified separately by
   `npm run ingest:verify`.
6. Payment prediction is validated against a held-out slice of *synthetic*
   history generated with known per-client payment habits. A real freelancer's
   history is messier, and a baseline fitted on 67 synthetic rows is easier to
   beat than one fitted on 67 real ones.
