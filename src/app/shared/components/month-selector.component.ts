import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { IonDatetime, IonIcon, IonModal } from '@ionic/angular/standalone';
import { addMonths, monthKey, monthLabel } from '../../core/utils/format';

/** Month selector — ‹ Novembro 2026 › ; toque no mês abre seletor mês/ano */
@Component({
  selector: 'mf-month-selector',
  imports: [IonIcon, IonModal, IonDatetime],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button class="mf-reset nav" type="button" aria-label="Mês anterior" (click)="month.set(prev())"><ion-icon name="chevron-back"></ion-icon></button>
    <button class="mf-reset current" type="button" (click)="open.set(true)">
      <ion-icon name="calendar-outline" class="cal"></ion-icon>
      <span class="t-headline">{{ label() }}</span>
      <ion-icon name="chevron-down" class="down"></ion-icon>
    </button>
    <button class="mf-reset nav" type="button" aria-label="Próximo mês" [disabled]="!canNext()" (click)="month.set(next())"><ion-icon name="chevron-forward"></ion-icon></button>

    <ion-modal [isOpen]="open()" (didDismiss)="open.set(false)" [breakpoints]="[0, 0.45]" [initialBreakpoint]="0.45" class="mf-sheet">
      <ng-template>
        <div class="picker">
          <div class="mf-modal-toolbar">
            <button type="button" (click)="goToday()">Mês atual</button>
            <span class="title">Selecionar mês</span>
            <button type="button" class="strong" (click)="open.set(false)">OK</button>
          </div>
          <ion-datetime presentation="month-year" locale="pt-BR" [value]="month() + '-01'" [max]="maxValue()" (ionChange)="onPick($any($event).detail.value)"></ion-datetime>
        </div>
      </ng-template>
    </ion-modal>
  `,
  styles: `
    :host { display: flex; align-items: center; justify-content: space-between; gap: 4px; }
    .nav { width: 36px; height: 36px; border-radius: 999px; background: var(--ion-color-step-50); display: grid; place-items: center; color: var(--ion-text-color); }
    .nav ion-icon { font-size: 18px; }
    .nav:disabled { opacity: 0.35; }
    .current { display: flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 8px; }
    .cal { font-size: 16px; color: var(--mf-text-secondary); }
    .down { font-size: 14px; color: var(--mf-text-secondary); }
    .picker { padding: 8px 0 24px; background: var(--ion-background-color); }
    ion-datetime { margin: 0 auto; --background: var(--ion-background-color); }
  `,
})
export class MonthSelectorComponent {
  readonly month = model(monthKey(new Date()));
  /** permite navegar para meses futuros (ex.: planejamento) */
  readonly allowFuture = input(false);
  readonly open = signal(false);
  readonly label = computed(() => monthLabel(this.month()));
  readonly prev = computed(() => addMonths(this.month(), -1));
  readonly next = computed(() => addMonths(this.month(), 1));
  readonly canNext = computed(() => this.allowFuture() || this.next() <= monthKey(new Date()));
  readonly maxValue = computed(() => (this.allowFuture() ? `${new Date().getFullYear() + 2}-12-31` : `${monthKey(new Date())}-28`));

  onPick(v: string | string[] | null | undefined): void {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) this.month.set(s.slice(0, 7));
  }

  goToday(): void {
    this.month.set(monthKey(new Date()));
    this.open.set(false);
  }
}
