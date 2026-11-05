import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { catColor } from '../../core/icons';

export interface DonutSegment {
  value: number;
  color: string;
}

/** Donut (rosca) em SVG — segmentos com pequeno espaçamento, raio interno 69% (Figma · Donut) */
@Component({
  selector: 'mf-donut',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + size() + ' ' + size()" role="img" aria-hidden="true">
      @if (!paths().length) {
        <circle [attr.cx]="size() / 2" [attr.cy]="size() / 2" [attr.r]="(size() / 2) * (1 + inner()) / 2" fill="none"
          stroke="var(--ion-color-step-50)" [attr.stroke-width]="(size() / 2) * (1 - inner())"></circle>
      }
      @for (p of paths(); track $index) {
        <path [attr.d]="p.d" [attr.fill]="p.color"></path>
      }
    </svg>
    <div class="center"><ng-content></ng-content></div>
  `,
  styles: `
    :host { position: relative; display: inline-block; flex: 0 0 auto; }
    svg { width: 100%; height: 100%; display: block; }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  `,
})
export class DonutComponent {
  readonly segments = input<DonutSegment[]>([]);
  readonly size = input(124);
  readonly inner = input(0.694);
  /** espaçamento entre fatias (rad) */
  readonly gap = input(0.06);

  readonly paths = computed(() => {
    const segs = this.segments().filter((s) => s.value > 0);
    const total = segs.reduce((s, x) => s + x.value, 0);
    if (!total) return [];
    const R = this.size() / 2;
    const r = R * this.inner();
    const c = R;
    const gap = segs.length > 1 ? this.gap() : 0;
    let a = -Math.PI / 2;
    return segs.map((s) => {
      const sweep = (s.value / total) * Math.PI * 2;
      const a0 = a + gap / 2;
      const a1 = a + sweep - gap / 2;
      a += sweep;
      const color = s.color.startsWith('var') || s.color.startsWith('#') ? s.color : catColor(s.color);
      if (segs.length === 1) {
        return { color, d: `M ${c} ${c - R} A ${R} ${R} 0 1 1 ${c - 0.01} ${c - R} L ${c - 0.01} ${c - r} A ${r} ${r} 0 1 0 ${c} ${c - r} Z` };
      }
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, ang: number) => `${c + rad * Math.cos(ang)} ${c + rad * Math.sin(ang)}`;
      return {
        color,
        d: `M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z`,
      };
    });
  });
}
