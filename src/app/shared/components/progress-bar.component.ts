import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { catColor } from '../../core/icons';

/** ProgressBar — <ion-progress-bar> estilizado (trilho step-50, preenchimento na cor indicada) */
@Component({
  selector: 'mf-progress-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="fill" [style.width.%]="pct()" [style.background]="fill()"></div>`,
  host: { role: 'progressbar', '[attr.aria-valuenow]': 'pct()', 'aria-valuemin': '0', 'aria-valuemax': '100', '[style.height.px]': 'height()' },
  styles: `
    :host { display: block; width: 100%; background: var(--ion-color-step-50); border-radius: 999px; overflow: hidden; }
    .fill { height: 100%; border-radius: 999px; transition: width 400ms ease; }
  `,
})
export class ProgressBarComponent {
  /** 0..1 */
  readonly value = input(0);
  readonly color = input<string>('var(--ion-color-primary)');
  readonly height = input(8);
  readonly pct = computed(() => Math.max(0, Math.min(100, this.value() * 100)));
  readonly fill = computed(() => (this.color().startsWith('var') || this.color().startsWith('#') ? this.color() : catColor(this.color())));
}
