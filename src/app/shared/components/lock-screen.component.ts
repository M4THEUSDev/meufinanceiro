import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonIcon, IonSpinner } from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { BiometricService } from '../../core/services/biometric.service';
import { LockService } from '../../core/services/lock.service';
import { StoreService } from '../../core/services/store.service';
import { LogoMarkComponent } from './logo-mark.component';

/** Tela de bloqueio exibida sobre o app */
@Component({
  selector: 'mf-lock-screen',
  imports: [FormsModule, IonButton, IonIcon, IonSpinner, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="lock">
      <div class="logo"><mf-logo-mark [size]="44"></mf-logo-mark></div>
      <h1 class="t-title2">MeuFinanceiro bloqueado</h1>
      <p class="t-subhead c-secondary">Desbloqueie para ver suas finanças.</p>
      @if (store.settings().faceId && bio.native) {
        <ion-button expand="block" (click)="face()">@if (busy()) { <ion-spinner name="crescent"></ion-spinner> } @else { <ion-icon slot="start" name="scan-outline"></ion-icon>Desbloquear com Face ID }</ion-button>
      }
      <form class="pw" (ngSubmit)="password()">
        <input type="password" name="pw" placeholder="Senha" autocomplete="current-password" [ngModel]="pw()" (ngModelChange)="pw.set($event); err.set('')" />
        <ion-button type="submit" class="tonal">Entrar</ion-button>
      </form>
      @if (err()) { <p class="err t-footnote">{{ err() }}</p> }
    </div>
  `,
  styles: `
    :host { position: fixed; inset: 0; z-index: 99999; background: var(--ion-background-color); display: flex; align-items: center; justify-content: center; }
    .lock { width: 100%; max-width: 360px; padding: 24px; display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
    .logo { width: 72px; height: 72px; border-radius: 20px; background: var(--ion-color-primary); display: grid; place-items: center; box-shadow: var(--mf-elevation-brand); margin-bottom: 8px; }
    h1, p { margin: 0; }
    ion-button[expand] { width: 100%; margin-top: 12px; }
    .pw { display: flex; gap: 8px; width: 100%; }
    .pw input { flex: 1; min-width: 0; height: 50px; border-radius: 12px; border: 1px solid var(--ion-border-color); background: var(--ion-card-background); padding: 0 16px; font: inherit; font-size: 17px; color: var(--ion-text-color); outline: 0; }
    .err { color: var(--ion-color-danger); }
  `,
})
export class LockScreenComponent {
  protected readonly store = inject(StoreService);
  private readonly lock = inject(LockService);
  private readonly auth = inject(AuthService);
  protected readonly bio = inject(BiometricService);
  readonly busy = signal(false);
  readonly pw = signal('');
  readonly err = signal('');

  async face(): Promise<void> {
    this.busy.set(true);
    const ok = await this.bio.authenticate();
    this.busy.set(false);
    if (ok) this.lock.unlock();
  }

  async password(): Promise<void> {
    const ok = await this.auth.verifyPassword(this.pw());
    if (ok) {
      this.pw.set('');
      this.lock.unlock();
    } else this.err.set('Senha incorreta.');
  }
}
