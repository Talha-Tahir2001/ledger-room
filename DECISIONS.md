# Ledger â€” Decision Log

An ADR-style record. Written for the submission post's "show your work"
section: judges read the reasoning behind the choices, not only the outcome.

---

## ADR-001 â€” Local-first is the default, not a fallback

**Context.** Every comparable tool is a hosted API call.
**Decision.** Extraction runs on the user's own hardware. Hosted models are an
explicitly opt-in comparison mode, disabled by default.
**Rationale.** The prompt asks where the open approach worked better. For this
data class â€” client names, project names, rates â€” privacy is not a feature,
it is the entire reason a freelancer would choose this over the obvious
alternative. Google AI Studio's free tier publishing "content used to improve
our products: Yes" is a concrete, citable instance rather than a philosophical
position.
**Consequence.** Slower and less accurate. Both are measured, not hidden.

## ADR-002 â€” Gemma 3 4B via Ollama as the extraction model

**Context.** 4C/8T CPU, 16 GB RAM, ~16 GB free disk, no GPU.
**Options.** `gemma3:4b` (3.3 GB) / `gemma3:1b` (815 MB) / 12B or 27B.
**Decision.** `gemma3:4b` primary, `gemma3:1b` for the size curve.
**Rationale.** 4B is the largest that stays genuinely usable on this CPU and
fits the disk with headroom for the app itself. 12B is 8.1 GB and materially
slower; 27B is 17 GB and would consume the remaining disk while remaining
unusably slow. `gemma3:4b` is multimodal with 128k context, so it stays useful
if image input is added later.
**Consequence.** Roughly 15â€“25s per document. Accepted, and surfaced in the
UI as an honest progress queue rather than hidden.

## ADR-003 â€” No DigitalOcean

**Context.** DigitalOcean is a $200 category and the account carries $5 of
signup credit, but account creation requires a credit card.
**Decision.** Drop the category. Use no paid infrastructure at all.
**Rationale.** Without a card, no droplet can be created, so the prize is
unreachable. Even with the card, $5 buys ~6.5 hours of a 20 GB GPU, and the
category asks for a project *deployed on* DigitalOcean. An ephemeral
evaluation droplet is not a deployment, and claiming it would be a
substantiation I could not honestly make.
**Consequence.** $200 forfeited. Six card-free categories retained instead.

## ADR-004 â€” TabPFN over REST from Next.js, not the Python SDK

**Context.** `tabpfn-client` is Prior Labs' recommended path, but this is a
TypeScript application.
**Decision.** Call `https://api.priorlabs.ai/tabpfn/{upload,fit,predict}`
from a server route handler, with `model_path: "v3.5_default"`.
**Rationale.** A Python sidecar means a second runtime, a second deployment
and a second failure mode inside a 30-hour window. The REST contract is
documented and stable. `v3.5_default` targets TabPFN-3.5-Plus, the version
Prior Labs recommends for the challenge.
**Consequence.** The API key stays server-side, which the route handler
guarantees regardless of deployment target.

## ADR-005 â€” Vercel primary, Render mirror

**Context.** Render is a $200 category. Vercel is not a sponsor at all.
**Decision.** Develop and deploy primarily on Vercel. Additionally create a
Render static site from the same repository and branch.
**Rationale.** Vercel is dramatically faster for Next.js 16 â€” zero-config
builds, preview deployments per push, proper server route handlers. Those
route handlers also let `OPENROUTER_API_KEY` and `TABPFN_API_KEY` stay
server-side, which a static export cannot do. But Render is worth $200 and
costs roughly 20 minutes to add, so the same build is deployed there as well
and linked in the submission. Forfeiting a category over a hosting preference
would be a poor trade.
**Consequence.** Two live URLs. The post explains the split plainly: Vercel is
the full application, Render serves the static build.

## ADR-006 â€” Vercel Hobby, no payment collection

