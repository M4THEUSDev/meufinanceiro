import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonHeader, IonIcon, ModalController } from '@ionic/angular/standalone';
import { DebtKind } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, money, round2 } from '../../core/utils/format';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';
import { openPicker } from '../../shared/components/picker.modal';

export const DEBT_KINDS: { id: DebtKind; label: string; icon: string }[] = [
  { id: 'emprestimo', label: 'Empréstimo', icon: 'cash-outline' },
  { id: 'financiamento', label: 'Financiamento', icon: 'car-outline' },
  { id: 'consignado', label: 'Consignado', icon: 'briefcase-outline' },
  { id: 'cheque_especial', label: 'Cheque especial', icon: 'alert-circle-outline' },
  { id: 'outro', label: 'Outra dívida', icon: 'document-text-outline' },
];

/** Nova dívida / Editar dívida (empréstimos, financiamentos e afins) */
@Component({
  selector: 'mf-debt-form',
  imports: [FormsModule, IonHeader, IonContent, IonIcon, IonButton, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="cancel()">Cancelar</button>
        <span class="title">{{ debtId ? 'Editar dívida' : 'Nova dívida' }}</span>
        <button type="button" class="strong" (click)="save()">Salvar</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="mf-modal-body">
        <div class="pad">
          <span class="t-footnote-sb c-secondary">Tipo</span>
          <div class="chips">
            @for (k of kinds; track k.id) {
              <button type="button" class="chip" [class.on]="kind() === k.id" (click)="kind.set(k.id)">{{ k.label }}</button>
            }
          </div>
        </div>
        <div class="pad">
          <div class="mf-group">
            <label class="mf-row no-lead" [class.invalid]="submitted() && !name().trim()"><span class="label">Nome</span><input class="value" maxlength="40" placeholder="Ex.: Financiamento do carro" [ngModel]="name()" (ngModelChange)="name.set($event)" /></label>
            <label class="mf-row no-lead"><span class="label">Credor</span><input class="value" maxlength="30" placeholder="Ex.: Santander" [ngModel]="creditor()" (ngModelChange)="creditor.set($event)" /></label>
          </div>
        </div>
        <div class="pad"><mf-currency-input [(value)]="installment" tone="expense" label="Valor da parcela"></mf-currency-input></div>
        <div class="pad">
          <div class="mf-group">
            <label class="mf-row no-lead"><span class="label">Total de parcelas</span><input class="value" type="number" inputmode="numeric" min="1" max="600" [ngModel]="total()" (ngModelChange)="total.set(+$event || 0)" /></label>
            <label class="mf-row no-lead"><span class="label">Parcelas já pagas</span><input class="value" type="number" inputmode="numeric" min="0" [ngModel]="paid()" (ngModelChange)="paid.set(+$event || 0)" /></label>
            <label class="mf-row no-lead"><span class="label">Dia do vencimento</span><input class="value" type="number" inputmode="numeric" min="1" max="31" [ngModel]="dueDay()" (ngModelChange)="dueDay.set(+$event || 0)" /></label>
            <label class="mf-row no-lead"><span class="label">Juros ao mês (%)</span><input class="value" type="text" inputmode="decimal" placeholder="Opcional" [ngModel]="rate()" (ngModelChange)="rate.set($event)" /></label>
            <button class="mf-row no-lead" type="button" (click)="pickAccount()"><span class="label">Pagar com</span><span class="value">{{ accountName() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon></button>
          </div>
          @if (submitted() && error()) { <p class="err">{{ error() }}</p> }
        </div>
        @if (installment() > 0 && total() > 0) {
          <div class="pad">
            <div class="mf-card resume">
              <div><span class="t-caption1 c-secondary">Saldo devedor</span><span class="t-headline c-danger">{{ fmt(remaining()) }}</span></div>
              <div><span class="t-caption1 c-secondary">Faltam</span><span class="t-headline">{{ left() }} {{ left() === 1 ? 'parcela' : 'parcelas' }}</span></div>
            </div>
          </div>
        }
        <div class="pad">
          <ion-button expand="block" (click)="save()">Salvar dívida</ion-button>
          @if (debtId) { <ion-button expand="block" class="tonal-danger" (click)="remove()"><ion-icon slot="start" name="trash-outline"></ion-icon>Excluir dívida</ion-button> }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--ion-border-color); background: var(--ion-card-background); font: inherit; font-size: 15px; font-weight: 600; color: var(--ion-text-color); cursor: pointer; }
    .chip.on { background: var(--ion-text-color); color: var(--ion-card-background); border-color: var(--ion-text-color); }
    .mf-row.invalid .label { color: var(--ion-color-danger); }
    .resume { display: flex; gap: 12px; > div { flex: 1; display: flex; flex-direction: column; } }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: 0; }
  `,
})
export class DebtFormModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  debtId?: string;
  readonly kinds = DEBT_KINDS;
  readonly kind = signal<DebtKind>('emprestimo');
  readonly name = signal('');
  readonly creditor = signal('');
  readonly installment = signal(0);
  readonly total = signal(12);
  readonly paid = signal(0);
  readonly dueDay = signal(10);
  readonly rate = signal('');
  readonly accountId = signal('');
  readonly submitted = signal(false);

  readonly left = computed(() => Math.max(0, this.total() - this.paid()));
  readonly remaining = computed(() => round2(this.left() * this.installment()));
  readonly accountName = computed(() => this.store.account(this.accountId())?.name ?? 'Selecionar');

  error(): string {
    if (!this.name().trim()) return 'Dê um nome para a dívida.';
    if (this.installment() <= 0) return 'Informe o valor da parcela.';
    if (this.total() < 1) return 'Informe o total de parcelas.';
    if (this.paid() < 0 || this.paid() > this.total()) return 'Parcelas pagas deve ficar entre 0 e o total.';
    if (this.dueDay() < 1 || this.dueDay() > 31) return 'Use um dia entre 1 e 31.';
    if (!this.accountId()) return 'Selecione a conta de pagamento.';
    return '';
  }

  ngOnInit(): void {
    const d = this.store.debt(this.debtId);
    if (d) {
      this.kind.set(d.kind); this.name.set(d.name); this.creditor.set(d.creditor); this.installment.set(d.installmentAmount);
      this.total.set(d.totalInstallments); this.paid.set(d.paidInstallments); this.dueDay.set(d.dueDay);
      this.rate.set(d.monthlyRate ? String(d.monthlyRate).replace('.', ',') : ''); this.accountId.set(d.accountId);
    } else {
      this.accountId.set(this.store.activeAccounts().find((a) => a.kind === 'corrente' || a.kind === 'digital')?.id ?? this.store.activeAccounts()[0]?.id ?? '');
    }
  }

  fmt(v: number): string {
    return this.store.hidden() ? HIDDEN_MASK : money(v);
  }

  async pickAccount(): Promise<void> {
    const id = await openPicker(this.modalCtrl, { title: 'Pagar com', selected: this.accountId(), options: this.store.activeAccounts().map((a) => ({ id: a.id, label: a.name, icon: a.icon, color: a.color })) });
    if (id) this.accountId.set(id);
  }

  cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (this.error()) return;
    const rate = Number(this.rate().replace(',', '.'));
    const data = {
      kind: this.kind(), name: this.name().trim(), creditor: this.creditor().trim(), installmentAmount: this.installment(),
      totalInstallments: Math.round(this.total()), paidInstallments: Math.round(this.paid()), dueDay: Math.round(this.dueDay()),
      accountId: this.accountId(), monthlyRate: Number.isFinite(rate) && rate > 0 ? rate : undefined,
    };
    if (this.debtId) {
      this.store.updateDebt(this.debtId, data);
      await this.ui.toast({ title: 'Dívida atualizada', message: data.name });
    } else {
      this.store.addDebt(data);
      await this.ui.toast({ title: 'Dívida adicionada', message: `${data.name} · saldo devedor ${this.fmt(this.remaining())}` });
    }
    void this.modalCtrl.dismiss(true, 'save');
  }

  async remove(): Promise<void> {
    const d = this.store.debt(this.debtId);
    if (!d) return;
    const ok = await this.ui.confirm({ header: 'Excluir dívida?', message: `“${d.name}” deixará de ser acompanhada. Os pagamentos já lançados continuam nas transações.`, confirmText: 'Excluir', destructive: true });
    if (!ok) return;
    this.store.deleteDebt(d.id);
    void this.modalCtrl.dismiss(true, 'delete');
  }
}
