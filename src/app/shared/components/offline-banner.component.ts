import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { hhmm } from '../../core/utils/format';

/** Estado · Sem conexão — o app é offline-first; o banner apenas informa */
@Component({
  selector: 'mf-offline-banner',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (offline()) {
      <div class="banner t-footnote" role="status"><ion-icon name="cloud-download-outline"></ion-icon>Você está offline. Mostrando dados salvos às {{ since() }}.</div>
    }
  `,
  styles: `
    .banner { position: fixed; z-index: 1000; left: 12px; right: 12px; top: calc(env(safe-area-inset-top) + 6px); display: flex; align-items: center; gap: 8px;
      padding: 10px 14px; border-radius: 12px; background: var(--ion-text-color); color: var(--ion-card-background); box-shadow: var(--mf-elevation-lg); }
    ion-icon { font-size: 16px; flex: 0 0 auto; }
  `,
})
export class OfflineBannerComponent {
  readonly offline = signal(typeof navigator !== 'undefined' && !navigator.onLine);
  readonly since = signal(hhmm(new Date()));

  constructor() {
    const off = () => {
      this.since.set(hhmm(new Date()));
      this.offline.set(true);
    };
    const on = () => this.offline.set(false);
    window.addEventListener('offline', off);
    window.addEventListener('online', on);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('offline', off);
      window.removeEventListener('online', on);
    });
  }
}
