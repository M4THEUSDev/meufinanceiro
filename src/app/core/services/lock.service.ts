import { Injectable, inject, signal } from '@angular/core';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AlertController, NavController } from '@ionic/angular/standalone';
import { StoreService } from './store.service';

/** sessão expira após 30 dias sem abrir o app */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Bloqueio do app: exige Face ID / senha ao voltar do segundo plano */
@Injectable({ providedIn: 'root' })
export class LockService {
  private readonly store = inject(StoreService);
  private readonly alert = inject(AlertController);
  private readonly nav = inject(NavController);
  readonly locked = signal(false);
  private hiddenAt = 0;
  private expiredShown = false;

  init(): void {
    this.checkSession();
    const onHide = () => {
      this.hiddenAt = Date.now();
      if (this.store.settings().loggedIn) this.store.updateSettings({ lastActiveAt: new Date().toISOString() });
    };
    const onShow = () => {
      if (!this.checkSession()) this.evaluate();
    };
    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => (isActive ? onShow() : onHide()));
    } else {
      document.addEventListener('visibilitychange', () => (document.hidden ? onHide() : onShow()));
    }
  }

  /** Estado · Sessão expirada — retorna true se a sessão expirou */
  checkSession(): boolean {
    const s = this.store.settings();
    if (!s.loggedIn) return false;
    const last = s.lastActiveAt ? new Date(s.lastActiveAt).getTime() : Date.now();
    if (Date.now() - last < SESSION_TTL_MS) {
      this.store.updateSettings({ lastActiveAt: new Date().toISOString() });
      return false;
    }
    if (this.expiredShown) return true;
    this.expiredShown = true;
    // até entrar novamente os valores ficam ocultos
    const previous = s.hideValues;
    this.store.updateSettings({ hideValues: true });
    void this.showExpired(previous);
    return true;
  }

  private async showExpired(previousHide: boolean): Promise<void> {
    const a = await this.alert.create({
      header: 'Sessão expirada',
      message: 'Por segurança, entre novamente para continuar. Seus dados estão protegidos.',
      cssClass: 'mf-alert',
      backdropDismiss: false,
      buttons: [
        { text: 'Agora não', role: 'cancel' },
        { text: 'Entrar', role: 'confirm', cssClass: 'mf-strong' },
      ],
    });
    await a.present();
    const { role } = await a.onDidDismiss();
    this.expiredShown = false;
    if (role === 'confirm') {
      this.store.updateSettings({ loggedIn: false, lastActiveAt: undefined, hideValues: previousHide });
      void this.nav.navigateRoot('/login', { animationDirection: 'back' });
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
