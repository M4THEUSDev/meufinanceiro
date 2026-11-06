import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonBackButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { Account } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { AccountCardComponent } from '../../shared/components/account-card.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { AccountFormModal } from './account-form.modal';

/** [O] Contas · Minhas contas  /  [Q] Conta adicionada */
@Component({
  selector: 'mf-accounts',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonContent, IonIcon, AccountCardComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/mais" text="Mais"></ion-back-button></ion-buttons>
        <ion-title>Minhas contas</ion-title>
        <ion-buttons slot="end"><button class="mf-reset mf-action" type="button" aria-label="Adicionar conta" (click)="add()"><ion-icon name="add"></ion-icon></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true" class="mf-page">
      <ion-header collapse="condense" class="ion-no-border"><ion-toolbar><ion-title size="large">Minhas contas</ion-title></ion-toolbar></ion-header>
      <div class="body">
        <div class="pad">
          <div class="total">
            <span class="t-footnote-sb">Saldo consolidado</span>
            <span class="t-amount-large">{{ store.totalBalance() | money }}</span>
            <span class="t-footnote sub">{{ summary() }}</span>
          </div>
        </div>
        @for (g of groups(); track g.name) {
          <div class="pad">
            <p class="mf-label">{{ g.name }}</p>
            @for (a of g.items; track a.id) {
              <mf-account-card [account]="a" [balance]="store.balanceOf(a.id)" (click)="edit(a)"></mf-account-card>
            }
          </div>
        } @empty {
          <div class="pad"><div class="mf-card mf-empty"><ion-icon name="wallet-outline"></ion-icon><p class="t-headline">Nenhuma conta</p><p class="t-footnote">Adicione sua primeira conta para começar.</p></div></div>
        }
        <div class="pad">
          <button class="mf-reset import" type="button" (click)="importStatement()">
            <ion-icon name="cloud-upload-outline"></ion-icon>
            <span class="grow"><span class="t-subhead-sb">Importar extrato do banco</span><span class="t-caption1 c-secondary">Nubank, Itaú, Santander, XP e outros (OFX ou CSV)</span></span>
            <ion-icon class="chev" name="chevron-forward"></ion-icon>
          </button>
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 16px; padding: 4px 0 calc(110px + env(safe-area-inset-bottom)); }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
    .total { display: flex; flex-direction: column; gap: 4px; padding: 20px; border-radius: var(--mf-radius-xl); background: var(--mf-brand-deep); color: #fff; box-shadow: var(--mf-elevation-brand); }
    .sub { opacity: 0.75; }
    .import { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: var(--mf-radius-lg); background: var(--ion-card-background); box-shadow: var(--mf-elevation-sm); text-align: left; }
    .import > ion-icon:first-child { font-size: 22px; color: var(--ion-color-primary-shade); }
    .import .grow { flex: 1; display: flex; flex-direction: column; }
    .chev { color: var(--mf-text-tertiary); font-size: 16px; }
  `,
})
export class AccountsPage {
  protected readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly router = inject(Router);

  readonly summary = computed(() => {
    const act = this.store.accounts().filter((a) => a.active).length;
    const off = this.store.accounts().length - act;
    return `${act} ${act === 1 ? 'conta ativa' : 'contas ativas'}${off ? ` · ${off} ${off === 1 ? 'desativada' : 'desativadas'}` : ''}`;
  });

  readonly groups = computed(() => {
    const act = this.store.accounts().filter((a) => a.active);
    const off = this.store.accounts().filter((a) => !a.active);
    const bank = act.filter((a) => a.kind === 'corrente' || a.kind === 'digital');
    const save = act.filter((a) => a.kind === 'poupanca' || a.kind === 'investimento');
    const cash = act.filter((a) => a.kind === 'dinheiro' || a.kind === 'carteira');
    const hasInv = save.some((a) => a.kind === 'investimento');
    const hasPoup = save.some((a) => a.kind === 'poupanca');
    const saveName = hasInv && hasPoup ? 'Poupança & investimentos' : hasInv ? 'Investimentos' : 'Poupança';
    return [
      { name: 'Contas bancárias', items: bank },
      { name: saveName, items: save },
      { name: 'Dinheiro', items: cash },
      { name: 'Desativadas', items: off },
    ].filter((g) => g.items.length);
  });

  importStatement(): void {
    void this.router.navigateByUrl('/tabs/mais/importar');
  }

  async add(): Promise<void> {
    const m = await this.modal.create({ component: AccountFormModal, cssClass: 'mf-card-modal', presentingElement: document.querySelector('ion-tabs') as HTMLElement });
    await m.present();
  }

  async edit(a: Account): Promise<void> {
    const m = await this.modal.create({ component: AccountFormModal, componentProps: { accountId: a.id }, cssClass: 'mf-card-modal', presentingElement: document.querySelector('ion-tabs') as HTMLElement });
    await m.present();
  }
}