**Context.** Vercel Hobby is free and needs no card, but its fair-use terms
restrict it to personal, non-commercial use. Vercel's own examples of
commercial use include processing payment, advertising a product, and
affiliate linking as the site's primary purpose.
**Decision.** Deploy on Hobby and ship no payment flow, no ads, no affiliate
links.
**Rationale.** The product has a $12/month pricing *hypothesis*, and testing
whether a user would pay is explicitly rewarded by the challenge. Stating a
hypothesis and asking a user whether they would pay is not the same as
collecting money, and the distinction keeps the deployment inside Hobby's
terms.
**Consequence.** Pricing exists as a written question, never as a checkout.

## ADR-007 â€” Client-orchestrated batches

**Context.** Vercel Hobby functions cap at 300 seconds. Thirty-five documents
at ~20s each is ~700s.
**Decision.** The browser drives the batch, one document per request.
**Rationale.** Forced by the platform limit, but better anyway: no request is
long enough to time out, progress is per-document and honest, and in local
mode it means document content never reaches a server at all.
**Consequence.** No single server invocation can process a whole batch.

## ADR-008 â€” Synthetic fixtures only

**Context.** Real invoices would be the most convincing demo.
**Decision.** Generate the entire fixture set synthetically.
**Rationale.** Committing real client invoices to a public repository and a
public submission would violate the product's own thesis and would put third
parties' data online. Synthetic fixtures also make ground truth authorable
and results reproducible.
**Consequence.** Fixture realism is bounded by the generator. Mitigated by
deliberately messy cases: rotated scans, low contrast, ambiguous dates,
decimal-comma locales, missing totals.

## ADR-009 â€” Schema-constrained output, not prompt-and-hope

**Context.** Extraction must return 11 typed fields.
**Decision.** Convert the Zod schema with `z.toJSONSchema()` and pass it as
Ollama's `format`, with `temperature: 0` and one repair round-trip on
validation failure.
**Rationale.** Small local models produce plausible-looking JSON with wrong
types. Schema enforcement converts a class of silent failures into a
detectable and recoverable condition.
**Consequence.** Occasional extra latency from the repair round-trip. Worth
it; the alternative is unreviewable output.

## ADR-010 â€” No free-GPU notebook for a larger-model data point

**Context.** Free GPU notebooks requiring no card could run a larger Gemma and
complete the accuracy curve.
**Decision.** Skip. The size curve runs `gemma3:1b` against `gemma3:4b` on
identical hardware.
**Rationale.** Inside a 30-hour window a shared, non-deterministic GPU session
is schedule risk with no card-required mitigation and no deployable artifact.
A 1B-versus-4B curve on fixed hardware is the cleaner comparison anyway,
because hardware is held constant and the result is reproducible by anyone.
**Consequence.** No hosted-size data point. `EVAL.md` discloses this explicitly
rather than letting the gap imply a larger model was tried.

## ADR-011 â€” MongoDB Atlas for corrections, opt-in and field-only

**Context.** Atlas M0 is free forever, 512 MB, and needs no credit card. But
Atlas Vector Search requires a paid search node and is unavailable on M0.
**Decision.** Use Atlas for `invoices`, `corrections` and `predictions`,
storing extracted fields only, behind an opt-in toggle that defaults off. Use
a local cosine scan over locally-generated embeddings for similar-invoice
retrieval instead of Vector Search.
**Rationale.** The genuinely interesting fit is `corrections`: every review
the user performs produces a correctly-labelled example of the exact failure
mode they care about. That is the dataset a fine-tune would need, generated as
a side effect of normal use. The vector-search constraint is sidestepped
honestly â€” brute-force cosine over a few thousand 768-dimension vectors is
microseconds in Node, and keeping it local preserves the no-paid-tier
property.
**Consequence.** Cloud persistence is optional and clearly bounded.

## ADR-012 â€” Confidence is computed, not model-reported

**Context.** Small models hallucinate confident numbers.
**Decision.** Score confidence by heuristic: schema completeness, whether the
value appears verbatim in the source text, and arithmetic consistency
(`subtotal + tax == total`).
**Rationale.** Asking a 4B model for its own confidence yields a number with
no calibration behind it. The heuristics are checkable and explicable.
**Consequence.** The score is not a probability. The UI labels it a
review-priority score.

