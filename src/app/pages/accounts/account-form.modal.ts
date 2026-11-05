import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonHeader, IonIcon, IonToggle, ModalController } from '@ionic/angular/standalone';
import { ACCOUNT_COLORS, ACCOUNT_KINDS, accountSubtitle, kindInfo } from '../../core/accounts';
import { AccountKind, CategoryColor } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, money, round2 } from '../../core/utils/format';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';

/** [P] Contas · Nova conta (também usado para editar) */
@Component({
  selector: 'mf-account-form',
  imports: [FormsModule, IonHeader, IonContent, IonIcon, IonToggle, IonButton, CategoryIconComponent, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="cancel()">Cancelar</button>
        <span class="title">{{ accountId ? 'Editar conta' : 'Nova conta' }}</span>
        <button type="button" class="strong" (click)="save()">Salvar</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="mf-modal-body">
        <div class="pad">
          <div class="preview">
            <mf-category-icon [icon]="icon()" [color]="color()" [size]="44" [solid]="true"></mf-category-icon>
            <div class="text"><span class="t-headline ellipsis">{{ name() || 'Nova conta' }}</span><span class="t-footnote c-secondary ellipsis">{{ subtitle() }}</span></div>
            <div class="bal"><span class="t-headline nowrap">{{ previewBalance() }}</span><span class="t-caption1 c-tertiary">Saldo atual</span></div>
          </div>
        </div>

        <div class="pad">
          <label class="t-footnote-sb c-secondary" for="acc-name">Nome da conta</label>
          <span class="field" [class.invalid]="submitted() && !name().trim()">
            <ion-icon name="pencil-outline"></ion-icon>
            <input id="acc-name" type="text" maxlength="40" placeholder="Ex.: Nubank" [ngModel]="name()" (ngModelChange)="name.set($event)" />
          </span>
          @if (submitted() && !name().trim()) { <p class="err">Informe o nome da conta.</p> }
        </div>

        <div class="pad">
          <span class="t-footnote-sb c-secondary">Tipo de conta</span>
          <div class="chips">
            @for (k of kinds; track k.id) {
              <button type="button" class="chip" [class.on]="kind() === k.id" (click)="kind.set(k.id)">{{ k.chip }}</button>
            }
          </div>
        </div>

        <div class="pad">
          <label class="t-footnote-sb c-secondary" for="acc-detail">Instituição ou identificação</label>
          <span class="field">
            <ion-icon name="business-outline"></ion-icon>
            <input id="acc-detail" type="text" maxlength="40" placeholder="Ex.: ag. 0001" [ngModel]="detail()" (ngModelChange)="detail.set($event)" />
          </span>
        </div>

        <div class="pad">
          <mf-currency-input [(value)]="initial" tone="income" [label]="accountId ? 'Saldo atual' : 'Saldo inicial'"></mf-currency-input>
          <label class="neg"><input type="checkbox" [checked]="negative()" (change)="negative.set($any($event.target).checked)" /> Saldo negativo (cheque especial)</label>
        </div>

        <div class="pad">
          <span class="t-footnote-sb c-secondary">Cor identificadora</span>
          <div class="colors">
            @for (c of colors; track c) {
              <button type="button" class="swatch" [class.on]="color() === c" [style.background]="'var(--mf-category-' + c + ')'" [attr.aria-label]="c" (click)="color.set(c)">
                @if (color() === c) { <ion-icon name="checkmark"></ion-icon> }
              </button>
            }
          </div>
        </div>

        <div class="pad">
          <div class="mf-group">
            <div class="mf-row">
              <span class="lead" style="--lead: var(--ion-color-primary)"><ion-icon name="wallet-outline"></ion-icon></span>
              <span class="label grow">Incluir no saldo total<span class="sub">Soma no card Saldo total do Início</span></span>
              <ion-toggle [checked]="include()" (ionChange)="include.set($any($event).detail.checked)" aria-label="Incluir no saldo total"></ion-toggle>
            </div>
            @if (accountId) {
              <div class="mf-row">
                <span class="lead" style="--lead: var(--mf-text-secondary)"><ion-icon name="eye-off-outline"></ion-icon></span>
                <span class="label grow">Conta ativa<span class="sub">Desative contas encerradas sem perder o histórico</span></span>
                <ion-toggle [checked]="active()" (ionChange)="active.set($any($event).detail.checked)" aria-label="Conta ativa"></ion-toggle>
              </div>
            }
          </div>
        </div>

        <div class="pad">
          <ion-button expand="block" (click)="save()">Salvar conta</ion-button>
          @if (accountId) {
            <ion-button expand="block" class="tonal-danger" (click)="remove()"><ion-icon slot="start" name="trash-outline"></ion-icon>Excluir conta</ion-button>
          }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .preview { display: flex; align-items: center; gap: 12px; padding: 16px; background: var(--ion-card-background); border-radius: var(--mf-radius-lg); box-shadow: var(--mf-elevation-sm); }
    .preview .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
    .preview .bal { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
    .field { height: 50px; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-radius: 12px; background: var(--ion-card-background); border: 1px solid var(--ion-border-color); }
    .field.invalid { border: 2px solid var(--ion-color-danger); padding: 0 15px; }
    .field ion-icon { font-size: 20px; color: var(--mf-text-secondary); }
    .field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 17px; color: var(--ion-text-color); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--ion-border-color); background: var(--ion-card-background); font: inherit; font-size: 15px; font-weight: 600; color: var(--ion-text-color); cursor: pointer; }
    .chip.on { background: var(--ion-text-color); color: var(--ion-card-background); border-color: var(--ion-text-color); }
    .colors { display: flex; flex-wrap: wrap; gap: 12px; }
    .swatch { width: 32px; height: 32px; border-radius: 999px; border: 0; cursor: pointer; display: grid; place-items: center; color: #fff; font-size: 18px; }
    .swatch.on { box-shadow: 0 0 0 3px var(--ion-background-color), 0 0 0 5px var(--ion-text-color); }
    .neg { display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--mf-text-secondary); padding: 0 4px; }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: 0; }
  `,
})
export class AccountFormModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  accountId?: string;

  readonly kinds = ACCOUNT_KINDS;
  readonly colors = ACCOUNT_COLORS;
  readonly name = signal('');
  readonly kind = signal<AccountKind>('corrente');
  readonly detail = signal('');
  readonly initial = signal(0);
  readonly negative = signal(false);
  readonly color = signal<CategoryColor>('rendimentos');
  readonly include = signal(true);
  readonly active = signal(true);
  readonly submitted = signal(false);

  readonly icon = computed(() => kindInfo(this.kind()).icon);
  readonly subtitle = computed(() => accountSubtitle({ kind: this.kind(), detail: this.detail().trim() || undefined }));
  readonly signedInitial = computed(() => (this.negative() ? -this.initial() : this.initial()));
  readonly previewBalance = computed(() => (this.store.hidden() ? HIDDEN_MASK : money(this.signedInitial())));

  ngOnInit(): void {
    const a = this.accountId ? this.store.account(this.accountId) : undefined;
    if (!a) return;
    const bal = this.store.balanceOf(a.id);
    this.name.set(a.name);
    this.kind.set(a.kind);
    this.detail.set(a.detail ?? '');
    this.initial.set(Math.abs(bal));
    this.negative.set(bal < 0);
    this.color.set(a.color);
    this.include.set(a.includeInTotal);
    this.active.set(a.active);
  }

  cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (!this.name().trim()) return;
    const base = {
      name: this.name().trim(),
      kind: this.kind(),
      detail: this.detail().trim() || undefined,
      icon: this.icon(),
      color: this.color(),
      includeInTotal: this.include(),
      active: this.active(),
    };
    if (this.accountId) {
      const a = this.store.account(this.accountId)!;
      // ajusta o saldo inicial para que o saldo atual fique igual ao informado
      const diff = round2(this.signedInitial() - this.store.balanceOf(a.id));
      this.store.updateAccount(a.id, { ...base, initialBalance: round2(a.initialBalance + diff) });
      await this.ui.toast({ title: 'Conta atualizada', message: base.name });
    } else {
      this.store.addAccount({ ...base, initialBalance: this.signedInitial() });
      const v = this.store.hidden() ? HIDDEN_MASK : money(this.signedInitial());
      await this.ui.toast({ title: 'Conta criada', message: `${base.name} · saldo inicial ${v}` });
    }
    void this.modalCtrl.dismiss(true, 'save');
  }

  async remove(): Promise<void> {
    const a = this.store.account(this.accountId);
    if (!a) return;
    const count = this.store.transactions().filter((t) => t.accountId === a.id).length;
    const ok = await this.ui.confirm({
      header: 'Excluir conta?',
      message: count
        ? `“${a.name}” e ${count} ${count === 1 ? 'transação vinculada serão removidas' : 'transações vinculadas serão removidas'}. Para manter o histórico, desative a conta.`
        : `“${a.name}” será removida.`,
      confirmText: 'Excluir',
      destructive: true,
    });
    if (!ok) return;
    this.store.deleteAccount(a.id);
    await this.ui.toast({ title: 'Conta excluída', message: a.name, tone: 'danger' });
    void this.modalCtrl.dismiss(true, 'delete');
  }
}
