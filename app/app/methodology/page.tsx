import { AppShell } from "@/components/app-shell"
import { AccuracyStudy, ChaseStudySection } from "@/components/landing/accuracy-study"

export default function MethodologyPage() {
  return (
    <AppShell
      title="Accuracy study"
      description="The same tables the landing page shows, here as the primary reference. Every figure is regenerated from the committed measurement files by npm run results:export, so the document cannot drift from the run that produced it."
    >
      <AccuracyStudy />
      <ChaseStudySection />
    </AppShell>
  )
}