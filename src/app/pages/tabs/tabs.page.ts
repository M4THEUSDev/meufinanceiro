import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs, ModalController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { openTransactionForm } from '../transactions/transaction-form.modal';

/** TabBar — Início / Transações / + Adicionar (abre ion-modal) / Planejamento / Mais */
@Component({
  selector: 'mf-tabs',
  imports: [IonTabs, IonTabBar, IonTabButton, IonIcon, IonLabel],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-tabs>
      <ion-tab-bar slot="bottom" class="mf-tabbar" [class.hidden]="hideBar()">
        <ion-tab-button tab="inicio" href="/tabs/inicio">
          <ion-icon name="home-outline"></ion-icon>
          <ion-label>Início</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="transacoes" href="/tabs/transacoes">
          <ion-icon name="receipt-outline"></ion-icon>
          <ion-label>Transações</ion-label>
        </ion-tab-button>
        <div class="add-slot">
          <button class="add" type="button" aria-label="Adicionar transação" (click)="add()">
            <ion-icon name="add"></ion-icon>
          </button>
        </div>
        <ion-tab-button tab="planejamento" href="/tabs/planejamento">
          <ion-icon name="pie-chart-outline"></ion-icon>
          <ion-label>Planejamento</ion-label>
        </ion-tab-button>
        <ion-tab-button tab="mais" href="/tabs/mais">
          <ion-icon name="grid-outline"></ion-icon>
          <ion-label>Mais</ion-label>
        </ion-tab-button>
      </ion-tab-bar>
    </ion-tabs>
  `,
  styles: `
    ion-tab-bar.mf-tabbar {
      --background: var(--ion-tab-bar-background);
      --border: 0.5px solid var(--ion-border-color);
      --color: var(--mf-text-tertiary);
      --color-selected: var(--ion-color-primary);
      height: calc(49px + env(safe-area-inset-bottom));
      padding: 0 8px env(safe-area-inset-bottom);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      overflow: visible;
      contain: none;
    }
    ion-tab-bar.hidden { display: none; }
    ion-tab-button { --padding-top: 0; --padding-bottom: 0; flex: 1; }
    ion-tab-button ion-icon { font-size: 26px; margin-bottom: 2px; }
    ion-tab-button ion-label { font-size: 11px; line-height: 13px; font-weight: 500; letter-spacing: -0.11px; margin: 0; }
    .add-slot { flex: 1; position: relative; height: 49px; display: flex; justify-content: center; }
    .add {
      position: absolute; top: -18px; width: 56px; height: 56px; border-radius: 999px; padding: 0;
      background: var(--ion-color-primary); color: #fff; border: 4px solid var(--ion-background-color);
      box-shadow: var(--mf-elevation-brand); display: grid; place-items: center; cursor: pointer;
      transition: transform 120ms ease;
    }
    .add:active { transform: scale(0.94); }
    .add ion-icon { font-size: 28px; }
  `,
})
export class TabsPage {
  private readonly modal = inject(ModalController);
  private readonly ui = inject(UiService);
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);
  /** telas empilhadas sem tab bar (Detalhes da transação, Acompanhar orçamento) */
  readonly hideBar = signal(false);

  constructor() {
    const check = (url: string) => this.hideBar.set(/^\/tabs\/(transacoes|planejamento)\/[^/?#]+/.test(url));
    check(this.router.url);
    this.router.events.pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd)).subscribe((e) => check(e.urlAfterRedirects));
  }

  async add(): Promise<void> {
    this.ui.tap();
    await openTransactionForm(this.modal, this.ui, this.store);
  }
}
