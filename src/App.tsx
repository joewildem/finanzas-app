import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom'

import { AppShell } from '@/components/app-shell'
import { AuthGate } from '@/components/auth-gate'
import { AccountDetailPage } from '@/pages/accounts/account-detail-page'
import { AccountsListPage } from '@/pages/accounts/accounts-list-page'
import { AuthCallbackPage } from '@/pages/auth-callback-page'
import { BudgetPage } from '@/pages/budget/budget-page'
import { CategoriesPage } from '@/pages/categories/categories-page'
import { DashboardAccountDetailPage } from '@/pages/dashboard/account-detail-page'
import { DashboardPage } from '@/pages/dashboard/dashboard-page'
import { DebtDetailPage } from '@/pages/debts/debt-detail-page'
import { DebtsListPage } from '@/pages/debts/debts-list-page'
import { InvestmentsPage } from '@/pages/investments/investments-page'
import { LoginPage } from '@/pages/login-page'
import { SavingsGoalDetailPage } from '@/pages/savings/savings-goal-detail-page'
import { SavingsListPage } from '@/pages/savings/savings-list-page'
import { SettingsLayout } from '@/pages/settings/settings-layout'
import { TransactionsPage } from '@/pages/transactions/transactions-page'

function ProtectedLayout() {
  return (
    <AuthGate>
      <AppShell>
        <Outlet />
      </AppShell>
    </AuthGate>
  )
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route element={<ProtectedLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/accounts/:accountId" element={<DashboardAccountDetailPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/savings">
            <Route index element={<SavingsListPage />} />
            <Route path=":goalId" element={<SavingsGoalDetailPage />} />
          </Route>
          <Route path="/investments" element={<InvestmentsPage />} />
          <Route path="/debts">
            <Route index element={<DebtsListPage />} />
            <Route path=":debtId" element={<DebtDetailPage />} />
          </Route>
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="/settings/accounts" replace />} />
            <Route path="accounts">
              <Route index element={<AccountsListPage />} />
              <Route path=":accountId" element={<AccountDetailPage />} />
            </Route>
            <Route path="categories" element={<CategoriesPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
