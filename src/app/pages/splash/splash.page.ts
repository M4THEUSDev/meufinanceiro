import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { IonContent, IonSpinner, NavController } from '@ionic/angular/standalone';
import { SplashScreen } from '@capacitor/splash-screen';
import { Capacitor } from '@capacitor/core';
import { StoreService } from '../../core/services/store.service';
import { LogoMarkComponent } from '../../shared/components/logo-mark.component';

export const APP_VERSION = '1.0.0';

/** [A] Splash — avança sozinho em 1,5 s */
@Component({
  selector: 'mf-splash',
  imports: [IonContent, IonSpinner, LogoMarkComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content [fullscreen]="true" [scrollY]="false">
      <div class="splash">
        <div class="ellipse e1"></div>
        <div class="ellipse e2"></div>
        <div class="lockup">
          <div class="mark"><mf-logo-mark [size]="72"></mf-logo-mark></div>
          <div class="brand">
            <h1 class="t-title1">MeuFinanceiro</h1>
            <p class="t-subhead">Suas finanças, sob controle.</p>
          </div>
        </div>
        <div class="loading">
          <ion-spinner name="crescent"></ion-spinner>
          <span class="t-caption1">Versão {{ version }}</span>
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    ion-content { --background: transparent; }
    .splash { position: relative; height: 100%; overflow: hidden; background: var(--mf-gradient-splash); color: #fff; }
    :host-context(html.mf-dark) .splash { background: linear-gradient(114.8deg, #064e3b 14.29%, #022c22 53.57%, #020617 85.71%); }
    .ellipse { position: absolute; border-radius: 50%; background: #fff; }
    .e1 { width: 420px; height: 420px; left: -120px; top: -140px; opacity: 0.12; }
    .e2 { width: 380px; height: 380px; right: -187px; bottom: -88px; opacity: 0.08; }
    .lockup { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 20px; }
    .mark { width: 112px; height: 112px; border-radius: 32px; background: rgba(255,255,255,0.16); border: 1px solid rgba(255,255,255,0.3); display: grid; place-items: center; animation: pop 600ms cubic-bezier(.2,.9,.3,1.2) both; }
    .brand { display: flex; flex-direction: column; align-items: center; gap: 6px; white-space: nowrap; animation: fade 500ms 150ms ease both; }
    h1, p { margin: 0; }
    p { opacity: 0.8; }
    .loading { position: absolute; left: 50%; bottom: calc(74px + env(safe-area-inset-bottom) / 2); transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 10px; }
    ion-spinner { --color: #fff; width: 22px; height: 22px; opacity: 0.8; }
    .loading span { opacity: 0.6; }
    @keyframes pop { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes fade { from { transform: translateY(8px); opacity: 0; } to { transform: none; opacity: 1; } }
  `,
})
export class SplashPage implements OnInit {
  private readonly nav = inject(NavController);
  private readonly store = inject(StoreService);
  protected readonly version = APP_VERSION;

  ngOnInit(): void {
    if (Capacitor.isNativePlatform()) void SplashScreen.hide({ fadeOutDuration: 300 }).catch(() => undefined);
    setTimeout(() => {
      const s = this.store.settings();
      const target = !s.onboarded ? '/onboarding' : !s.loggedIn ? '/login' : '/tabs/inicio';
      void this.nav.navigateRoot(target, { animated: true, animationDirection: 'forward' });
    }, 1500);
  }
}
