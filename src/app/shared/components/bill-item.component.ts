import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Bill } from '../../core/services/store.service';
import { MONTHS_SHORT } from '../../core/utils/format';
import { MoneyPipe } from '../pipes/money.pipe';

/** BillItem — Próximo vencimento. DueSoon ≤ 3 dias; Overdue após a data. */
@Component({
  selector: 'mf-bill-item',
  imports: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="date" [class]="'date ' + bill().status">
      <span class="t-headline day">{{ bill().due.getDate() }}</span>
      <span class="t-caption2 mon">{{ month() }}</span>
    </div>
    <div class="text">
      <p class="t-callout-sb ellipsis">{{ bill().name }}</p>
      <p class="t-footnote ellipsis" [class]="'t-footnote ellipsis sub ' + bill().status">{{ subtitle() }}</p>
    </div>
    <p class="t-footnote-sb nowrap">{{ bill().amount | money }}</p>
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--ion-card-background); cursor: pointer; }
    p { margin: 0; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .date { position: relative; isolation: isolate; width: 44px; height: 44px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 0 0 auto; }
    .date::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--tint); opacity: 0.14; z-index: -1; }
    .date.overdue { --tint: var(--ion-color-danger); color: var(--ion-color-danger); }
    .date.soon { --tint: var(--ion-color-warning); color: var(--ion-color-warning); }
    .date.later { --tint: var(--mf-text-tertiary); color: var(--ion-text-color); }
    .date.later::before { opacity: 0.12; }
    .date.later .mon { color: var(--mf-text-secondary); }
    .sub.overdue { color: var(--ion-color-danger); }
    .sub.soon { color: var(--ion-color-warning); }
    .sub.later { color: var(--mf-text-secondary); }
  `,
})
export class BillItemComponent {
  readonly bill = input.required<Bill>();
  readonly month = computed(() => MONTHS_SHORT[this.bill().due.getMonth()].toUpperCase());
  readonly subtitle = computed(() => {
    const d = this.bill().days;
    if (d < 0) return `Venceu há ${-d} ${d === -1 ? 'dia' : 'dias'}`;
    if (d === 0) return 'Vence hoje';
    if (d === 1) return 'Vence amanhã';
    return `Vence em ${d} dias`;
  });
}
