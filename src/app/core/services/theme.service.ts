import { Injectable, effect, inject, signal } from '@angular/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { StoreService } from './store.service';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly store = inject(StoreService);
  private readonly media = window.matchMedia?.('(prefers-color-scheme: dark)');
  private readonly systemDark = signal(this.media?.matches ?? false);
  readonly isDark = signal(false);

  constructor() {
    this.media?.addEventListener?.('change', (e) => this.systemDark.set(e.matches));
    effect(() => {
      const pref = this.store.settings().theme;
      const dark = pref === 'dark' || (pref === 'system' && this.systemDark());
      this.isDark.set(dark);
      document.documentElement.classList.toggle('mf-dark', dark);
      if (Capacitor.isNativePlatform()) {
        void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(() => undefined);
      }
    });
  }
}
