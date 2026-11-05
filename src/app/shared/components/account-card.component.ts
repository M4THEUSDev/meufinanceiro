import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { Account } from '../../core/models/models';
import { accountSubtitle } from '../../core/accounts';
import { MoneyPipe } from '../pipes/money.pipe';
import { CategoryIconComponent } from './category-icon.component';

/** AccountCard — conta financeira com cor identificadora no ícone */
@Component({
  selector: 'mf-account-card',
  imports: [CategoryIconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.inactive]': '!account().active' },
  template: `
    <mf-category-icon [icon]="account().icon" [color]="account().color" [size]="44" [solid]="true"></mf-category-icon>
    <div class="text">
      <div class="name">
        <span class="t-headline ellipsis">{{ account().name }}</span>
        @if (!account().active) { <span class="badge t-caption2">Desativada</span> }
      </div>
      <span class="t-footnote c-secondary ellipsis">{{ subtitle() }}</span>
    </div>
    <div class="bal">
      <span class="t-headline nowrap">{{ balance() | money }}</span>
      <span class="t-caption1 c-tertiary">Saldo atual</span>
    </div>
  `,
  styles: `
    :host { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--ion-card-background); border-radius: var(--mf-radius-lg); box-shadow: var(--mf-elevation-sm); cursor: pointer; }
    :host(.inactive) { opacity: 0.6; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .name { display: flex; align-items: center; gap: 6px; min-width: 0; }
    .badge { background: var(--ion-color-step-50); color: var(--mf-text-secondary); padding: 2px 6px; border-radius: 999px; flex: 0 0 auto; }
    .bal { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex: 0 0 auto; }
  `,
})
export class AccountCardComponent {
  readonly account = input.required<Account>();
  readonly balance = input(0);
  readonly subtitle = computed(() => accountSubtitle(this.account()));
}
