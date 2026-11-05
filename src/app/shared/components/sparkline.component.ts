import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Sparkline · Evolução do patrimônio (linha + área com gradiente + ponto final) */
@Component({
  selector: 'mf-sparkline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg [attr.viewBox]="'0 0 ' + w + ' ' + hgt" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient [attr.id]="gid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" [attr.stop-color]="color()" stop-opacity="0.25" />
          <stop offset="1" [attr.stop-color]="color()" stop-opacity="0" />
        </linearGradient>
      </defs>
      <path [attr.d]="area()" [attr.fill]="'url(#' + gid + ')'"></path>
      <path [attr.d]="line()" fill="none" [attr.stroke]="color()" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"></path>
    </svg>
    @if (last(); as l) {
      <span class="dot" [style.left.%]="(l.x / w) * 100" [style.top.%]="(l.y / hgt) * 100" [style.background]="color()"></span>
    }
  `,
  styles: `
    :host { display: block; position: relative; height: 64px; }
    svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .dot { position: absolute; width: 10px; height: 10px; border-radius: 50%; transform: translate(-50%, -50%); border: 2px solid var(--ion-card-background); box-sizing: content-box; }
  `,
})
export class SparklineComponent {
  private static seq = 0;
  readonly gid = `mf-spark-${++SparklineComponent.seq}`;
  readonly values = input<number[]>([]);
  readonly color = input('var(--ion-color-success)');
  readonly w = 300;
  readonly hgt = 64;

  private readonly points = computed(() => {
    const v = this.values();
    if (v.length < 2) return [];
    const min = Math.min(...v);
    const max = Math.max(...v);
    const range = max - min || 1;
    return v.map((y, i) => ({ x: (i / (v.length - 1)) * this.w, y: 6 + (1 - (y - min) / range) * (this.hgt - 14) }));
  });
  readonly last = computed(() => this.points().at(-1) ?? null);
  readonly line = computed(() => this.smooth(this.points()));
  readonly area = computed(() => {
    const p = this.points();
    if (!p.length) return '';
    return `${this.smooth(p)} L ${this.w} ${this.hgt} L 0 ${this.hgt} Z`;
  });

  private smooth(p: { x: number; y: number }[]): string {
    if (!p.length) return '';
    let d = `M ${p[0].x} ${p[0].y}`;
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1];
      const b = p[i];
      const cx = (a.x + b.x) / 2;
      d += ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`;
    }
    return d;
  }
}
