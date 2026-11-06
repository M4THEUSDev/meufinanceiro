import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController,
} from '@ionic/angular/standalone';
import { Debt } from '../../core/models/models';
import { Bill, StoreService, billRoute } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, MONTHS, addMonths, monthKey, parseMonthKey, pct, round2, shortDate } from '../../core/utils/format';
import { BillItemComponent } from '../../shared/components/bill-item.component';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { MonthSelectorComponent } from '../../shared/components/month-selector.component';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { DEBT_KINDS, DebtFormModal } from './debt-form.modal';

/** Ganhos e dívidas — quanto entra, o que está pendente e quanto se deve */
@Component({
  selector: 'mf-finance',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon,
    MonthSelectorComponent, CategoryIconComponent, ProgressBarComponent, BillItemComponent, MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './finance.page.html',
  styleUrl: './finance.page.scss',
})
export class FinancePage {
  protected readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly sheet = inject(ActionSheetController);

  readonly month = this.store.selectedMonth;
  readonly monthName = computed(() => MONTHS[parseMonthKey(this.month()).getMonth()]);
  readonly pct = pct;
  protected readonly Math = Math;

  // ---- Ganhos ----
  private readonly monthIncome = computed(() => this.store.txOfMonth(this.month()).filter((t) => t.type === 'income'));
  readonly received = computed(() => round2(this.monthIncome().filter((t) => t.paid).reduce((s, t) => s + t.amount, 0)));
  readonly toReceive = computed(() => round2(this.monthIncome().filter((t) => !t.paid).reduce((s, t) => s + t.amount, 0)));
  readonly incomeTotal = computed(() => round2(this.received() + this.toReceive()));
  readonly incomeAvg = computed(() => {
    const h = this.store.history(addMonths(this.month(), -1), 6).filter((x) => x.income > 0);
    return h.length ? round2(h.reduce((s, x) => s + x.income, 0) / h.length) : 0;
  });
  readonly incomeVsAvg = computed(() => (this.incomeAvg() ? ((this.incomeTotal() - this.incomeAvg()) / this.incomeAvg()) * 100 : 0));
  readonly sources = computed(() => {
    const spend = this.store.categorySpend(this.month(), 'income');
    const max = Math.max(1, ...spend.map((s) => s.total));
    return spend.map((s) => {
      const list = this.monthIncome().filter((t) => t.categoryId === s.category.id);
      return { ...s, bar: s.total / max, pending: round2(list.filter((t) => !t.paid).reduce((a, t) => a + t.amount, 0)) };
    });
  });
  readonly pendingIncome = computed(() => this.store.receivables().filter((t) => monthKey(new Date(t.date)) <= this.month()));

  // ---- A pagar no mês ----
  readonly payables = computed<Bill[]>(() => {
    const key = this.month();
    return this.store.bills().filter((b) => monthKey(b.due) === key || (b.status === 'overdue' && monthKey(b.due) < key));
  });
  /** o que vence no começo do mês seguinte (até o dia 10) — quem recebe no fim do mês já precisa reservar */
  readonly nextStart = computed<Bill[]>(() => {
    const next = addMonths(this.month(), 1);
    return this.store.bills().filter((b) => monthKey(b.due) === next && b.due.getDate() <= 10);
  });
  readonly nextStartTotal = computed(() => round2(this.nextStart().reduce((s, b) => s + b.amount, 0)));
  readonly nextMonthName = computed(() => MONTHS[parseMonthKey(addMonths(this.month(), 1)).getMonth()]);
  readonly payTotal = computed(() => round2(this.payables().reduce((s, b) => s + b.amount, 0)));
  readonly overdueTotal = computed(() => round2(this.payables().filter((b) => b.status === 'overdue').reduce((s, b) => s + b.amount, 0)));
  readonly paidExpenses = computed(() => round2(this.store.txOfMonth(this.month()).filter((t) => t.type === 'expense' && t.paid && !t.cardId).reduce((s, t) => s + t.amount, 0)));
  /** sobra prevista = tudo que entra no mês − o que já saiu − o que ainda falta pagar */
  readonly forecast = computed(() => round2(this.incomeTotal() - this.paidExpenses() - this.payTotal()));

  // ---- Dívidas ----
  readonly debts = this.store.debtSummary;
  readonly monthlyDebt = computed(() =>
    round2(this.store.debts().filter((d) => d.paidInstallments < d.totalInstallments).reduce((s, d) => s + d.installmentAmount, 0) + this.store.installmentPlans().reduce((s, p) => s + p.amount, 0)),
  );
  /** comprometimento da renda com parcelas (empréstimos + parcelamentos no cartão) */
  readonly commitment = computed(() => {
    const base = this.incomeAvg() || this.incomeTotal();
    return base ? (this.monthlyDebt() / base) * 100 : 0;
  });
  readonly commitmentLevel = computed(() => (this.commitment() <= 30 ? 'ok' : this.commitment() <= 50 ? 'warn' : 'bad'));

