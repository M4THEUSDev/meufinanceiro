import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonHeader, IonIcon, IonTitle, IonToolbar } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { initials } from '../../core/utils/format';
import { APP_VERSION } from '../splash/splash.page';

/** [N] Mais · Menu */
@Component({
  selector: 'mf-more',
  imports: [IonHeader, IonToolbar, IonTitle, IonContent, IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border" [translucent]="true"><ion-toolbar><ion-title>Mais</ion-title></ion-toolbar></ion-header>
    <ion-content [fullscreen]="true" class="mf-page">
      <ion-header collapse="condense" class="ion-no-border"><ion-toolbar><ion-title size="large">Mais</ion-title></ion-toolbar></ion-header>
      <div class="body">
        <button class="mf-reset profile" type="button" (click)="go('/tabs/mais/configuracoes')">
          <span class="avatar">{{ initials() }}</span>
          <span class="who"><span class="t-title3 ellipsis">{{ s().userName }}</span><span class="t-footnote c-secondary ellipsis">{{ s().email }}</span></span>
          <ion-icon class="chev" name="chevron-forward"></ion-icon>
        </button>

        <div class="pad">
          <p class="mf-label">Finanças</p>
          <div class="mf-group elevated">
            @for (i of finance; track i.url) {
              <button class="mf-row" type="button" (click)="go(i.url)">
                <span class="lead" [style.--lead]="i.color"><ion-icon [name]="i.icon"></ion-icon></span>
                <span class="label grow">{{ i.label }}</span>
                @if (i.badge?.()) { <span class="value">{{ i.badge!() }}</span> }
                <ion-icon class="chev" name="chevron-forward"></ion-icon>
              </button>
            }
          </div>
        </div>

        <div class="pad">
          <p class="mf-label">Aplicativo</p>
          <div class="mf-group elevated">
            <button class="mf-row" type="button" (click)="go('/tabs/mais/configuracoes')">
              <span class="lead" style="--lead: var(--mf-text-secondary)"><ion-icon name="settings-outline"></ion-icon></span>
              <span class="label grow">Configurações</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
            </button>
            <button class="mf-row" type="button" (click)="go('/tabs/mais/configuracoes', 'seguranca')">
              <span class="lead" style="--lead: var(--mf-category-saude)"><ion-icon name="shield-checkmark-outline"></ion-icon></span>
              <span class="label grow">Perfil e segurança</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
            </button>
          </div>
        </div>

        <p class="version t-caption1 c-tertiary">MeuFinanceiro {{ version }} (1) · Feito para iPhone</p>
      </div>
    </ion-content>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 20px; padding: 4px 0 calc(110px + env(safe-area-inset-bottom)); }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
    .profile { margin: 0 16px; display: flex; align-items: center; gap: 16px; padding: 16px; border-radius: var(--mf-radius-xl); background: var(--ion-card-background); box-shadow: var(--mf-elevation-sm); }
    .avatar { width: 58px; height: 58px; border-radius: 999px; background: var(--mf-gradient-avatar); color: #fff; display: grid; place-items: center; font-size: 22px; font-weight: 600; flex: 0 0 auto; }
    .who { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .chev { color: var(--mf-text-tertiary); font-size: 16px; }
    .version { text-align: center; margin: 0; }
  `,
})
export class MorePage {
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);
  readonly s = this.store.settings;
  readonly initials = computed(() => initials(this.s().userName));
  readonly version = APP_VERSION;

  readonly finance: { label: string; icon: string; color: string; url: string; badge?: () => string }[] = [
    { label: 'Ganhos e dívidas', icon: 'swap-vertical-outline', color: 'var(--mf-category-saude)', url: '/tabs/mais/financas' },
    { label: 'Próximos meses', icon: 'calendar-outline', color: 'var(--mf-category-reembolso)', url: '/tabs/mais/previsao' },
    { label: 'Contas fixas e salário', icon: 'repeat-outline', color: 'var(--mf-category-transporte)', url: '/tabs/mais/recorrentes' },
    { label: 'Minhas contas', icon: 'wallet-outline', color: 'var(--mf-category-educacao)', url: '/tabs/mais/contas' },
    { label: 'Categorias', icon: 'pricetag-outline', color: 'var(--mf-category-alimentacao)', url: '/tabs/mais/categorias' },
    { label: 'Cartões de crédito', icon: 'card-outline', color: 'var(--mf-category-moradia)', url: '/tabs/mais/cartoes' },
    { label: 'Metas financeiras', icon: 'flag-outline', color: 'var(--mf-category-salario)', url: '/tabs/mais/metas' },
    { label: 'Relatórios', icon: 'bar-chart-outline', color: 'var(--mf-category-transporte)', url: '/tabs/mais/relatorios' },
    { label: 'Importar extrato do banco', icon: 'cloud-upload-outline', color: 'var(--mf-category-extra)', url: '/tabs/mais/importar' },
  ];

  go(url: string, fragment?: string): void {
    void this.router.navigate([url], { fragment });
  }
}
