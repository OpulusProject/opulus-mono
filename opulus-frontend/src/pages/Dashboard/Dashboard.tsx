import data from "./data.json"
import { AppLayout } from "@/common/AppLayout"
import { ChartAreaInteractive, DataTable, SectionCards } from "./components"

export default function Dashboard() {
  return (
    <AppLayout>
      <SectionCards />
      <div className="px-4 lg:px-6">
        <ChartAreaInteractive />
      </div>
      <DataTable data={data} />
    </AppLayout>
  )
}
