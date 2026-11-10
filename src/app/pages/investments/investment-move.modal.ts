import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonDatetime, IonIcon, IonModal, ModalController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, daysBetween, fromDateInput, money, round2, shortDate, toDateInput } from '../../core/utils/format';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';

export type MoveMode = 'resgate' | 'aporte' | 'saldo';

/** Registrar resgate, aporte ou atualizar o saldo de um investimento (bottom sheet) */
@Component({
  selector: 'mf-investment-move',
  imports: [FormsModule, IonContent, IonIcon, IonButton, IonModal, IonDatetime, CategoryIconComponent, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content>
      @if (inv(); as i) {
        <div class="body">
          <div class="head">
            <mf-category-icon [icon]="i.icon" [color]="i.color" [size]="40"></mf-category-icon>
            <div class="grow"><p class="t-footnote c-secondary">Saldo atual {{ fmt(balance()) }}</p><p class="t-headline">{{ i.name }}</p></div>
            <button class="mf-reset close" type="button" aria-label="Fechar" (click)="close()"><ion-icon name="close"></ion-icon></button>
          </div>
          <div class="seg">
            <button type="button" [class.on]="mode() === 'resgate'" (click)="setMode('resgate')">Resgate</button>
            <button type="button" [class.on]="mode() === 'aporte'" (click)="setMode('aporte')">Aporte</button>
            <button type="button" [class.on]="mode() === 'saldo'" (click)="setMode('saldo')">Atualizar saldo</button>
          </div>
          <mf-currency-input [(value)]="amount" [tone]="mode() === 'resgate' ? 'expense' : 'income'" [label]="amountLabel()"></mf-currency-input>
          <div class="mf-group">
            <button class="mf-row no-lead" type="button" (click)="dateOpen.set(true)"><span class="label">Data</span><span class="value">{{ dateLabel() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon></button>
            @if (mode() !== 'saldo') {
              <label class="mf-row no-lead"><span class="label">Observação</span><input class="value" maxlength="40" placeholder="Opcional" [ngModel]="note()" (ngModelChange)="note.set($event)" /></label>
            }
          </div>
          @if (preview()) { <p class="after t-footnote c-secondary"><ion-icon name="information-circle-outline"></ion-icon>{{ preview() }}</p> }
          @if (submitted() && error()) { <p class="err">{{ error() }}</p> }
          <ion-button expand="block" (click)="save()">{{ mode() === 'saldo' ? 'Atualizar saldo' : 'Registrar ' + mode() }}</ion-button>
        </div>
      }
      <ion-modal [isOpen]="dateOpen()" (didDismiss)="dateOpen.set(false)" [breakpoints]="[0, 0.62]" [initialBreakpoint]="0.62" class="mf-sheet">
        <ng-template>
          <div class="sheet">
            <div class="mf-modal-toolbar"><span></span><span class="title">Data</span><button type="button" class="strong" (click)="dateOpen.set(false)">OK</button></div>
            <ion-datetime presentation="date" locale="pt-BR" [value]="date()" [max]="today" (ionChange)="onDate($any($event).detail.value)"></ion-datetime>
          </div>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    ion-content { --background: var(--ion-background-color); }
    .body { padding: 20px 16px 32px; display: flex; flex-direction: column; gap: 16px; }
    .head { display: flex; align-items: center; gap: 12px; }
    .head p { margin: 0; }
    .grow { flex: 1; min-width: 0; }
    .close { width: 30px; height: 30px; border-radius: 999px; background: var(--ion-color-step-50); display: grid; place-items: center; color: var(--mf-text-secondary); font-size: 18px; }
    .seg { display: flex; padding: 2px; border-radius: 9px; background: var(--ion-color-step-50); }
    .seg button { flex: 1; height: 32px; border: 0; border-radius: 7px; background: none; font: inherit; font-size: 13px; font-weight: 600; color: var(--ion-text-color); cursor: pointer; }
    .seg button.on { background: var(--ion-card-background); box-shadow: var(--mf-elevation-sm); }
    .after { display: flex; align-items: center; gap: 6px; margin: 0; }
    .after ion-icon { font-size: 16px; flex: 0 0 auto; }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: 0; }
    .sheet { padding: 8px 0 24px; background: var(--ion-background-color); }
    ion-datetime { margin: 0 auto; --background: var(--ion-background-color); }
  `,
})
export class InvestmentMoveModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  investmentId!: string;
  initialMode: MoveMode = 'resgate';
  readonly today = toDateInput(new Date().toISOString());
  readonly mode = signal<MoveMode | null>(null);
  readonly amount = signal(0);
  readonly note = signal('');
  readonly date = signal(new Date().toISOString());
  readonly dateOpen = signal(false);
  readonly submitted = signal(false);

  readonly inv = computed(() => this.store.investment(this.investmentId));
  readonly balance = computed(() => (this.inv() ? this.store.investmentBalance(this.inv()!) : 0));
  readonly dateLabel = computed(() => `${daysBetween(new Date(this.date()), new Date()) === 0 ? 'Hoje, ' : ''}${shortDate(this.date())}`);
  readonly amountLabel = computed(() => ({ resgate: 'Valor retirado', aporte: 'Valor aplicado', saldo: 'Saldo de hoje no banco' })[this.mode() ?? 'resgate']);
  readonly preview = computed(() => {
    const v = this.amount();
    if (v <= 0) return '';
    if (this.mode() === 'saldo') {
      const diff = round2(v - this.balance());
      if (!diff) return 'O saldo já está igual.';
      return `${diff > 0 ? 'Rendeu' : 'Desvalorizou'} ${this.fmt(Math.abs(diff))} desde o último registro.`;
    }
    const after = round2(this.balance() + (this.mode() === 'resgate' ? -v : v));
    return `Saldo depois: ${this.fmt(after)}`;
  });

  ngOnInit(): void {
    this.setMode(this.initialMode);
  }

  /** "Atualizar saldo" começa com o saldo atual; resgate/aporte começam vazios */
  setMode(m: MoveMode): void {
    if (m === this.mode() && this.amount()) return;
    this.mode.set(m);
    this.amount.set(m === 'saldo' ? this.balance() : 0);
    this.submitted.set(false);
  }

  fmt(v: number): string {
    return this.store.hidden() ? HIDDEN_MASK : money(v);
  }

  error(): string {
    if (this.mode() === 'saldo') return this.amount() < 0 ? 'O saldo não pode ser negativo.' : '';
    if (this.amount() <= 0) return 'Informe um valor maior que zero.';
    if (this.mode() === 'resgate' && this.amount() > this.balance() + 0.001) return 'O resgate é maior que o saldo do investimento.';
    return '';
  }

  onDate(v: string | string[] | null | undefined): void {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) this.date.set(fromDateInput(s.slice(0, 10), this.date()));
  }

  close(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    const i = this.inv();
    if (!i || this.error()) return;
    if (this.mode() === 'saldo') {
      const m = this.store.setInvestmentBalance(i.id, this.amount(), this.date());
      await this.ui.toast({ title: 'Saldo atualizado', message: m ? `${m.amount > 0 ? 'Rendimento' : 'Desvalorização'} de ${this.fmt(Math.abs(m.amount))}` : 'Nada mudou.' });
    } else {
      const type = this.mode() === 'aporte' ? 'aporte' : 'resgate';
      this.store.addInvestmentMove(i.id, { type, amount: this.amount(), date: this.date(), note: this.note().trim() || undefined });
      await this.ui.toast({ title: type === 'resgate' ? 'Resgate registrado' : 'Aporte registrado', message: `${this.fmt(this.amount())} em ${i.name}` });
    }
    void this.modalCtrl.dismiss(true, 'save');
  }
}

export async function openInvestmentMove(modal: ModalController, investmentId: string, initialMode: MoveMode = 'resgate'): Promise<boolean> {
  const m = await modal.create({ component: InvestmentMoveModal, componentProps: { investmentId, initialMode }, breakpoints: [0, 0.7, 1], initialBreakpoint: 0.7, cssClass: 'mf-sheet', handle: true });
  await m.present();
  const { role } = await m.onWillDismiss();
  return role === 'save';
}
