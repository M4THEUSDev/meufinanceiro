import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { IonButton, IonIcon } from '@ionic/angular/standalone';
import { Goal } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { MoneyPipe } from '../pipes/money.pipe';
import { CategoryIconComponent } from './category-icon.component';
import { ProgressBarComponent } from './progress-bar.component';

/** GoalProgress — valor desejado, acumulado, %, data prevista e ação de contribuição */
@Component({
  selector: 'mf-goal-progress',
  imports: [IonIcon, IonButton, CategoryIconComponent, ProgressBarComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <mf-category-icon [icon]="goal().icon" [color]="goal().color" [size]="48"></mf-category-icon>
      <div class="text">
        <span class="t-headline ellipsis">{{ goal().name }}</span>
        <span class="when t-footnote c-secondary"><ion-icon name="calendar-outline"></ion-icon>Meta para {{ deadline() }}</span>
      </div>
      <span class="t-amount-medium pct" [style.color]="color()">{{ pct() }}%</span>
    </div>
    <mf-progress-bar [value]="pct() / 100" [color]="goal().color" [height]="10"></mf-progress-bar>
    <div class="amounts">
      <div><span class="t-caption1 c-tertiary">Acumulado</span><span class="t-headline">{{ saved() | money }}</span></div>
      <div class="r"><span class="t-caption1 c-tertiary">Objetivo</span><span class="t-headline c-secondary">{{ goal().target | money }}</span></div>
    </div>
    <ion-button expand="block" class="tonal" (click)="$event.stopPropagation(); contribute.emit()"><ion-icon slot="start" name="add"></ion-icon>Adicionar contribuição</ion-button>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 14px; padding: 16px; background: var(--ion-card-background); border-radius: var(--mf-radius-lg); box-shadow: var(--mf-elevation-sm); cursor: pointer; }
    .head { display: flex; align-items: center; gap: 12px; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .when { display: flex; align-items: center; gap: 4px; ion-icon { font-size: 13px; } }
    .amounts { display: flex; justify-content: space-between; > div { display: flex; flex-direction: column; } .r { align-items: flex-end; } }
    ion-button { min-height: 44px; }
  `,
})
export class GoalProgressComponent {
  private readonly store = inject(StoreService);
  readonly goal = input.required<Goal>();
  readonly contribute = output<void>();
  readonly saved = computed(() => this.store.goalSaved(this.goal()));
  readonly pct = computed(() => Math.min(100, Math.round((this.saved() / (this.goal().target || 1)) * 100)));
  readonly deadline = computed(() => {
    const [y, m] = this.goal().deadline.split('-');
    return `${m}/${y}`;
  });
  readonly color = computed(() => (this.goal().color === 'salario' ? 'var(--ion-color-primary-shade)' : `var(--mf-category-${this.goal().color})`));
}
