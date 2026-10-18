import { AppShell } from "@/components/app-shell"
import { RuntimeBanner } from "@/components/runtime-banner"
import { UploadDropzone } from "@/components/upload-dropzone"

export default function UploadPage() {
  return (
    <AppShell
      title="Upload"
      description="Drop a folder's worth of invoices and receipts. Each document is read in this tab, extracted by a model on your own machine, and scored for review priority."
    >
      <RuntimeBanner />
      <UploadDropzone />
    </AppShell>
  )
}