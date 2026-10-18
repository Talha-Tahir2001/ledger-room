import { AppShell } from "@/components/app-shell"
import { ChaseList } from "@/components/chase-list"

export default function ChasePage() {
  return (
    <AppShell
      title="Chase list"
      description="Predicts which open invoices will be paid late, with an interval, and shows the naive baselines it has to beat. Below about 20 historical invoices this is weak, and the intervals are wide enough to say so."
    >
      <ChaseList />
    </AppShell>
  )
}