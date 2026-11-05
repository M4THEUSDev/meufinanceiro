import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { Transaction } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { relativeDay } from '../../core/utils/format';
import { MoneyPipe } from '../pipes/money.pipe';
import { CategoryIconComponent } from './category-icon.component';

/** TransactionItem — sinal e cor indicam receita/despesa; status Pago/Pendente */
@Component({
  selector: 'mf-transaction-item',
  imports: [IonIcon, MoneyPipe, CategoryIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mf-category-icon [icon]="category()?.icon ?? 'help-circle-outline'" [color]="category()?.color ?? 'outros'" [size]="40"></mf-category-icon>
    <div class="text">
      <p class="t-callout-sb ellipsis title">{{ tx().description }}</p>
      <p class="t-footnote c-secondary ellipsis">{{ meta() }}</p>
    </div>
    <div class="trailing">
      <p class="t-footnote-sb nowrap" [class.c-danger]="tx().type === 'expense'" [class.c-success]="tx().type === 'income'">
        {{ (tx().type === 'income' ? tx().amount : -tx().amount) | money: 'sign' }}
      </p>
      <span class="status" [class.pending]="!tx().paid">
        <ion-icon [name]="tx().paid ? 'checkmark' : 'time-outline'"></ion-icon>
        <span class="t-caption2">{{ tx().paid ? (tx().type === 'income' ? 'Recebido' : 'Pago') : 'Pendente' }}</span>
      </span>
    </div>
  `,
  styles: `
    :host {
      display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 12px 16px; width: 100%;
      background: var(--ion-card-background); cursor: pointer;
    }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    p { margin: 0; }
    .title { color: var(--ion-text-color); }
    .trailing { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex: 0 0 auto; }
    .status { position: relative; isolation: isolate; display: inline-flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 999px; color: var(--mf-text-tertiary); }
    .status ion-icon { font-size: 11px; }
    .status.pending { color: var(--ion-color-warning); }
    .status.pending::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: currentColor; opacity: 0.14; z-index: -1; }
  `,
})
export class TransactionItemComponent {
  private readonly store = inject(StoreService);
  readonly tx = input.required<Transaction>();
  /** "category" = "Alimentação · Hoje, 12:15"; "account" = "Nubank · 12:15" */
  readonly metaMode = input<'category' | 'account'>('category');
  readonly category = computed(() => this.store.category(this.tx().categoryId));
  readonly meta = computed(() => {
    const t = this.tx();
    const when = relativeDay(t.date);
    if (this.metaMode() === 'account') {
      const src = t.cardId ? this.store.card(t.cardId)?.name : this.store.account(t.accountId)?.name;
      return `${this.category()?.name ?? 'Sem categoria'} · ${src ?? ''}`;
    }
    return `${this.category()?.name ?? 'Sem categoria'} · ${when}`;
  });
}
