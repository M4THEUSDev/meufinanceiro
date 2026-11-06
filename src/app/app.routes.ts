import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards';

export const routes: Routes = [
  { path: '', redirectTo: 'splash', pathMatch: 'full' },
  { path: 'splash', loadComponent: () => import('./pages/splash/splash.page').then((m) => m.SplashPage) },
  { path: 'onboarding', loadComponent: () => import('./pages/onboarding/onboarding.page').then((m) => m.OnboardingPage) },
  { path: 'login', canActivate: [guestGuard], loadComponent: () => import('./pages/login/login.page').then((m) => m.LoginPage) },
  {
    path: 'tabs',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/tabs/tabs.page').then((m) => m.TabsPage),
    children: [
      { path: 'inicio', loadComponent: () => import('./pages/dashboard/dashboard.page').then((m) => m.DashboardPage) },
      { path: 'transacoes', loadComponent: () => import('./pages/transactions/transactions.page').then((m) => m.TransactionsPage) },
      { path: 'transacoes/:id', loadComponent: () => import('./pages/transactions/transaction-detail.page').then((m) => m.TransactionDetailPage) },
      { path: 'planejamento', loadComponent: () => import('./pages/planning/planning.page').then((m) => m.PlanningPage) },
      { path: 'planejamento/:id', loadComponent: () => import('./pages/planning/budget-detail.page').then((m) => m.BudgetDetailPage) },
      { path: 'mais', loadComponent: () => import('./pages/more/more.page').then((m) => m.MorePage) },
      { path: 'mais/contas', loadComponent: () => import('./pages/accounts/accounts.page').then((m) => m.AccountsPage) },
      { path: 'mais/metas', loadComponent: () => import('./pages/goals/goals.page').then((m) => m.GoalsPage) },
      { path: 'mais/metas/:id', loadComponent: () => import('./pages/goals/goal-detail.page').then((m) => m.GoalDetailPage) },
      { path: 'mais/financas', loadComponent: () => import('./pages/finance/finance.page').then((m) => m.FinancePage) },
      { path: 'mais/importar', loadComponent: () => import('./pages/import/import.page').then((m) => m.ImportPage) },
      { path: 'mais/categorias', loadComponent: () => import('./pages/categories/categories.page').then((m) => m.CategoriesPage) },
      { path: 'mais/cartoes', loadComponent: () => import('./pages/cards/cards.page').then((m) => m.CardsPage) },
      { path: 'mais/relatorios', loadComponent: () => import('./pages/reports/reports.page').then((m) => m.ReportsPage) },
      { path: 'mais/configuracoes', loadComponent: () => import('./pages/settings/settings.page').then((m) => m.SettingsPage) },
      { path: '', redirectTo: 'inicio', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'splash' },
];
