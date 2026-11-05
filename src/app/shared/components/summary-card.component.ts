import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { MoneyPipe } from '../pipes/money.pipe';

/** SummaryCard — Receitas / Despesas do mês */
@Component({
  selector: 'mf-summary-card',
  imports: [IonIcon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="header">
      <span class="icon" [class.expense]="type() === 'expense'">
        <ion-icon [name]="type() === 'expense' ? 'arrow-up' : 'arrow-down'"></ion-icon>
      </span>
      <span class="t-footnote-sb c-secondary">{{ type() === 'expense' ? 'Despesas' : 'Receitas' }}</span>
    </div>
    <p class="t-headline amount" [class.c-danger]="type() === 'expense'" [class.c-success]="type() === 'income'">{{ amount() | money }}</p>
    <p class="t-caption1 c-tertiary caption">{{ caption() }}</p>
  `,
  styles: `
    :host {
      display: flex; flex-direction: column; gap: 8px; padding: 16px; min-width: 0;
      background: var(--ion-card-background); border-radius: var(--mf-radius-lg); box-shadow: var(--mf-elevation-sm);
    }
    .header { display: flex; align-items: center; gap: 8px; }
    .icon { position: relative; isolation: isolate; width: 28px; height: 28px; border-radius: 999px; display: grid; place-items: center; color: var(--ion-color-success); }
    .icon::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: currentColor; opacity: 0.14; z-index: -1; }
    .icon.expense { color: var(--ion-color-danger); }
    .icon ion-icon { font-size: 16px; }
    p { margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `,
})
export class SummaryCardComponent {
  readonly type = input<'income' | 'expense'>('income');
  readonly amount = input(0);
  readonly caption = input('');
}
