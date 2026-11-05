import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Anel de progresso (Resumo do orçamento / Acompanhar gastos) */
@Component({
  selector: 'mf-ring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.width.px]': 'size()', '[style.height.px]': 'size()' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + size() + ' ' + size()" aria-hidden="true">
      <circle [attr.cx]="c()" [attr.cy]="c()" [attr.r]="r()" fill="none" stroke="var(--ion-color-step-50)" [attr.stroke-width]="stroke()"></circle>
      <circle [attr.cx]="c()" [attr.cy]="c()" [attr.r]="r()" fill="none" [attr.stroke]="color()" [attr.stroke-width]="stroke()"
        [attr.stroke-dasharray]="dash()" stroke-linecap="butt" [attr.transform]="'rotate(-90 ' + c() + ' ' + c() + ')'" class="arc"></circle>
    </svg>
    <div class="center"><ng-content></ng-content></div>
  `,
  styles: `
    :host { position: relative; display: inline-block; flex: 0 0 auto; }
    svg { width: 100%; height: 100%; display: block; }
    .arc { transition: stroke-dasharray 500ms ease; }
    .center { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  `,
})
export class RingComponent {
  readonly value = input(0);
  readonly size = input(96);
  readonly stroke = input(14);
  readonly color = input('var(--ion-color-primary)');
  readonly c = computed(() => this.size() / 2);
  readonly r = computed(() => (this.size() - this.stroke()) / 2);
  readonly dash = computed(() => {
    const len = 2 * Math.PI * this.r();
    const v = Math.max(0, Math.min(1, this.value()));
    return `${len * v} ${len}`;
  });
}
