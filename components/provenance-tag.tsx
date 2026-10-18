"use client"

import { IconCloud, IconCpu, IconFileSearch, IconPhoto } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"

/**
 * Which runtime and which read path produced a row.
 *
 * This is not decoration. Whether a field came from a PDF text layer or from
 * OCR changes how much it should be trusted, and the accuracy study attributes
 * its failures to exactly these two causes — so the row carries its own
 * provenance rather than the reviewer having to remember.
 */
export function ProvenanceTag({ provenance }: { provenance: Invoice["provenance"] }) {
  const runtime = {
    local: { label: "local", icon: <IconCpu className="size-3" aria-hidden /> },
    hosted: { label: "hosted", icon: <IconCloud className="size-3" aria-hidden /> },
    demo: { label: "demo data", icon: <IconFileSearch className="size-3" aria-hidden /> },
  }[provenance.runtime]

  const read = provenance.textLayer
    ? { label: "text layer", icon: <IconFileSearch className="size-3" aria-hidden /> }
    : { label: "OCR", icon: <IconPhoto className="size-3" aria-hidden /> }

  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge variant="outline" className="gap-1">
        {runtime.icon}
        {runtime.label}
      </Badge>
      <Badge variant="outline" className="gap-1">
        {read.icon}
        {read.label}
      </Badge>
      <span className="text-xs text-secondary-foreground dark:text-muted-foreground">
        {provenance.model}
      </span>
    </span>
  )
}

type Invoice = import("@/lib/schema").Invoice