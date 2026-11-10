import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonRefresher, IonRefresherContent, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { Bill, StoreService, billRoute } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { MONTHS, MONTHS_SHORT, addMonths, cap, greeting, initials, monthKey, parseMonthKey, pct, round2 } from '../../core/utils/format';
import { BalanceCardComponent } from '../../shared/components/balance-card.component';
import { BarChartComponent, BarDatum } from '../../shared/components/bar-chart.component';
import { DashboardSkeletonComponent } from '../../shared/components/dashboard-skeleton.component';
import { BillItemComponent } from '../../shared/components/bill-item.component';
import { DonutComponent } from '../../shared/components/donut.component';
import { GoalCardComponent } from '../../shared/components/goal-card.component';
import { InvestmentItemComponent } from '../../shared/components/investment-item.component';
import { MonthSelectorComponent } from '../../shared/components/month-selector.component';
import { NotificationsModal } from '../../shared/components/notifications.modal';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { SparklineComponent } from '../../shared/components/sparkline.component';
import { SummaryCardComponent } from '../../shared/components/summary-card.component';
import { TransactionItemComponent } from '../../shared/components/transaction-item.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openTransactionForm } from '../transactions/transaction-form.modal';

/** [F] Dashboard · Início */
@Component({
  selector: 'mf-dashboard',
  imports: [
    IonHeader, IonToolbar, IonContent, IonIcon, IonRefresher, IonRefresherContent, MoneyPipe,
    BalanceCardComponent, SummaryCardComponent, ProgressBarComponent, BarChartComponent, SparklineComponent, DonutComponent,
    SectionHeaderComponent, TransactionItemComponent, BillItemComponent, GoalCardComponent, MonthSelectorComponent, DashboardSkeletonComponent, InvestmentItemComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './dashboard.page.html',
  styleUrl: './dashboard.page.scss',
})
export class DashboardPage {
  protected readonly store = inject(StoreService);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalController);
  private readonly ui = inject(UiService);

  readonly month = this.store.selectedMonth;
  readonly isCurrentMonth = computed(() => this.month() === monthKey(new Date()));
  readonly firstName = computed(() => this.store.settings().userName.split(' ')[0] || 'Você');
  readonly initials = computed(() => initials(this.store.settings().userName));
  readonly greeting = greeting();

  readonly prevMonthName = computed(() => MONTHS[parseMonthKey(addMonths(this.month(), -1)).getMonth()]);
  readonly summary = computed(() => this.store.summary(this.month()));
  readonly prevSummary = computed(() => this.store.summary(addMonths(this.month(), -1)));

  readonly balance = computed(() => {
    if (this.isCurrentMonth()) return this.store.totalBalance();
    const [y, m] = this.month().split('-').map(Number);
    return this.store.balanceAt(new Date(y, m, 0, 23, 59, 59));
  });
  readonly balanceDelta = computed(() => {
    const [y, m] = this.month().split('-').map(Number);
    const prev = this.store.balanceAt(new Date(y, m - 1, 0, 23, 59, 59));
    return prev ? ((this.balance() - prev) / Math.abs(prev)) * 100 : 0;
  });
  readonly accountsCount = computed(() => this.store.accounts().filter((a) => a.active && a.includeInTotal).length);

  readonly incomeCaption = computed(() => this.vs(this.summary().income, this.prevSummary().income));
  readonly expenseCaption = computed(() => this.vs(this.summary().expense, this.prevSummary().expense));

  readonly savingsRate = computed(() => {
    const s = this.summary();
    return s.income ? (s.net / s.income) * 100 : 0;
  });
  readonly spentRate = computed(() => {
    const s = this.summary();
    return s.income ? (s.expense / s.income) * 100 : 0;
  });

  readonly chartIndex = signal(5);
  readonly chart = computed<BarDatum[]>(() =>
    this.store.history(this.month(), 6).map((h) => {
      const d = parseMonthKey(h.key);
      return { label: cap(MONTHS_SHORT[d.getMonth()]), longLabel: cap(MONTHS[d.getMonth()]), income: h.income, expense: h.expense };
    }),
  );

  readonly wealth = computed(() => this.store.wealthHistory(this.month(), 6));
  readonly wealthValues = computed(() => this.wealth().map((w) => w.value));
  readonly wealthDelta = computed(() => {
    const w = this.wealth();
    const a = w[0]?.value ?? 0;
    const b = w.at(-1)?.value ?? 0;
    return a ? ((b - a) / Math.abs(a)) * 100 : 0;
  });
  readonly wealthFirstLabel = computed(() => cap(MONTHS_SHORT[parseMonthKey(this.wealth()[0]?.key ?? this.month()).getMonth()]));
  readonly wealthLastLabel = computed(() => cap(MONTHS_SHORT[parseMonthKey(this.wealth().at(-1)?.key ?? this.month()).getMonth()]));

  readonly spend = computed(() => {
    const all = this.store.categorySpend(this.month(), 'expense');
    const top = all.slice(0, 5);
    const rest = all.slice(5);
    const restTotal = rest.reduce((s, x) => s + x.total, 0);
    const restShare = rest.reduce((s, x) => s + x.share, 0);
    const rows = top.map((x) => ({ name: x.category.name, color: x.category.color as string, total: x.total, share: x.share }));
    if (rest.length) rows.push({ name: 'Outros', color: 'outros', total: restTotal, share: restShare });
    return rows;
  });
  readonly donut = computed(() => this.spend().map((s) => ({ value: s.total, color: s.color })));

  readonly latest = computed(() => {
    const now = Date.now();
    const list = this.isCurrentMonth() ? this.store.transactions() : this.store.txOfMonth(this.month());
    return list.filter((t) => new Date(t.date).getTime() <= now).slice(0, 4);
  });
  readonly bills = computed(() => this.store.bills().slice(0, 3));
  readonly toReceive = computed(() => round2(this.store.receivables().filter((t) => monthKey(new Date(t.date)) <= this.month()).reduce((s, t) => s + t.amount, 0)));
  readonly toPay = computed(() => round2(this.store.bills().filter((b) => monthKey(b.due) <= this.month()).reduce((s, b) => s + b.amount, 0)));
  readonly goals = computed(() => this.store.goals());
  readonly invTotals = this.store.investmentTotals;
  readonly investments = computed(() => [...this.store.investments()].sort((a, b) => Number(b.mine) - Number(a.mine) || this.store.investmentBalance(b) - this.store.investmentBalance(a)));
  readonly notificationCount = computed(() => this.store.bills().filter((b) => b.status !== 'later').length);

  pct = pct;
  protected readonly Math = Math;

  private vs(cur: number, prev: number): string {
    if (!prev) return 'sem dados do mês anterior';
    const d = Math.round(((cur - prev) / prev) * 100);
    return `${d >= 0 ? '+' : '−'}${Math.abs(d)}% vs. ${this.prevMonthName()}`;
  }

  onMonthChange(): void {
    this.chartIndex.set(5);
  }

  go(url: string): void {
    void this.router.navigateByUrl(url);
  }

  openTx(id: string): void {
    this.go(`/tabs/transacoes/${id}`);
  }

  openBill(b: Bill): void {
    this.go(billRoute(b));
  }

  async notifications(): Promise<void> {
    const m = await this.modal.create({ component: NotificationsModal, cssClass: 'mf-card-modal', breakpoints: [0, 0.7, 1], initialBreakpoint: 0.7 });
    await m.present();
  }

  async add(): Promise<void> {
    await openTransactionForm(this.modal, this.ui, this.store);
  }

  readonly loading = signal(false);

  async refresh(ev: Event): Promise<void> {
    this.loading.set(true);
    await Promise.all([this.store.load(), new Promise((r) => setTimeout(r, 450))]);
    this.loading.set(false);
    await (ev.target as HTMLIonRefresherElement).complete();
  }
}
