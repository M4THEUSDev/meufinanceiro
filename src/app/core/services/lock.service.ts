import { Injectable, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { StoreService } from './store.service';

/** Bloqueio do app: exige Face ID / senha ao voltar do segundo plano */
@Injectable({ providedIn: 'root' })
export class LockService {
  private readonly store = inject(StoreService);
  readonly locked = signal(false);
  private hiddenAt = 0;

  init(): void {
    const onHide = () => (this.hiddenAt = Date.now());
    const onShow = () => this.evaluate();
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => (isActive ? onShow() : onHide()));
    } else {
      document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
    }
  }

  private evaluate(): void {
    const s = this.store.settings();
    if (!s.loggedIn || s.appLock === 'off' || !this.hiddenAt) return;
    const away = Date.now() - this.hiddenAt;
    const limit = { off: Infinity, immediately: 0, '1min': 60_000, '5min': 300_000 }[s.appLock];
    if (away >= limit) this.locked.set(true);
  }

  unlock(): void {
    this.locked.set(false);
    this.hiddenAt = 0;
  }
}
