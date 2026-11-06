import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonIcon, IonSpinner, NavController } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { BiometricService } from '../../core/services/biometric.service';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { LogoMarkComponent } from '../../shared/components/logo-mark.component';

/** [E] Login · Padrão */
@Component({
  selector: 'mf-login',
  imports: [FormsModule, IonContent, IonButton, IonIcon, IonSpinner, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly store = inject(StoreService);
  private readonly nav = inject(NavController);
  private readonly ui = inject(UiService);

  readonly email = signal(this.store.settings().hasLoggedBefore ? this.store.settings().email : '');
  readonly password = signal('');
  readonly showPassword = signal(false);
  readonly focused = signal<'email' | 'password' | null>(null);
  readonly error = signal<{ field: 'email' | 'password'; message: string } | null>(null);
  readonly loading = signal(false);
  readonly faceLoading = signal(false);

  readonly native = inject(BiometricService).native;

  get faceIdAvailable(): boolean {
    return this.auth.faceIdAvailable;
  }

  async submit(): Promise<void> {
    if (this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    const res = await this.auth.login(this.email(), this.password());
    this.loading.set(false);
    if (!res.ok) {
      this.error.set({ field: res.field, message: res.message });
      this.ui.notify('error');
      return;
    }
    this.ui.notify('success');
    void this.nav.navigateRoot('/tabs/inicio', { animationDirection: 'forward' });
  }

  async faceId(): Promise<void> {
    if (!this.faceIdAvailable) {
      await this.ui.toast({ title: 'Face ID indisponível', message: 'Entre com e-mail e senha e ative o Face ID em Configurações.', tone: 'info' });
      return;
    }
    this.faceLoading.set(true);
    const ok = await this.auth.biometricLogin();
    this.faceLoading.set(false);
    if (ok) void this.nav.navigateRoot('/tabs/inicio', { animationDirection: 'forward' });
  }

  async forgot(): Promise<void> {
    const ok = await this.ui.confirm({
      header: 'Redefinir senha',
      message: 'A senha salva neste iPhone será apagada. No próximo acesso, a senha digitada passará a ser a nova senha. Seus dados financeiros serão mantidos.',
      confirmText: 'Redefinir',
    });
    if (ok) {
      this.auth.resetPassword();
      this.password.set('');
      await this.ui.toast({ title: 'Senha redefinida', message: 'Entre com uma nova senha para continuar.' });
    }
  }
}