## ADR-013 â€” Pre-computed demo dataset as a last resort

**Context.** A judge opening the live URL may have no Ollama and may arrive
after the hosted daily quota is spent.
**Decision.** Ship a pre-computed extraction result for the fixture set,
offered when no runtime is available, and labelled as demo data.
**Rationale.** The alternative is a judge landing on a page that cannot do
anything. The runtime banner keeps the honesty requirement intact â€” it never
presents the demo path as live inference, and ADR-013's successor ADR-015
places it last in the ladder, below the hosted path.
**Consequence.** The GIF and the live URL may not be the same thing, and the
post says which is which.

## ADR-014 â€” OpenRouter free Gemma 4 for the hosted path, not Google AI Studio

**Context.** The comparison and judge-facing path needs a hosted open-weight
model at zero cost, with no credit card. Two candidates: Google AI Studio's
free tier, and OpenRouter's free variants.

**Decision.** `google/gemma-4-31b-it:free` via OpenRouter, routed with
`provider: { data_collection: "deny" }` and `require_parameters: true`.

**Rationale.**

- *Privacy.* Google AI Studio's free tier publishes *"Content used to improve
  our products â€” Yes."* OpenRouter documents that it will not route to
  providers that log unless data collection is enabled, and that setting is
  controllable per request. The privacy property becomes a routing
  instruction rather than a promise â€” and if no compliant endpoint exists, the
  request fails rather than degrading quietly.
- *Capability.* The endpoint advertises `response_format`, so the same
  JSON-schema constraint used locally applies hosted. `require_parameters:
  true` guarantees it.
- *Compatibility.* OpenAI-compatible, so it shares a request shape with
  Ollama's `/v1` endpoint. One client abstraction, two backends.

**Consequences, stated honestly.**

- **50 requests/day** without $10 of purchased credits, 20/minute. A full
  20-fixture eval consumes nearly the entire daily budget, so local arms run
  first and the hosted arm is a declared subset or cached.
- Upstream 429s are common: the backing provider is Google AI Studio and
  independent checks found both Gemma 4 free models refused "temporarily
  rate-limited upstream." Requires backoff, and `unavailable` outcomes
  recorded separately from failures.
- **Not production.** 50 req/day with intermittent upstream saturation is
  demo infrastructure. The writeup says so.
- Google AI Studio remains cited in `PRIVACY.md` §3.1 as the motivating
  example of why free hosted tiers are not equivalent to local â€” it is simply
  not where this project sends data.

## ADR-015 â€” The hosted path is a fallback, not the default

**Context.** A judge opening the deployed URL has no Ollama and a 20-second
CPU extraction path is unusable for them.
**Decision.** The runtime ladder is `local` â†’ `hosted` â†’ `demo` â†’ `blocked`,
in that order of preference, surfaced in a banner that names the active
provider. The hosted path requires one explicit session confirmation.
**Rationale.** This is what makes the product testable by a judge without
pretending the deployed app is local. It also keeps the privacy claim
truthful: the local path exists, works, and is what the app prefers. The
banner never describes the demo dataset as live inference.
**Consequence.** Four states to build and test rather than three. Worth it â€”
this is the difference between a judge seeing a working product and seeing an
error page.

## ADR-016 â€” Best-effort redaction before any external call

**Context.** The routing guarantee controls which endpoints are eligible. It
does not control what an eligible endpoint does.
**Decision.** A regex pass strips organisation names near "invoice from",
"bill to", "sold by", and long digit runs resembling account or IBAN numbers,
before any text leaves the device.
**Rationale.** Defence in depth. It is a second layer, not a replacement, and
the UI states that it is best-effort obfuscation rather than anonymisation.
Overclaiming here would undermine the credible parts of the privacy argument.
**Consequence.** Cosmetic scrubbing, not guarantees. Honest labelling is part
of the feature.

## ADR-017 â€” Scope cut from seven categories to four

**Context.** The plan was built against a 30-hour window. The actual window
turned out to be 13.6 hours once planning and documentation were complete.

**Decision.** Four categories: Gemma, Prior Labs, MongoDB Atlas, Sentry. Cut
Render, .tech Domains and Entire.

