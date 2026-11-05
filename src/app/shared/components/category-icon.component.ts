import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { catColor } from '../../core/icons';

/** CategoryIcon — fundo = cor da categoria a 14%, ícone = cor da categoria. `solid` = fundo cheio (AccountCard). */
@Component({
  selector: 'mf-category-icon',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<ion-icon [name]="icon()" aria-hidden="true"></ion-icon>`,
  host: {
    '[class.solid]': 'solid()',
    '[style.--c]': 'cssColor()',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.border-radius.px]': 'radius()',
    '[style.font-size.px]': 'iconSize()',
  },
  styles: `
    :host {
      position: relative; isolation: isolate; flex: 0 0 auto;
      display: inline-flex; align-items: center; justify-content: center;
      color: var(--c);
    }
    :host::before {
      content: ''; position: absolute; inset: 0; border-radius: inherit;
      background: var(--c); opacity: 0.14; z-index: -1;
    }
    :host(.solid) { color: #fff; }
    :host(.solid)::before { opacity: 1; }
  `,
})
export class CategoryIconComponent {
  readonly icon = input.required<string>();
  readonly color = input<string>('outros');
  readonly size = input(40);
  readonly solid = input(false);
  readonly cssColor = computed(() => (this.color().startsWith('#') || this.color().startsWith('var') ? this.color() : catColor(this.color())));
  readonly radius = computed(() => (this.size() >= 40 ? 12 : 8));
  readonly iconSize = computed(() => Math.round(this.size() / 2));
}
