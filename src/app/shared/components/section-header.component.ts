import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

@Component({
  selector: 'mf-section-header',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 class="t-title3">{{ title() }}</h2>
    @if (action()) {
      <button class="mf-reset action" type="button" (click)="actionClick.emit()">
        <span class="t-subhead-sb">{{ action() }}</span>
        <ion-icon name="chevron-forward"></ion-icon>
      </button>
    }
  `,
  styles: `
    :host { display: flex; align-items: center; justify-content: space-between; }
    h2 { margin: 0; color: var(--ion-text-color); }
    .action { display: inline-flex; align-items: center; gap: 2px; color: var(--ion-color-primary-shade); min-height: 32px; }
    ion-icon { font-size: 14px; }
  `,
})
export class SectionHeaderComponent {
  readonly title = input.required<string>();
  readonly action = input<string>();
  readonly actionClick = output<void>();
}