  hide(v: string): string {
    return this.store.hidden() ? HIDDEN_MASK : v;
  }
  date(iso: string): string {
    return shortDate(iso).slice(0, 5);
  }
  kindLabel(d: Debt): string {
    return DEBT_KINDS.find((k) => k.id === d.kind)?.label ?? 'Dívida';
  }
  kindIcon(d: Debt): string {
    return DEBT_KINDS.find((k) => k.id === d.kind)?.icon ?? 'document-text-outline';
  }
  catOf(id: string) {
    return this.store.category(id);
  }

  async markReceived(id: string): Promise<void> {
    const t = this.store.transaction(id);
    if (!t) return;
    this.store.markPaid(id, true);
    await this.ui.toast({ title: 'Receita confirmada', message: `${t.description} entrou no saldo de ${this.store.account(t.accountId)?.name ?? 'conta'}` });
  }

  async openBill(b: Bill): Promise<void> {
    if (b.kind === 'card') {
      void this.router.navigateByUrl('/tabs/mais/cartoes');
      return;
    }
    if (b.kind === 'debt') {
      await this.payDebt(b.refId);
      return;
    }
    const s = await this.sheet.create({
      header: b.name,
      buttons: [
        { text: 'Marcar como pago', handler: () => void this.payTx(b.refId) },
        { text: 'Ver detalhes', handler: () => void this.router.navigateByUrl(billRoute(b)) },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await s.present();
  }

  private async payTx(id: string): Promise<void> {
    const t = this.store.transaction(id);
    if (!t) return;
    this.store.markPaid(id, true);
    await this.ui.toast({ title: 'Conta paga', message: `${t.description} · saldo atualizado` });
  }

  async payDebt(id: string): Promise<void> {
    const d = this.store.debt(id);
    if (!d) return;
    // escolhe de onde sai: conta cadastrada ou cartão (ex.: Pix no crédito)
    const value = this.hide(`R$ ${d.installmentAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    let cardId: string | undefined;
    let chosen = false;
    const s = await this.sheet.create({
      header: `Pagar parcela ${d.paidInstallments + 1}/${d.totalInstallments} · ${value}`,
      buttons: [
        { text: `Com saldo de ${this.store.account(d.accountId)?.name ?? 'conta'}`, handler: () => { chosen = true; } },
        ...this.store.cards().map((c) => ({ text: `No crédito · ${c.name} (entra na fatura)`, handler: () => { chosen = true; cardId = c.id; } })),
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await s.present();
    await s.onDidDismiss();
    if (!chosen) return;
    const tx = this.store.payDebtInstallment(id, undefined, undefined, cardId);
    const left = d.totalInstallments - d.paidInstallments - 1;
    const reminder = d.payoffAmount != null && left ? ' · atualize o saldo devedor quando o banco informar' : '';
    await this.ui.toast({
      title: left ? 'Parcela paga' : 'Dívida quitada! 🎉',
      message: left ? `${d.name} · faltam ${left} ${left === 1 ? 'parcela' : 'parcelas'}${reminder}` : `${d.name} foi totalmente paga.`,
      action: tx ? { text: 'Desfazer', handler: () => this.store.deleteTransaction(tx.id) } : undefined,
    });
  }

  async debtActions(d: Debt): Promise<void> {
    const done = d.paidInstallments >= d.totalInstallments;
    const s = await this.sheet.create({
      header: d.name,
      buttons: [
        ...(done ? [] : [{ text: `Pagar parcela ${d.paidInstallments + 1}/${d.totalInstallments}`, handler: () => void this.payDebt(d.id) }]),
        { text: 'Editar dívida', handler: () => void this.editDebt(d.id) },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await s.present();
  }

  async addDebt(): Promise<void> {
    const m = await this.modal.create({ component: DebtFormModal, cssClass: 'mf-card-modal', presentingElement: document.querySelector('ion-tabs') as HTMLElement });
    await m.present();
  }

  async editDebt(id: string): Promise<void> {
    const m = await this.modal.create({ component: DebtFormModal, componentProps: { debtId: id }, cssClass: 'mf-card-modal' });
    await m.present();
  }

  openCard(): void {
    void this.router.navigateByUrl('/tabs/mais/cartoes');
  }

  openTx(id: string): void {
    void this.router.navigateByUrl(`/tabs/transacoes/${id}`);
  }
}
