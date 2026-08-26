import { AnalyticsTab } from '@/pages/dashboard/analytics-tab'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BalanceTab } from '@/pages/dashboard/balance-tab'
import { NetworthTab } from '@/pages/dashboard/networth-tab'

// Módulo Dashboard (docs/pdr/dashboard.md) — tres pestañas: Balance (CU-061 a CU-064), Networth
// (CU-065 a CU-068) y Analytics (CU-069 a CU-071). Con esta última se completa el módulo.
export function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-medium text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Track your money, performance, and trends — all in one place.
        </p>
      </div>

      <Tabs defaultValue="balance">
        <TabsList>
          <TabsTrigger value="balance">Balance</TabsTrigger>
          <TabsTrigger value="networth">Networth</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="balance">
          <BalanceTab />
        </TabsContent>

        <TabsContent value="networth">
          <NetworthTab />
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
