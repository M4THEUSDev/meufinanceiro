import { Injectable, inject } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular/standalone';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class UiService {
  private readonly toastCtrl = inject(ToastController);
  private readonly alertCtrl = inject(AlertController);

  /** Toast (Figma · Feedback & Estados · Toast) — ícone + título + mensagem, com ação opcional */
  async toast(opts: {
    title: string;
    message?: string;
    tone?: 'success' | 'danger' | 'warning' | 'info';
    action?: { text: string; handler: () => void };
    duration?: number;
  }): Promise<void> {
    const icon = { success: 'checkmark-circle', danger: 'alert-circle', warning: 'warning', info: 'information-circle' }[opts.tone ?? 'success'];
    const t = await this.toastCtrl.create({
      header: opts.title,
      message: opts.message,
      icon,
      position: 'top',
      duration: opts.duration ?? 3000,
      cssClass: ['mf-toast', `mf-toast-${opts.tone ?? 'success'}`],
      swipeGesture: 'vertical',
      buttons: opts.action ? [{ text: opts.action.text, handler: opts.action.handler }] : [],
    });
    await t.present();
    if (opts.tone === 'danger') this.notify('error');
    else this.notify('success');
  }

  /** Alert de confirmação destrutiva (Figma · Alert) */
  async confirm(opts: { header: string; message: string; confirmText: string; cancelText?: string; destructive?: boolean }): Promise<boolean> {
    const a = await this.alertCtrl.create({
      header: opts.header,
      message: opts.message,
      cssClass: 'mf-alert',
      buttons: [
        { text: opts.cancelText ?? 'Cancelar', role: 'cancel' },
        { text: opts.confirmText, role: 'confirm', cssClass: opts.destructive ? 'mf-danger' : '' },
      ],
    });
    await a.present();
    const { role } = await a.onDidDismiss();
    return role === 'confirm';
  }

  tap(): void {
    if (Capacitor.isNativePlatform()) void Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined);
  }

  notify(type: 'success' | 'warning' | 'error'): void {
    if (!Capacitor.isNativePlatform()) return;
    const map = { success: NotificationType.Success, warning: NotificationType.Warning, error: NotificationType.Error };
    void Haptics.notification({ type: map[type] }).catch(() => undefined);
  }
}
