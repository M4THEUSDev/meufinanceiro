import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Goal } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { HIDDEN_MASK, money, monthShortLabel } from '../../core/utils/format';
import { CategoryIconComponent } from './category-icon.component';
import { ProgressBarComponent } from './progress-bar.component';

/** Card compacto de meta (carrossel do Dashboard) */
@Component({
  selector: 'mf-goal-card',
  imports: [CategoryIconComponent, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <mf-category-icon [icon]="goal().icon" [color]="goal().color" [size]="32"></mf-category-icon>
      <div class="text">
        <p class="t-subhead-sb ellipsis">{{ goal().name }}</p>
        <p class="t-caption1 c-tertiary">até {{ deadline() }}</p>
      </div>
    </div>
    <mf-progress-bar [value]="progress()" [color]="goal().color"></mf-progress-bar>
    <div class="foot">
      <p class="t-caption1 c-secondary ellipsis">{{ amounts() }}</p>
      <p class="t-footnote-sb">{{ percent() }}%</p>
    </div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 10px; padding: 16px; width: 220px; flex: 0 0 auto;
      background: var(--ion-card-background); border-radius: var(--mf-radius-xl); box-shadow: var(--mf-elevation-sm); cursor: pointer; }
    p { margin: 0; }
    .head { display: flex; align-items: center; gap: 10px; }
    .text { min-width: 0; flex: 1; }
    .foot { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  `,
})
export class GoalCardComponent {
  private readonly store = inject(StoreService);
  readonly goal = input.required<Goal>();
  readonly saved = computed(() => this.store.goalSaved(this.goal()));
  readonly progress = computed(() => (this.goal().target ? this.saved() / this.goal().target : 0));
  readonly percent = computed(() => Math.round(this.progress() * 100));
  readonly deadline = computed(() => monthShortLabel(this.goal().deadline));
  readonly amounts = computed(() =>
    this.store.hidden() ? HIDDEN_MASK : `${money(this.saved(), { decimals: false })} de ${money(this.goal().target, { decimals: false })}`,
  );
}
