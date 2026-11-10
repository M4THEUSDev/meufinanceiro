import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { InvestmentItemComponent } from '../../shared/components/investment-item.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openInvestmentForm } from './investment-form.modal';

/** Investimentos · lista com total, o que é seu e o que é de outras pessoas */
@Component({
  selector: 'mf-investments',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, InvestmentItemComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/inicio" text="Voltar"></ion-back-button></ion-buttons>
        <ion-title>Investimentos</ion-title>
        <ion-buttons slot="end"><button class="mf-reset mf-action" type="button" aria-label="Novo investimento" (click)="add()"><ion-icon name="add"></ion-icon></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true" class="mf-page">
      <ion-header collapse="condense" class="ion-no-border"><ion-toolbar><ion-title size="large">Investimentos</ion-title></ion-toolbar></ion-header>
      <div class="body">
        <div class="pad">
          <div class="hero">
            <span class="t-footnote-sb">Total investido</span>
            <span class="t-amount-large nowrap">{{ totals().total | money }}</span>
            <div class="kv">
              <div><span class="t-caption1">Seu</span><span class="t-subhead-sb">{{ totals().mine | money }}</span></div>
              <div><span class="t-caption1">De outras pessoas</span><span class="t-subhead-sb">{{ totals().others | money }}</span></div>
            </div>
          </div>
        </div>
        <div class="pad">
          @if (list().length) {
            <div class="mf-list">
              @for (i of list(); track i.id) { <mf-investment-item [inv]="i" (click)="open(i.id)"></mf-investment-item> }
            </div>
            <p class="t-footnote c-secondary note">Toque em um investimento para ver o extrato e registrar resgates, aportes ou o saldo do mês.</p>
          } @else {
            <div class="mf-card mf-empty">
              <ion-icon name="trending-up-outline"></ion-icon>
              <p class="t-headline">Nenhum investimento</p>
              <p class="t-footnote">Cadastre onde seu dinheiro está aplicado para acompanhar o saldo.</p>
            </div>
          }
          <ion-button expand="block" fill="clear" (click)="add()"><ion-icon slot="start" name="add"></ion-icon>Novo investimento</ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 20px; padding: 4px 0 calc(110px + env(safe-area-inset-bottom)); }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 10px; }
    .hero { display: flex; flex-direction: column; gap: 4px; padding: 20px; border-radius: var(--mf-radius-xl); color: #fff; background: linear-gradient(135deg, #0f9d74, #0b6e8a); box-shadow: var(--mf-elevation-md); }
    .hero .t-footnote-sb { opacity: 0.85; }
    .kv { display: flex; gap: 12px; margin-top: 10px; }
    .kv > div { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: rgba(255, 255, 255, 0.16); }
    .kv .t-caption1 { opacity: 0.85; }
    .note { margin: 0; }
  `,
})
export class InvestmentsPage {
  private readonly store = inject(StoreService);
  private readonly router = inject(Router);
  private readonly modal = inject(ModalController);

  readonly totals = this.store.investmentTotals;
  readonly list = computed(() => [...this.store.investments()].sort((a, b) => Number(b.mine) - Number(a.mine) || this.store.investmentBalance(b) - this.store.investmentBalance(a)));

  open(id: string): void {
    void this.router.navigateByUrl(`/tabs/mais/investimentos/${id}`);
  }

  async add(): Promise<void> {
    const r = await openInvestmentForm(this.modal);
    if (r.role === 'save' && r.id) this.open(r.id);
  }
}
