# Ledger

Turns a folder of mixed invoices and receipts into an accountant-ready CSV, on
your own hardware — and publishes a measured accuracy study of what that
actually costs.

Built for the [Hacktoberfest Open-Source AI Challenge](https://dev.to/tags/hf26challenge),
tag `hf26challenge`.

## What it does

1. Reads PDF, JPG and PNG in the browser — pdf.js text layer where one exists,
   tesseract.js OCR where it does not.
2. Extracts eleven typed fields with `gemma3:4b` running on your own CPU
   through Ollama, schema-constrained so output is valid by construction.
3. Scores each field for review priority and shows the arithmetic that does not
   add up.
4. Exports CSV and JSON, and captures every correction as a labelled example.
5. Predicts which open invoices will be paid late, with an interval, scored
   against the naive baselines it has to beat.

## Measured results

Twenty synthetic fixtures, hand-authored ground truth, i7-1165G7, no GPU.

| | |
|---|---|
| Field accuracy, local `gemma3:4b` | **66.2%** (n=19) |
| Exact-record accuracy | 5.3% |
| Schema violations | **0**, no repair round-trips needed |
| p50 / p95 latency | 67.8s / 101.0s per document |
| Cost per 20 invoices | **$0.00** |
| Size curve, `gemma3:1b` | 59.4% field accuracy at 37.7s |
| Payment prediction | TabPFN MAE 7.91d vs client-mean 8.12d |

Full tables, including the weakest fields and the gaps that were not filled:
[`EVAL.md`](./EVAL.md). The hosted 31B comparison was **not run** and says so
rather than being quietly omitted.

## Running it

```bash
npm install
cp .env.example .env          # add keys you have; none are required for local use
npm run dev
```

Open <http://localhost:3000>. Without Ollama the app offers a pre-computed
dataset so the whole flow is still exercisable; it is labelled as demo data and
never described as live inference.

### For the local path

```bash
ollama pull gemma3:4b
```

Then allow the browser origin, if your browser needs it:

```powershell
[Environment]::SetEnvironmentVariable("OLLAMA_ORIGINS", "http://localhost:3000", "User")
```

Restart Ollama after changing it.

> **Note on Chrome.** Chrome requires an
> `Access-Control-Allow-Private-Network` opt-in for a page to reach
> `127.0.0.1`, and Ollama does not send that header. On localhost the app
> therefore falls back to a same-origin development proxy, which it tells you
> about in the runtime banner. The deployed app always talks to Ollama directly
> from the tab. See the header comment in `app/api/local/route.ts`.

## Reproducing every number

```bash
npm run fixtures          # deterministic corpus: PDFs, PNGs, ground truth
npm run ingest:verify     # asserts text-layer vs OCR routing, one per fixture
npm run eval -- --model gemma3:4b --out results/eval-4b.json
npm run eval -- --model gemma3:1b --out results/eval-1b.json
npm run history           # synthetic invoice history for the chase list
npm run chase:eval        # TabPFN vs both baselines, held out
npm run results:export    # regenerates EVAL.md tables and the demo dataset
```

Model responses are cached under `results/cache/` keyed by
`sha256(fixtureText + modelId + schemaHash)`, so a repeated run costs nothing
and stays deterministic.

## Verifying it

```bash
npm run typecheck
npm run lint
npm run verify:secrets    # greps .next for every secret in the environment
npm run verify:atlas      # confirms Atlas stores fields only, never documents
```

## Routes

| Route | |
|---|---|
| `/` | Landing page, with the accuracy study rendered from committed results |
| `/app` | Upload, runtime banner, batch queue |
| `/app/review` | Editable results table, export, corrections, optional sync |
| `/app/chase` | Payment prediction against naive baselines |
| `/app/methodology` | The full study |
| `/app/privacy` | Data flow and a verification checklist |

## Privacy

- Documents are read in memory and never written to disk. There is no document
  store to breach.
- In local mode the extraction request never reaches a server.
- Atlas sync is opt-in, off by default, and stores extracted fields only.
- Payment prediction sends numbers and a hashed client id. The raw client name
  never leaves the device.
- Sentry receives metadata only, scrubbed by `instrumentation.ts`.

`PRIVACY.md` states this in full, including where it is weaker than it sounds.

## Known limitations

Local 4B extraction is less accurate than a frontier hosted model and this
project measures exactly how much less. Ambiguous numeric dates are a known
failure mode. Handwriting is out of scope. Payment prediction needs history —
below about twenty invoices it is weak, and the UI says so. The hosted path is
capped at 50 requests/day and subject to upstream rate limiting; it is a demo
path, not production infrastructure. Redaction before an external call is
best-effort obfuscation, not anonymisation.

## Documentation

| | |
|---|---|
| [`PRD.md`](./PRD.md) | Problem, persona, requirements |
| [`DESIGN.md`](./DESIGN.md) | Design system, locked |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | System design, per-document sequence |
| [`DECISIONS.md`](./DECISIONS.md) | 20 ADRs, including the ones that went the other way |
| [`EVAL.md`](./EVAL.md) | The accuracy study |
| [`PRIVACY.md`](./PRIVACY.md) | Data handling |
| [`PLAN.md`](./PLAN.md) | Execution plan and schedule |

## Attribution

Next.js, Tailwind CSS, shadcn/ui (Base UI variant), Ollama, Google's Gemma 3
weights, Tesseract, pdf.js, TabPFN (Prior Labs), MongoDB Atlas, Sentry.

Every fixture is synthetic. No real client invoice was ever committed to this
repository or sent anywhere.

MIT licensed — see [LICENSE](./LICENSE).