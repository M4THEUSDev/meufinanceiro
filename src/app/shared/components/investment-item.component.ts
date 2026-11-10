import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Investment } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { HIDDEN_MASK, money, shortDate } from '../../core/utils/format';
import { MoneyPipe } from '../pipes/money.pipe';
import { CategoryIconComponent } from './category-icon.component';

export const MOVE_LABEL = { aporte: 'Aporte', resgate: 'Resgate', rendimento: 'Rendimento' } as const;

/** Linha de investimento: nome, onde está, última movimentação e saldo */
@Component({
  selector: 'mf-investment-item',
  imports: [CategoryIconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mf-category-icon [icon]="inv().icon" [color]="inv().color" [size]="40"></mf-category-icon>
    <span class="text">
      <span class="t-callout-sb ellipsis">{{ inv().name }}</span>
      <span class="t-footnote c-secondary sub">{{ sub() }}</span>
    </span>
    <span class="right">
      <span class="t-callout-sb nowrap">{{ balance() | money }}</span>
      @if (!inv().mine) { <span class="tag t-caption2">De terceiro</span> }
    </span>
  `,
  host: { role: 'button', tabindex: '0' },
  styles: `
    :host { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--ion-card-background); cursor: pointer; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .sub { overflow-wrap: anywhere; }
    .right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .tag { padding: 1px 6px; border-radius: 6px; background: var(--ion-color-step-50); color: var(--mf-text-secondary); font-weight: 600; }
  `,
})
export class InvestmentItemComponent {
  private readonly store = inject(StoreService);
  readonly inv = input.required<Investment>();
  readonly balance = computed(() => this.store.investmentBalance(this.inv()));
  readonly sub = computed(() => {
    const i = this.inv();
    const last = [...i.moves].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!last) return i.institution || 'Sem movimentações';
    const v = this.store.hidden() ? HIDDEN_MASK : money(Math.abs(last.amount));
    const label = last.type === 'rendimento' && last.amount < 0 ? 'Desvalorização' : MOVE_LABEL[last.type];
    return `${label} de ${v} em ${shortDate(last.date)}`;
  });
}
