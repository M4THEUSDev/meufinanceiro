import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonHeader, IonIcon, ModalController } from '@ionic/angular/standalone';
import { CreditCard } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';
import { openPicker } from '../../shared/components/picker.modal';
import { CARD_THEMES, CardVisualComponent } from './card-visual.component';

/** Novo cartão / Editar cartão */
@Component({
  selector: 'mf-card-form',
  imports: [FormsModule, IonHeader, IonContent, IonIcon, IonButton, CurrencyInputComponent, CardVisualComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="cancel()">Cancelar</button>
        <span class="title">{{ cardId ? 'Editar cartão' : 'Novo cartão' }}</span>
        <button type="button" class="strong" (click)="save()">Salvar</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="mf-modal-body">
        <div class="pad"><mf-card-visual [card]="preview()"></mf-card-visual></div>
        <div class="pad">
          <div class="mf-group">
            <label class="mf-row no-lead"><span class="label">Apelido</span><input class="value" maxlength="30" placeholder="Cartão Platinum" [ngModel]="name()" (ngModelChange)="name.set($event)" /></label>
            <label class="mf-row no-lead"><span class="label">Banco</span><input class="value" maxlength="24" placeholder="Banco Digital" [ngModel]="bank()" (ngModelChange)="bank.set($event)" /></label>
            <label class="mf-row no-lead"><span class="label">Categoria</span><input class="value" maxlength="16" placeholder="Platinum" [ngModel]="tier()" (ngModelChange)="tier.set($event)" /></label>
            <label class="mf-row no-lead"><span class="label">Final</span><input class="value" inputmode="numeric" maxlength="4" placeholder="0000" [ngModel]="last4()" (ngModelChange)="setLast4($event)" /></label>
            <button class="mf-row no-lead" type="button" (click)="pickBrand()"><span class="label">Bandeira</span><span class="value">{{ brand() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon></button>
          </div>
          @if (submitted() && error()) { <p class="err">{{ error() }}</p> }
        </div>
        <div class="pad"><mf-currency-input [(value)]="limit" tone="neutral" label="Limite total (opcional)" hint="Deixe 0,00 se não quiser acompanhar o limite"></mf-currency-input></div>
        <div class="pad"><mf-currency-input [(value)]="spend" tone="expense" label="Compras novas previstas por mês" hint="Além das parcelas — usado na previsão dos próximos meses"></mf-currency-input></div>
        <div class="pad">
          <div class="mf-group">
            <label class="mf-row no-lead"><span class="label">Dia de fechamento</span><input class="value" type="number" min="1" max="28" [ngModel]="closingDay()" (ngModelChange)="closingDay.set(+$event)" /></label>
            <label class="mf-row no-lead"><span class="label">Dia de vencimento</span><input class="value" type="number" min="1" max="28" [ngModel]="dueDay()" (ngModelChange)="dueDay.set(+$event)" /></label>
            <button class="mf-row no-lead" type="button" (click)="pickAccount()"><span class="label">Pagar fatura com</span><span class="value">{{ accountName() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon></button>
          </div>
        </div>
        <div class="pad">
          <span class="t-footnote-sb c-secondary">Cor do cartão</span>
          <div class="themes">
            @for (t of themes; track t) {
              <button type="button" class="th" [class.on]="theme() === t" [style.background]="bgs[t]" (click)="theme.set(t)" [attr.aria-label]="t"></button>
            }
          </div>
        </div>
        <div class="pad">
          <ion-button expand="block" (click)="save()">Salvar cartão</ion-button>
          @if (cardId) { <ion-button expand="block" class="tonal-danger" (click)="remove()"><ion-icon slot="start" name="trash-outline"></ion-icon>Excluir cartão</ion-button> }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .themes { display: flex; gap: 12px; }
    .th { width: 56px; height: 36px; border-radius: 8px; border: 0; cursor: pointer; }
    .th.on { box-shadow: 0 0 0 3px var(--ion-background-color), 0 0 0 5px var(--ion-text-color); }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: 0; }
  `,
})
export class CardFormModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  cardId?: string;
  readonly themes = Object.keys(CARD_THEMES) as CreditCard['theme'][];
  readonly bgs = CARD_THEMES;
  readonly name = signal('');
  readonly bank = signal('');
  readonly tier = signal('');
  readonly last4 = signal('');
  readonly brand = signal<CreditCard['brand']>('Mastercard');
  readonly limit = signal(0);
  readonly spend = signal(0);
  readonly closingDay = signal(3);
  readonly dueDay = signal(10);
  readonly theme = signal<CreditCard['theme']>('platinum');
  readonly accountId = signal<string>('');
  readonly submitted = signal(false);

  preview(): CreditCard {
    return {
      id: 'preview', name: this.name(), bank: this.bank() || 'Banco', tier: this.tier() || 'Cartão', brand: this.brand(),
      last4: (this.last4() || '0000').padStart(4, '0'), limit: this.limit(), monthlySpendEstimate: this.spend() || undefined, closingDay: this.closingDay(), dueDay: this.dueDay(), theme: this.theme(), accountId: this.accountId(),
    };
  }
  setLast4(v: string): void {
    this.last4.set(String(v ?? '').replace(/\D/g, '').slice(0, 4));
  }
  accountName(): string {
    return this.store.account(this.accountId())?.name ?? 'Selecionar';
  }
  error(): string {
    if (!this.name().trim()) return 'Informe um apelido para o cartão.';
    if (!/^\d{4}$/.test(this.last4())) return 'Informe os 4 últimos dígitos.';
    if (!(this.closingDay() >= 1 && this.closingDay() <= 28 && this.dueDay() >= 1 && this.dueDay() <= 28)) return 'Use dias entre 1 e 28.';
    if (!this.accountId()) return 'Selecione a conta que paga a fatura.';
    return '';
  }

  ngOnInit(): void {
    const c = this.store.card(this.cardId);
    if (c) {
      this.name.set(c.name); this.bank.set(c.bank); this.tier.set(c.tier); this.last4.set(c.last4); this.brand.set(c.brand);
      this.limit.set(c.limit); this.spend.set(c.monthlySpendEstimate ?? 0); this.closingDay.set(c.closingDay); this.dueDay.set(c.dueDay); this.theme.set(c.theme); this.accountId.set(c.accountId);
    } else {
      this.accountId.set(this.store.activeAccounts().find((a) => a.kind === 'corrente' || a.kind === 'digital')?.id ?? '');
    }
  }

  async pickBrand(): Promise<void> {
    const id = await openPicker(this.modalCtrl, { title: 'Bandeira', selected: this.brand(), options: ['Mastercard', 'Visa', 'Elo', 'Amex'].map((b) => ({ id: b, label: b })) });
    if (id) this.brand.set(id as CreditCard['brand']);
  }

  async pickAccount(): Promise<void> {
    const id = await openPicker(this.modalCtrl, { title: 'Pagar fatura com', selected: this.accountId(), options: this.store.activeAccounts().map((a) => ({ id: a.id, label: a.name, icon: a.icon, color: a.color })) });
    if (id) this.accountId.set(id);
  }

  cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (this.error()) return;
    const { id, ...data } = this.preview();
    data.name = this.name().trim();
    if (this.cardId) {
      this.store.updateCard(this.cardId, data);
      await this.ui.toast({ title: 'Cartão atualizado', message: data.name });
    } else {
      this.store.addCard(data);
      await this.ui.toast({ title: 'Cartão adicionado', message: `${data.name} · final ${data.last4}` });
    }
    void this.modalCtrl.dismiss(true, 'save');
  }

  async remove(): Promise<void> {
    const c = this.store.card(this.cardId);
    if (!c) return;
    const ok = await this.ui.confirm({ header: 'Excluir cartão?', message: `As compras de “${c.name}” serão mantidas como despesas da conta ${this.accountName()}.`, confirmText: 'Excluir', destructive: true });
    if (!ok) return;
    this.store.deleteCard(c.id);
    void this.modalCtrl.dismiss(true, 'delete');
  }
}
