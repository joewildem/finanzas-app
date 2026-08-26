import { ChartLineIcon } from '@hugeicons/core-free-icons'

import { EmptyState } from '@/components/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BalanceTab } from '@/pages/dashboard/balance-tab'
import { NetworthTab } from '@/pages/dashboard/networth-tab'

// Módulo Dashboard (docs/pdr/dashboard.md) — tres pestañas: Balance (CU-061 a CU-064, construida),
// Networth y Analytics (pendientes de documentar y construir).
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
          <Card>
            <CardContent className="flex min-h-64 flex-col">
              <EmptyState
                icon={ChartLineIcon}
                title="Analytics is coming soon"
                description="Deeper analytics and trends are planned for a future release."
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
