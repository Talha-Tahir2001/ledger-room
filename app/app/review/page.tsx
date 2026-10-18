import { AppShell } from "@/components/app-shell"
import { AtlasSync } from "@/components/atlas-sync"
import { InvoiceTable } from "@/components/invoice-table"
import { RuntimeBanner } from "@/components/runtime-banner"

export default function ReviewPage() {
  return (
    <AppShell
      title="Review"
      description="Every cell is editable. Confidence is a review-priority score out of 100, not a probability — asking a 4B model about itself yields a number with no calibration behind it. Each correction is captured as a labelled example of a real failure mode."
    >
      <RuntimeBanner compact />
      <InvoiceTable />
      <AtlasSync />
    </AppShell>
  )
}