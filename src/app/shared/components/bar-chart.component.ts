import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { StoreService } from '../../core/services/store.service';
import { compact, money } from '../../core/utils/format';

export interface BarDatum {
  label: string;
  /** rótulo longo para o tooltip, ex.: "Novembro" */
  longLabel: string;
  income: number;
  expense: number;
}

/** Bar chart · Receitas x Despesas (Figma 33:350) — toque em um mês para ver o resultado */
@Component({
  selector: 'mf-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="plot">
      @for (g of grid(); track $index) {
        <div class="grid" [style.top.px]="g.y"><span class="t-caption2">{{ g.label }}</span><i></i></div>
      }
      <div class="bars">
        @for (d of data(); track $index) {
          <button class="col" type="button" [class.active]="$index === activeIndex()" (click)="select($index)"
            [attr.aria-label]="d.longLabel + ': receitas ' + d.income + ', despesas ' + d.expense">
            <span class="pair">
              <span class="bar inc" [style.height.px]="h(d.income)"></span>
              <span class="bar exp" [style.height.px]="h(d.expense)"></span>
            </span>
            <span class="lbl t-caption1">{{ d.label }}</span>
          </button>
        }
      </div>
      @if (active(); as a) {
        <div class="tooltip" [style.left.%]="tooltipLeft()">
          <span class="t-caption2">{{ a.longLabel }}</span>
          <span class="t-footnote-sb nowrap">{{ net() }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; }
    .plot { position: relative; height: 170px; }
    .grid { position: absolute; left: 0; right: 0; display: flex; align-items: center; gap: 4px; transform: translateY(-50%); pointer-events: none; }
    .grid span { width: 25px; color: var(--mf-text-tertiary); white-space: nowrap; }
    .grid i { flex: 1; height: 1px; background: var(--ion-border-color); }
    .bars { position: absolute; left: 29px; right: 0; top: 0; bottom: 0; display: flex; }
    .col { flex: 1; position: relative; appearance: none; border: 0; background: none; padding: 0; cursor: pointer; }
    .pair { position: absolute; bottom: 36px; left: 50%; transform: translateX(-50%); display: flex; align-items: flex-end; gap: 4px; }
    .bar { width: 12px; border-radius: 4px 4px 0 0; opacity: 0.45; transition: height 400ms ease, opacity 150ms; min-height: 0; }
    .inc { background: var(--ion-color-success); }
    .exp { background: var(--ion-color-danger); }
    .col.active .bar { opacity: 1; }
    .lbl { position: absolute; bottom: 8px; left: 0; right: 0; text-align: center; color: var(--mf-text-tertiary); }
    .col.active .lbl { color: var(--ion-text-color); font-weight: 500; }
    .tooltip {
      position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column;
      padding: 6px 10px; border-radius: 8px; background: var(--ion-text-color); color: var(--ion-card-background);
      pointer-events: none; transition: left 200ms ease; white-space: nowrap;
    }
  `,
})
export class BarChartComponent {
  private readonly store = inject(StoreService);
  readonly data = input<BarDatum[]>([]);
  readonly activeIndex = model(-1);

  readonly max = computed(() => {
    const m = Math.max(1, ...this.data().flatMap((d) => [d.income, d.expense]));
    const step = m > 20000 ? 10000 : m > 5000 ? 5000 : m > 1000 ? 1000 : 100;
    return Math.ceil(m / step) * step;
  });
  /** área útil: y=44 (max) até y=134 (0) */
  readonly grid = computed(() => [
    { y: 44, label: compact(this.max()) },
    { y: 89, label: compact(this.max() / 2) },
    { y: 134, label: '0' },
  ]);
  readonly active = computed(() => this.data()[this.activeIndex()] ?? null);
  readonly tooltipLeft = computed(() => {
    const n = this.data().length || 1;
    const i = this.activeIndex();
    // a coluna ocupa (100% - 29px); aproximação percentual com clamp
    const pct = ((i + 0.5) / n) * 92 + 8;
    return Math.max(14, Math.min(84, pct));
  });
  readonly net = computed(() => {
    const a = this.active();
    if (!a) return '';
    if (this.store.hidden()) return 'R$ •••••';
    return money(a.income - a.expense, { sign: true, decimals: false });
  });

  h(v: number): number {
    return (Math.max(0, v) / this.max()) * 90;
  }

  select(i: number): void {
    this.activeIndex.set(i);
  }
}
