"use client"

import { IconAlertCircle, IconCircleCheck, IconInfoCircle } from "@tabler/icons-react"

import { BAND_LABEL, bandFor } from "@/lib/confidence"
import { cn } from "cn"

/**
 * A review-priority score, labelled as one.
 *
 * It is not a probability, and the copy never implies it is. The number is
 * always shown next to the band and its icon, so the meaning survives for a
 * reader who cannot see the colour — which DESIGN.md §6.3 requires and which
 * is also just better UI for a number people are meant to act on.
 */
export function ConfidenceBadge({
  score,
  field,
  className,
}: {
  score: number
  field?: string
  className?: string
}) {
  const band = bandFor(score)
  const percent = Math.round(score * 100)

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-none px-1 py-0.5 text-xs tabular-nums",
        band === "low"
          ? "bg-destructive/10 text-destructive dark:bg-destructive/20"
          : band === "medium"
            ? "bg-muted text-secondary-foreground dark:bg-muted-foreground"
            : "text-secondary-foreground dark:text-muted-foreground",
        className
      )}
      title={
        field
          ? `${field}: review-priority score ${percent}/100 — ${BAND_LABEL[band]}`
          : `Review-priority score ${percent}/100 — ${BAND_LABEL[band]}`
      }
    >
      {band === "low" ? (
        <IconAlertCircle className="size-3 shrink-0" aria-hidden />
      ) : band === "high" ? (
        <IconCircleCheck className="size-3 shrink-0" aria-hidden />
      ) : (
        <IconInfoCircle className="size-3 shrink-0" aria-hidden />
      )}
      <span>{percent}</span>
      <span className="sr-only">
        {`out of 100 review priority, ${BAND_LABEL[band]}`}
      </span>
    </span>
  )
}

/** The row-level summary: a document is only as good as its weakest field. */
export function RowConfidence({ score, count }: { score: number; count: number }) {
  const band = bandFor(score)
  return (
    <span className="inline-flex items-center gap-1.5">
      <ConfidenceBadge score={score} />
      <span className="text-xs text-secondary-foreground dark:text-muted-foreground">
        weakest of {count} fields
      </span>
      <span className="sr-only">{`— ${BAND_LABEL[band]}`}</span>
    </span>
  )
}