**Rationale.** Writing is weighted most heavily in the rubric, and no amount of
category coverage compensates for a thin post. Four categories fully built and
well written beats seven categories where five are vestigial. The cuts were
chosen on prize-per-hour:

- `.tech` â€” `*.vercel.app` is an acceptable public URL. Lowest value cut.
- Entire â€” $100 for embedding a session. Time is better spent on prose.
- Render â€” the one cut worth revisiting. A static site from the same branch is
  ~20 minutes for $200, which is the best ratio available. Gated at hour 8
  rather than abandoned.

**Consequence.** $600 committed against a $1,000 ceiling. Every later time
decision defaults to protecting the writeup over adding a category.

## ADR-018 â€” MongoDB is fire-and-forget, never blocking

**Context.** Atlas integration normally means a connection layer, schema
design, queries and error handling. In a 13.6-hour window that is a trap.
**Decision.** Correction writes are fire-and-forget. Non-blocking, opt-in,
default off. If Atlas is unreachable the app is byte-for-byte identical in
behaviour.
**Rationale.** The category is worth $100; a broken or blocking database is
worth considerably less than $100 in a product whose whole thesis is
reliability. This framing caps the downside at 45 minutes because there is no
debugging surface â€” it connects or it does not.
**Consequence.** No offline queue, no retry, no sync conflict resolution. The
local `corrections.jsonl` remains the source of truth; Atlas is a convenience
copy.

## ADR-019 â€” Landing page built before deploy, not after

**Context.** A live URL is worth points, but an unimpressive one costs the
Render and overall-winner categories.
**Decision.** WS8 (landing) precedes WS9 (deploy). 1.75 hours reserved.
**Rationale.** Deploying an unfinished-looking product to get a URL early
spends the judge's first impression on the weakest version. Deploying once,
finished, is worth more than deploying twice.
**Consequence.** No early URL to share. Acceptable â€” the writeup and GIF
cover the gap, and the deploy is only 30 minutes.

## ADR-020 — Existing tokens used unmodified; the lime rule is a class rule

**Context.** The scaffold ships a `globals.css` with a lime primary, a full
semantic ramp, sidebar tokens, a radius scale, and separate `--font-sans` /
`--font-heading`. The brief was explicit: build on it, change none of it.
**Decision.** No edits to `globals.css`. All adaptation happens as Tailwind
class selection, using the `dark:` variant to swap accent roles per theme.

**Rationale.** Contrast was measured rather than assumed, and the results
show the token set is sound once used correctly:

- `--primary` (`#9ae600`) on white is **1.54:1** — unusable as text. This
  confirms lime must be a surface in light mode.
- `--primary-foreground` (`#35530e`) on white is **8.72:1**, and `--primary`
  (`#7ccf00`) on the dark background is **9.97:1**. Both pass AA, so the
  accent *text* role swaps cleanly between themes via
  `text-primary-foreground dark:text-primary`.
- `--muted-foreground` is **4.26:1** on white, a shade short of AA. Secondary
  text therefore uses `text-secondary-foreground dark:text-muted-foreground`.
- `--ring` is **2.32:1** on white, failing the 3:1 focus-indicator
  requirement. Focus uses `ring-foreground` instead, which also fits the
  visual language better: black hairline focus, lime for surfaces.

The ramp needs no extension. It was a usage problem, not a token problem.

**One pre-existing issue, documented not fixed.** Dark-mode primary buttons
measure **4.44:1**, short of AA by 0.06, because dark `--primary` is slightly
darker than light `--primary` while `--primary-foreground` is identical in
both. Shipped as-is per the no-changes constraint. If it is ever worth fixing,
raising dark `--primary` to `oklch(0.78 0.233 130.85)` resolves it while
staying lime. Recorded in the writeup as a genuine finding rather than quietly
ignored.

**Consequence.** Three non-obvious class rules must be applied consistently
or contrast silently regresses: accent text swaps per theme, secondary text
swaps per theme, focus rings use `foreground` not `ring`. Full recipes in
`DESIGN.md` §2.2.
