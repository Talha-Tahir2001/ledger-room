# DEV Submission â€” Draft Outline

Tags: `devchallenge` `hf26challenge` â€” both required.
Copy the challenge page's submission template verbatim as the post skeleton,
then fill each section.

---

## Title

`Ledger: I built a local invoice sorter for freelancers and measured exactly
what the privacy costs in accuracy`

---

## 1. What I built

A freelancer has a folder of 20 invoices and receipts and needs them as a
spreadsheet their accountant accepts. That job costs $50â€“150/month outsourced,
or about three hours a month in-house.

Ledger does it in one click **on the user's own laptop**, then tells them which
open invoices are about to be paid late.

- Live (Vercel): https://ledger-room-indigo.vercel.app
- Repo: [link]
- Demo: [GIF]

## 2. Who would pay for it

Sam, a freelance designer. Three to eight client invoices a month plus a wall
of software and utility receipts, reconciled monthly and dreading it.

The specific ask being tested with my first user is **$12/month, framed around
the chase list rather than the extraction** â€” because the extraction is a
utility anyone can get, and the prediction is the part nobody else offers.

## 3. How it works

Mermaid architecture diagram from `ARCHITECTURE.md`. One short paragraph per
stage:

pdf.js text layer â†’ tesseract.js fallback â†’ Gemma 3 4B via Ollama with
schema-constrained output â†’ confidence scoring â†’ review and correct â†’ CSV
export â†’ TabPFN-3.5 payment prediction.

Worth calling out explicitly: **in local mode the browser talks to Ollama
directly.** The extraction request never reaches the server. There is no
server-side component that could log it.

## 4. The study â€” the centre of the post

The full `EVAL.md` tables, rendered.

Three-line summary:

- Local `gemma3:4b` on 4 CPU cores: **X% field accuracy, Ys per document,
  $0.00 per 35 invoices.00 per 20 invoices.**
- Hosted `gemma-4-31b-it:free`: **Z% â€” at the same $0.00.** Seven times the
  parameters, still free, still the same invoice data leaving the machine.
- 1B versus 4B on identical hardware: the curve showing what parameter count
  buys when you cannot afford hardware.

The 4B-versus-31B row is the interesting one, and it is also **not a clean
ablation** â€” the hosted arm is Gemma 4, the local arm is Gemma 3. Say that
plainly. Presenting it as a controlled parameter sweep would be the kind of
overclaim that loses the whole post on inspection.

**State what was not tested.** No model larger than 4B was run locally. There
was no GPU and no credit card for GPU infrastructure. The hosted 31B is
hosted, not local.

## 5. Where open beat the closed alternative â€” and where it did not

Open won on:

- **Cost.** $0.00 per 35 invoices.00 per 20 invoices on both arms. A hosted model seven times
  the size, also free. The interesting result is not that local is cheap â€” it
  is that the ceiling moved without a budget.
- **Privacy.** A local path that makes zero external requests, versus a hosted
  path where I can only guarantee *which endpoints are eligible*. The
  `data_collection: "deny"` routing flag is the part worth explaining: it is
  a constraint, not a promise, and it fails closed. Google AI Studio's free
  tier is the counter-example that made me look â€” it publishes "content used
  to improve our products: Yes", which is why this project does not send data
  there.
- **Swap-ability.** The same Zod schema and the same `response_format` call
  drive a 1B model on my laptop and a 31B model on someone else's GPU. The
  eval harness runs both without a code change.
- **Offline.** Local extraction works with the network disconnected after the
  model download.

Open lost on:

- **Accuracy.** The hosted 31B beat the local 4B. It was going to. What I
  care about is the size of the gap, not the direction.
- **Speed.** Roughly 20 seconds per document versus about two.
- **Availability.** Free hosted tiers are rate-limited and the upstream
  provider 429s under load. That is a real cost that does not show up in an
  accuracy table.

The trade is explicit and the numbers are above.

## 5a. How the hosted path is kept honest

A short section, because it is the most interesting engineering in the
project:

- Client names and account-number-like digit runs are redacted on device
  before any text leaves.
- Requests carry `provider: { data_collection: "deny" }` and
  `require_parameters: true`, so only endpoints honouring the JSON schema are
  eligible.
- If no compliant endpoint exists, the request fails. It does not fall back to
  something that logs.
- The banner names the active provider at all times, and the demo dataset is
  never labelled as inference.

And the honest caveat: this controls *which endpoints are eligible*, not what
every intermediary does. It is meaningfully better than an unconstrained call
and categorically different from local. It is not the same guarantee, and I do
not claim it is.

## 6. Payment prediction with TabPFN

What it predicts, how the features are built, and â€” importantly â€” the naive
baselines it has to beat. If TabPFN did not beat the client's own historical
mean at this data size, say so. A win that hides a weak baseline is worth less
than a loss that reports one.

## 7. What tracing revealed

Three to four Sentry screenshots. At least one real bug found and fixed by
reading a trace. This section is why the Sentry category exists â€” make it a
story, not a screenshot dump.

## 8. First user

A real freelancer, real feedback. What they asked for, whether they would pay,
what surprised them. Quote them directly, including anything unflattering.

## 9. Where the money went, and where it did not

Render, Vercel, Atlas, TabPFN, OpenRouter, Sentry, and Ollama â€” plus the
things I deliberately skipped: DigitalOcean, because the account required a
credit card I did not want to put on file, and a paid GPU, because six
categories that work without a card were worth more than one that did not.

I also rejected Google AI Studio's free tier, which would have been the
easier choice, because it publishes "content used to improve our products:
Yes."

This section exists because it is true and because the sponsor list includes
things I did not use.

## 10. Limitations

The honest list, in the app's own voice.

## 11. Build log

Embed the DevRelay session. Make it public first, and scrub keys from the
transcript.

## Attribution

shadcn/ui (Base UI variant), Next.js, Tailwind CSS, Ollama, Google's Gemma 3
weights, Tesseract, TabPFN (Prior Labs), MongoDB Atlas, Sentry.

## Disclosure

`ai_disclosure_level: some_ai`
