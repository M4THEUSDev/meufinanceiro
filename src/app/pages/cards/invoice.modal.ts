import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IonButton, IonContent, IonHeader, ModalController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, money } from '../../core/utils/format';
import { TransactionItemComponent } from '../../shared/components/transaction-item.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

/** Fatura detalhada + pagamento */
@Component({
  selector: 'mf-invoice',
  imports: [IonHeader, IonContent, IonButton, TransactionItemComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar"><span style="width:64px"></span><span class="title">Fatura · {{ card()?.name }}</span><button type="button" class="strong" (click)="close()">OK</button></div>
    </ion-header>
    <ion-content>
      <div class="body">
        <div class="mf-card total">
          <span class="t-footnote c-secondary">Total da fatura atual</span>
          <span class="t-amount-large">{{ total() | money }}</span>
          <span class="t-footnote c-secondary">{{ items().length }} {{ items().length === 1 ? 'lançamento' : 'lançamentos' }} · paga com {{ account() }}</span>
        </div>
        @if (items().length) {
          <div class="mf-list">
            @for (t of items(); track t.id) { <mf-transaction-item [tx]="t"></mf-transaction-item> }
          </div>
          <ion-button expand="block" (click)="pay()">Pagar fatura · {{ total() | money }}</ion-button>
        } @else {
          <div class="mf-card mf-empty"><p class="t-headline">Fatura zerada</p><p class="t-footnote">Nenhuma compra em aberto neste cartão.</p></div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .body { padding: 8px 16px 40px; display: flex; flex-direction: column; gap: 16px; }
    .total { display: flex; flex-direction: column; gap: 2px; }
  `,
})
export class InvoiceModal {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);
  cardId!: string;

  readonly card = computed(() => this.store.card(this.cardId));
  readonly items = computed(() => this.store.cardInvoiceItems(this.cardId));
  readonly total = computed(() => this.store.cardOpenAmount(this.cardId));
  readonly account = computed(() => this.store.account(this.card()?.accountId)?.name ?? 'conta');

  close(): void {
    void this.modalCtrl.dismiss();
  }

  async pay(): Promise<void> {
    const v = this.store.hidden() ? HIDDEN_MASK : money(this.total());
    const ok = await this.ui.confirm({ header: 'Pagar fatura?', message: `${v} serão debitados de ${this.account()}.`, confirmText: 'Pagar' });
    if (!ok) return;
    const paid = this.store.payCardInvoice(this.cardId);
    await this.ui.toast({ title: 'Fatura paga', message: `${this.store.hidden() ? HIDDEN_MASK : money(paid)} debitados de ${this.account()}` });
    void this.modalCtrl.dismiss(true, 'paid');
  }
}
