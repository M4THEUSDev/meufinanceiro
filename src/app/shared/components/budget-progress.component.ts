import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { Budget } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { HIDDEN_MASK, money } from '../../core/utils/format';
import { CategoryIconComponent } from './category-icon.component';
import { ProgressBarComponent } from './progress-bar.component';

export type BudgetState = 'normal' | 'warning' | 'exceeded';

export function budgetState(spent: number, b: Budget): BudgetState {
  const pct = b.limit ? (spent / b.limit) * 100 : 0;
  if (pct > 100) return 'exceeded';
  if (pct >= (b.alertAt || 80)) return 'warning';
  return 'normal';
}

/** BudgetProgress — Warning ≥ 80%, Exceeded > 100% */
@Component({
  selector: 'mf-budget-progress',
  imports: [IonIcon, CategoryIconComponent, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <mf-category-icon [icon]="category()?.icon ?? 'pricetag-outline'" [color]="category()?.color ?? 'outros'" [size]="32"></mf-category-icon>
      <div class="text">
        <span class="t-callout-sb ellipsis">{{ category()?.name }}</span>
        <span class="t-footnote c-secondary">{{ amounts() }}</span>
      </div>
      <span class="t-footnote-sb pct" [class]="'t-footnote-sb pct ' + state()">{{ pct() }}%</span>
    </div>
    <mf-progress-bar [value]="spent() / (budget().limit || 1)" [color]="barColor()"></mf-progress-bar>
    <div class="foot t-footnote" [class]="'foot t-footnote ' + state()">
      @if (state() === 'exceeded') { <ion-icon name="alert-circle-outline"></ion-icon> }
      @if (state() === 'warning') { <ion-icon name="warning-outline"></ion-icon> }
      <span>{{ footer() }}</span>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; padding: 16px; background: var(--ion-card-background); border-radius: var(--mf-radius-lg); box-shadow: var(--mf-elevation-sm); cursor: pointer; }
    .head { display: flex; align-items: center; gap: 12px; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .pct.normal { color: var(--ion-text-color); }
    .pct.warning, .foot.warning { color: var(--ion-color-warning); }
    .pct.exceeded, .foot.exceeded { color: var(--ion-color-danger); }
    .foot { display: flex; align-items: center; gap: 4px; color: var(--mf-text-secondary); }
    .foot ion-icon { font-size: 14px; }
  `,
})
export class BudgetProgressComponent {
  private readonly store = inject(StoreService);
  readonly budget = input.required<Budget>();
  readonly month = input.required<string>();

  readonly category = computed(() => this.store.category(this.budget().categoryId));
  readonly spent = computed(() => this.store.spentInCategory(this.budget().categoryId, this.month()));
  readonly pct = computed(() => Math.round((this.spent() / (this.budget().limit || 1)) * 100));
  readonly state = computed(() => budgetState(this.spent(), this.budget()));
  readonly barColor = computed(() =>
    this.state() === 'exceeded' ? 'var(--ion-color-danger)' : this.state() === 'warning' ? 'var(--ion-color-warning)' : `var(--mf-category-${this.category()?.color ?? 'outros'})`,
  );
  readonly amounts = computed(() => (this.store.hidden() ? `${HIDDEN_MASK} de ${HIDDEN_MASK}` : `${money(this.spent())} de ${money(this.budget().limit)}`));
  readonly footer = computed(() => {
    const rest = this.budget().limit - this.spent();
    const v = (n: number) => (this.store.hidden() ? HIDDEN_MASK : money(n));
    if (this.state() === 'exceeded') return `${v(-rest)} acima do limite`;
    if (this.state() === 'warning') return `Restam ${v(rest)} · ${this.pct()}% usado`;
    return `Restam ${v(rest)}`;
  });
}
