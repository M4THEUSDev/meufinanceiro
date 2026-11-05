import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { MONTHS, addMonths, monthKey, monthLabel, parseMonthKey, round2 } from '../../core/utils/format';
import { BudgetProgressComponent, budgetState } from '../../shared/components/budget-progress.component';
import { RingComponent } from '../../shared/components/ring.component';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { openPicker } from '../../shared/components/picker.modal';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openBudgetForm } from './budget-form.modal';

/** [R] Planejamento · Orçamentos  /  [T] Orçamento salvo */
@Component({
  selector: 'mf-planning',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon, RingComponent, BudgetProgressComponent, SectionHeaderComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './planning.page.html',
  styleUrl: './planning.page.scss',
})
export class PlanningPage {
  protected readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);

  readonly month = this.store.selectedMonth;
  readonly monthLabel = computed(() => monthLabel(this.month()));
  readonly prevName = computed(() => MONTHS[parseMonthKey(addMonths(this.month(), -1)).getMonth()]);

  readonly items = computed(() =>
    this.store
      .budgetsFor(this.month())
      .map((b) => {
        const spent = this.store.spentInCategory(b.categoryId, this.month());
        return { b, spent, pct: b.limit ? spent / b.limit : 0, state: budgetState(spent, b) };
      })
      .sort((x, y) => y.pct - x.pct),
  );
  readonly planned = computed(() => round2(this.items().reduce((s, i) => s + i.b.limit, 0)));
  readonly spent = computed(() => round2(this.items().reduce((s, i) => s + i.spent, 0)));
  readonly remaining = computed(() => round2(this.planned() - this.spent()));
  readonly usedPct = computed(() => (this.planned() ? this.spent() / this.planned() : 0));
  readonly ringColor = computed(() => (this.usedPct() > 1 ? 'var(--ion-color-danger)' : this.usedPct() >= 0.9 ? 'var(--ion-color-warning)' : 'var(--ion-color-primary)'));

  readonly pace = computed(() => {
    const now = new Date();
    const key = this.month();
    const cur = monthKey(now);
    if (key < cur) return 'Mês encerrado';
    const d = parseMonthKey(key);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const daysLeft = key === cur ? last - now.getDate() + 1 : last;
    const perDay = Math.max(0, this.remaining()) / daysLeft;
    const v = this.store.hidden() ? 'R$ •••••' : `R$ ${perDay.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return `${daysLeft} ${daysLeft === 1 ? 'dia restante' : 'dias restantes'} · ritmo ideal: ${v}/dia`;
  });

  readonly alert = computed(() => {
    const ex = this.items().filter((i) => i.state === 'exceeded').map((i) => this.store.category(i.b.categoryId)?.name ?? '');
    const warn = this.items().filter((i) => i.state === 'warning').map((i) => this.store.category(i.b.categoryId)?.name ?? '');
    if (!ex.length && !warn.length) return null;
    const join = (a: string[]) => (a.length > 1 ? `${a.slice(0, -1).join(', ')} e ${a.at(-1)}` : a[0]);
    const parts: string[] = [];
    if (ex.length) parts.push(`${join(ex)} ${ex.length > 1 ? 'excederam' : 'excedeu'} o orçamento.`);
    if (warn.length) parts.push(`${join(warn)} ${warn.length > 1 ? 'estão' : 'está'} acima de 80%.`);
    return parts.join(' ');
  });

  async pickMonth(): Promise<void> {
    const now = new Date();
    const months = Array.from({ length: 15 }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() + 2 - i, 1)));
    const id = await openPicker(this.modal, { title: 'Mês', selected: this.month(), options: months.map((m) => ({ id: m, label: monthLabel(m) })) });
    if (id) this.month.set(id);
  }

  async copyPrevious(): Promise<void> {
    const n = this.store.copyBudgetsFrom(addMonths(this.month(), -1), this.month());
    await this.ui.toast(
      n
        ? { title: 'Orçamentos copiados', message: `${n} ${n === 1 ? 'orçamento copiado' : 'orçamentos copiados'} de ${this.prevName()}.` }
        : { title: 'Nada para copiar', message: `Os orçamentos de ${this.prevName()} já estão neste mês.`, tone: 'info' },
    );
  }

  async add(): Promise<void> {
    await openBudgetForm(this.modal, { month: this.month() });
  }

  async edit(): Promise<void> {
    const first = this.items()[0];
    const id = await openPicker(this.modal, {
      title: 'Editar orçamento',
      options: this.items().map((i) => {
        const c = this.store.category(i.b.categoryId);
        return { id: i.b.id, label: c?.name ?? '', icon: c?.icon, color: c?.color };
      }),
      selected: first?.b.id ?? null,
    });
    if (id) await openBudgetForm(this.modal, { budgetId: id, month: this.month() });
  }

  open(id: string): void {
    void this.router.navigateByUrl(`/tabs/planejamento/${id}`);
  }
}
