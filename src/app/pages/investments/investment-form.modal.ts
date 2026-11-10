import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonDatetime, IonHeader, IonIcon, IonModal, ModalController } from '@ionic/angular/standalone';
import { CategoryColor } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { fromDateInput, shortDate, toDateInput } from '../../core/utils/format';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';

export const INVESTMENT_STYLES: { icon: string; color: CategoryColor }[] = [
  { icon: 'trending-up-outline', color: 'rendimentos' },
  { icon: 'heart-outline', color: 'lazer' },
  { icon: 'shield-checkmark-outline', color: 'salario' },
  { icon: 'business-outline', color: 'educacao' },
  { icon: 'diamond-outline', color: 'assinaturas' },
  { icon: 'rocket-outline', color: 'transporte' },
];

/** Novo investimento / Editar investimento */
@Component({
  selector: 'mf-investment-form',
  imports: [FormsModule, IonHeader, IonContent, IonIcon, IonButton, IonModal, IonDatetime, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="cancel()">Cancelar</button>
        <span class="title">{{ investmentId ? 'Editar investimento' : 'Novo investimento' }}</span>
        <button type="button" class="strong" (click)="save()">Salvar</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="mf-modal-body">
        <div class="pad">
          <div class="mf-group">
            <label class="mf-row no-lead" [class.invalid]="submitted() && !name().trim()"><span class="label">Nome</span><input class="value" maxlength="40" placeholder="Ex.: Meu investimento" [ngModel]="name()" (ngModelChange)="name.set($event)" /></label>
            <label class="mf-row no-lead"><span class="label">Onde está</span><input class="value" maxlength="30" placeholder="Ex.: Nubank, XP (opcional)" [ngModel]="institution()" (ngModelChange)="institution.set($event)" /></label>
          </div>
        </div>
        <div class="pad">
          <span class="t-footnote-sb c-secondary">De quem é o dinheiro</span>
          <div class="chips">
            <button type="button" class="chip" [class.on]="mine()" (click)="mine.set(true)">Meu</button>
            <button type="button" class="chip" [class.on]="!mine()" (click)="mine.set(false)">De outra pessoa</button>
          </div>
          <p class="t-caption1 c-secondary hint">{{ mine() ? 'Entra no seu patrimônio.' : 'Aparece separado e não entra no seu patrimônio.' }}</p>
        </div>
        <div class="pad">
          <span class="t-footnote-sb c-secondary">Ícone</span>
          <div class="styles">
            @for (s of styles; track s.icon) {
              <button type="button" class="sty" [class.on]="icon() === s.icon" [style.--c]="'var(--mf-category-' + s.color + ')'" (click)="pickStyle(s.icon, s.color)" [attr.aria-label]="s.icon">
                <ion-icon [name]="s.icon"></ion-icon>
              </button>
            }
          </div>
        </div>
        <div class="pad">
          <mf-currency-input [(value)]="initial" tone="income" [label]="investmentId ? 'Saldo inicial' : 'Saldo'"></mf-currency-input>
          <p class="t-caption1 c-secondary hint">
            @if (investmentId) { Valor de partida do extrato. Para corrigir o saldo de hoje, use "Atualizar saldo". }
            @else { Quanto tinha nesta data. Depois você registra resgates, aportes e rendimentos. }
          </p>
          <div class="mf-group">
            <button class="mf-row no-lead" type="button" (click)="dateOpen.set(true)"><span class="label">Data do saldo</span><span class="value">{{ dateLabel() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon></button>
          </div>
          @if (submitted() && error()) { <p class="err">{{ error() }}</p> }
        </div>
        <div class="pad">
          <ion-button expand="block" (click)="save()">Salvar investimento</ion-button>
          @if (investmentId) { <ion-button expand="block" class="tonal-danger" (click)="remove()"><ion-icon slot="start" name="trash-outline"></ion-icon>Excluir investimento</ion-button> }
        </div>
      </div>
      <ion-modal [isOpen]="dateOpen()" (didDismiss)="dateOpen.set(false)" [breakpoints]="[0, 0.62]" [initialBreakpoint]="0.62" class="mf-sheet">
        <ng-template>
          <div class="sheet">
            <div class="mf-modal-toolbar"><span></span><span class="title">Data do saldo</span><button type="button" class="strong" (click)="dateOpen.set(false)">OK</button></div>
            <ion-datetime presentation="date" locale="pt-BR" [value]="date()" [max]="today" (ionChange)="onDate($any($event).detail.value)"></ion-datetime>
          </div>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip { height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--ion-border-color); background: var(--ion-card-background); font: inherit; font-size: 15px; font-weight: 600; color: var(--ion-text-color); cursor: pointer; }
    .chip.on { background: var(--ion-text-color); color: var(--ion-card-background); border-color: var(--ion-text-color); }
    .hint { margin: 0; }
    .styles { display: flex; flex-wrap: wrap; gap: 10px; }
    .sty { position: relative; isolation: isolate; width: 44px; height: 44px; border-radius: 12px; border: 2px solid transparent; background: none; color: var(--c); font-size: 20px; display: grid; place-items: center; cursor: pointer; }
    .sty::before { content: ''; position: absolute; inset: 0; border-radius: 10px; background: var(--c); opacity: 0.14; z-index: -1; }
    .sty.on { border-color: var(--c); }
    .mf-row.invalid .label { color: var(--ion-color-danger); }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: 0; }
    .sheet { padding: 8px 0 24px; background: var(--ion-background-color); }
    ion-datetime { margin: 0 auto; --background: var(--ion-background-color); }
  `,
})
export class InvestmentFormModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  investmentId?: string;
  readonly styles = INVESTMENT_STYLES;
  readonly today = toDateInput(new Date().toISOString());
  readonly name = signal('');
  readonly institution = signal('');
  readonly mine = signal(true);
  readonly icon = signal(INVESTMENT_STYLES[0].icon);
  readonly color = signal<CategoryColor>(INVESTMENT_STYLES[0].color);
  readonly initial = signal(0);
  readonly date = signal(new Date().toISOString());
  readonly dateOpen = signal(false);
  readonly submitted = signal(false);
  readonly dateLabel = computed(() => shortDate(this.date()));

  ngOnInit(): void {
    const i = this.store.investment(this.investmentId);
    if (i) {
      this.name.set(i.name); this.institution.set(i.institution ?? ''); this.mine.set(i.mine);
      this.icon.set(i.icon); this.color.set(i.color); this.initial.set(i.initialAmount); this.date.set(i.initialDate);
    }
  }

  error(): string {
    if (!this.name().trim()) return 'Dê um nome para o investimento.';
    if (this.initial() < 0) return 'O saldo não pode ser negativo.';
    return '';
  }

  pickStyle(icon: string, color: CategoryColor): void {
    this.icon.set(icon);
    this.color.set(color);
  }

  onDate(v: string | string[] | null | undefined): void {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) this.date.set(fromDateInput(s.slice(0, 10), this.date()));
  }

  cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (this.error()) return;
    const data = {
      name: this.name().trim(), institution: this.institution().trim() || undefined, mine: this.mine(),
      icon: this.icon(), color: this.color(), initialAmount: this.initial(), initialDate: this.date(),
    };
    if (this.investmentId) {
      this.store.updateInvestment(this.investmentId, data);
      await this.ui.toast({ title: 'Investimento atualizado' });
      void this.modalCtrl.dismiss(this.investmentId, 'save');
    } else {
      const inv = this.store.addInvestment(data);
      await this.ui.toast({ title: 'Investimento criado', message: inv.name });
      void this.modalCtrl.dismiss(inv.id, 'save');
    }
  }

  async remove(): Promise<void> {
    if (!this.investmentId) return;
    const ok = await this.ui.confirm({ header: 'Excluir investimento?', message: 'O extrato dele também será apagado.', confirmText: 'Excluir', destructive: true });
    if (!ok) return;
    this.store.deleteInvestment(this.investmentId);
    void this.modalCtrl.dismiss(null, 'delete');
  }
}

export async function openInvestmentForm(modal: ModalController, investmentId?: string): Promise<{ id?: string; role?: string }> {
  const m = await modal.create({ component: InvestmentFormModal, componentProps: { investmentId }, cssClass: 'mf-card-modal' });
  await m.present();
  const { data, role } = await m.onWillDismiss<string>();
  return { id: data ?? undefined, role };
}
