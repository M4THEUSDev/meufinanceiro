import { ChangeDetectionStrategy, Component, computed, inject, input, model } from '@angular/core';
import { StoreService } from '../../core/services/store.service';
import { compact, money } from '../../core/utils/format';

export interface LinePoint {
  label: string;
  longLabel: string;
  income: number;
  expense: number;
}

/** Evolução mensal — duas linhas (receitas / despesas) com tooltip no mês selecionado */
@Component({
  selector: 'mf-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="plot">
      @for (g of grid(); track $index) {
        <div class="grid" [style.top.px]="g.y"><span class="t-caption2">{{ g.label }}</span><i></i></div>
      }
      <svg class="lines" [attr.viewBox]="'0 0 ' + W + ' ' + H" preserveAspectRatio="none">
        @if (active() >= 0) { <line [attr.x1]="x(active())" [attr.x2]="x(active())" y1="0" [attr.y2]="H" class="cursor" /> }
        <polyline [attr.points]="line('income')" class="inc" vector-effect="non-scaling-stroke" />
        <polyline [attr.points]="line('expense')" class="exp" vector-effect="non-scaling-stroke" />
      </svg>
      @if (data()[active()]; as d) {
        <i class="pt inc" [style.left.%]="(x(active()) / W) * 100" [style.top.px]="y(d.income)"></i>
        <i class="pt exp" [style.left.%]="(x(active()) / W) * 100" [style.top.px]="y(d.expense)"></i>
        <div class="tip" [class.left]="active() > data().length / 2" [style.left.%]="(x(active()) / W) * 100">
          <span class="t-caption2">{{ d.longLabel }}</span>
          <span class="t-footnote-sb nowrap">Receitas {{ fmt(d.income) }}</span>
          <span class="t-footnote-sb nowrap">Despesas {{ fmt(d.expense) }}</span>
        </div>
      }
      <div class="hit">
        @for (d of data(); track $index) { <button type="button" [attr.aria-label]="d.longLabel" (click)="active.set($index)"></button> }
      </div>
    </div>
    <div class="labels">
      @for (d of data(); track $index) { <span class="t-caption1" [class.on]="$index === active()">{{ d.label }}</span> }
    </div>
  `,
  styles: `
    :host { display: block; }
    .plot { position: relative; height: 140px; margin-left: 32px; }
    .grid { position: absolute; left: -32px; right: 0; display: flex; align-items: center; gap: 6px; transform: translateY(-50%); pointer-events: none; }
    .grid span { width: 26px; color: var(--mf-text-tertiary); }
    .grid i { flex: 1; height: 1px; background: var(--ion-border-color); }
    .lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
    polyline { fill: none; stroke-width: 2.5; stroke-linejoin: round; stroke-linecap: round; }
    polyline.inc { stroke: var(--ion-color-success); }
    polyline.exp { stroke: var(--ion-color-danger); }
    .cursor { stroke: var(--mf-text-tertiary); stroke-dasharray: 3 3; stroke-width: 1; vector-effect: non-scaling-stroke; }
    .pt { position: absolute; width: 10px; height: 10px; border-radius: 50%; transform: translate(-50%, -50%); border: 2px solid var(--ion-card-background); pointer-events: none; }
    .pt.inc { background: var(--ion-color-success); }
    .pt.exp { background: var(--ion-color-danger); }
    .tip { position: absolute; top: 34px; transform: translateX(10px); display: flex; flex-direction: column; padding: 8px 10px; border-radius: 8px;
      background: var(--ion-text-color); color: var(--ion-card-background); pointer-events: none; z-index: 2; }
    .tip.left { transform: translateX(calc(-100% - 10px)); }
    .hit { position: absolute; inset: 0; display: flex; }
    .hit button { flex: 1; appearance: none; border: 0; background: none; padding: 0; cursor: pointer; }
    .labels { display: flex; margin: 8px 0 0 32px; }
    .labels span { flex: 1; text-align: center; color: var(--mf-text-tertiary); }
    .labels span.on { color: var(--ion-text-color); font-weight: 600; }
  `,
})
export class LineChartComponent {
  private readonly store = inject(StoreService);
  readonly data = input<LinePoint[]>([]);
  readonly active = model(-1);
  readonly W = 300;
  readonly H = 140;

  readonly range = computed(() => {
    const vals = this.data().flatMap((d) => [d.income, d.expense]).filter((v) => v > 0);
    if (!vals.length) return { min: 0, max: 1 };
    const max = Math.max(...vals);
    const min = Math.min(...vals);
    const step = max > 20000 ? 5000 : max > 4000 ? 2500 : 500;
    const top = Math.ceil(max / step) * step;
    const bottom = Math.max(0, Math.floor(min / step) * step - (Math.floor(min / step) * step === min ? step : 0));
    return { min: bottom === top ? 0 : bottom, max: top };
  });
  readonly grid = computed(() => {
    const { min, max } = this.range();
    return [0, 0.5, 1].map((f) => ({ y: 10 + (1 - f) * (this.H - 20), label: compact(min + (max - min) * f).replace(' mil', 'k') }));
  });

  x(i: number): number {
    const n = this.data().length;
    return n <= 1 ? this.W / 2 : (i / (n - 1)) * this.W;
  }
  y(v: number): number {
    const { min, max } = this.range();
    return 10 + (1 - (v - min) / (max - min || 1)) * (this.H - 20);
  }
  line(k: 'income' | 'expense'): string {
    return this.data().map((d, i) => `${this.x(i)},${this.y(d[k])}`).join(' ');
  }
  fmt(v: number): string {
    return this.store.hidden() ? 'R$ •••••' : money(v, { decimals: false });
  }
}
