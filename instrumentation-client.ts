import * as Sentry from "@sentry/nextjs"

/**
 * Client-side tracing initialisation (FR-12).
 *
 * This is the file that produces the per-document spans: `lib/pipeline.ts`
 * wraps each document in one and each stage in a child, and this config decides
 * how much of that gets sampled.
 */

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 1),
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    // Deliberately no `tracePropagationTargets` covering localhost.
    //
    // Sentry injects a `sentry-trace` header into outgoing requests to any
    // matched origin. A matching origin turns a *simple* request into a
    // *preflighted* one, and Ollama's preflight response does not list
    // `sentry-trace` in `Access-Control-Allow-Headers`, so Chrome rejects the
    // probe and the runtime probe reports "no local runtime" on a machine that
    // has one. Ollama is not a tracing backend; there is nothing to propagate
    // a trace to. Sentry's own ingest requests are instrumented regardless.
    tracePropagationTargets: [],
  })
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart