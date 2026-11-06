import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { AlertController, IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { ProjectionService } from '../../core/services/projection.service';
import { StoreService } from '../../core/services/store.service';
import { HIDDEN_MASK, MONTHS, MONTHS_SHORT, addMonths, cap, compact, money, monthLabel, parseMoney, parseMonthKey } from '../../core/utils/format';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

/** Próximos meses — previsão mês a mês e quando cada dívida acaba */
@Component({
  selector: 'mf-projection',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonIcon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './projection.page.html',
  styleUrl: './projection.page.scss',
})
export class ProjectionPage {
  protected readonly store = inject(StoreService);
  private readonly proj = inject(ProjectionService);
  private readonly alert = inject(AlertController);

  readonly months = this.proj.months;
  readonly milestones = this.proj.milestones;
  /** mês aberto na navegação (índice) */
  readonly index = signal(0);
  readonly current = computed(() => this.months()[this.index()]);
  readonly maxAbs = computed(() => Math.max(1, ...this.months().map((m) => Math.abs(m.net))));
  readonly anyEstimated = computed(() => this.months().some((m) => m.cardsEstimated));
  readonly last = computed(() => this.months().at(-1));

  label(k: string): string {
    return monthLabel(k);
  }
  short(k: string): string {
    const d = parseMonthKey(k);
    return cap(MONTHS_SHORT[d.getMonth()]);
  }
  year2(k: string): string {
    return String(parseMonthKey(k).getFullYear()).slice(2);
  }
  monthName(k: string): string {
    const d = parseMonthKey(k);
    return `${MONTHS[d.getMonth()]}/${d.getFullYear()}`;
  }
  after(k: string): string {
    return this.monthName(addMonths(k, 1));
  }
  bar(net: number): number {
    return Math.max(4, (Math.abs(net) / this.maxAbs()) * 70);
  }
  compact(v: number): string {
    return this.store.hidden() ? '•••' : `${v < 0 ? '−' : '+'}${compact(Math.abs(v)).replace(' mil', 'k')}`;
  }
  fmt(v: number): string {
    return this.store.hidden() ? HIDDEN_MASK : money(v);
  }

  async editSpend(cardId: string): Promise<void> {
    const c = this.store.card(cardId);
    if (!c) return;
    const a = await this.alert.create({
      header: c.name,
      message: 'Quanto você costuma gastar por mês neste cartão, além das parcelas já lançadas?',
      inputs: [{ name: 'v', type: 'text', placeholder: '0,00', value: c.monthlySpendEstimate ? c.monthlySpendEstimate.toFixed(2).replace('.', ',') : '', attributes: { inputmode: 'decimal' } }],
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Salvar', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    if (role !== 'confirm') return;
    const v = parseMoney(data?.values?.v ?? '');
    this.store.updateCard(c.id, { monthlySpendEstimate: v > 0 ? v : undefined });
  }

  go(i: number): void {
    this.index.set(Math.max(0, Math.min(this.months().length - 1, i)));
  }
}
