import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonHeader, IonIcon, IonSegment, IonSegmentButton, IonToggle, ModalController } from '@ionic/angular/standalone';
import { TxType } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { catColor } from '../../core/icons';
import { HIDDEN_MASK, addMonths, money, monthKey, monthLabel } from '../../core/utils/format';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';
import { openPicker } from '../../shared/components/picker.modal';

/** Nova / Editar conta fixa ou receita recorrente */
@Component({
  selector: 'mf-recurring-form',
  imports: [FormsModule, IonHeader, IonContent, IonIcon, IonButton, IonSegment, IonSegmentButton, IonToggle, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="cancel()">Cancelar</button>
        <span class="title">{{ ruleId ? 'Editar recorrência' : type() === 'income' ? 'Receita recorrente' : 'Conta fixa' }}</span>
        <button type="button" class="strong" (click)="save()">Salvar</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="mf-modal-body">
        <div class="pad">
          <ion-segment mode="ios" [value]="type()" (ionChange)="setType($any($event).detail.value)">
            <ion-segment-button value="expense">Conta a pagar</ion-segment-button>
            <ion-segment-button value="income">Receita</ion-segment-button>
          </ion-segment>
          <mf-currency-input [(value)]="amount" [tone]="type()" [label]="type() === 'income' ? 'Valor previsto por mês' : 'Valor por mês'"
            hint="Pode ajustar o valor de cada mês depois"></mf-currency-input>
        </div>
        <div class="pad">
          <div class="mf-group">
            <label class="mf-row" [class.invalid]="submitted() && !description().trim()">
              <span class="lead" style="--lead: var(--mf-text-secondary)"><ion-icon name="document-text-outline"></ion-icon></span>
              <span class="label">Descrição</span>
              <input class="value" maxlength="60" [placeholder]="type() === 'income' ? 'Ex.: Salário' : 'Ex.: Claro'" [ngModel]="description()" (ngModelChange)="description.set($event)" />
            </label>
            <button class="mf-row" type="button" (click)="pickCategory()">
              <span class="lead" [style.--lead]="category() ? color(category()!.color) : 'var(--mf-text-tertiary)'"><ion-icon name="pricetag-outline"></ion-icon></span>
              <span class="label">Categoria</span><span class="value">{{ category()?.name ?? 'Selecionar' }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
            </button>
            <button class="mf-row" type="button" (click)="pickAccount()">
              <span class="lead" style="--lead: var(--mf-category-educacao)"><ion-icon [name]="cardId() ? 'card-outline' : 'wallet-outline'"></ion-icon></span>
              <span class="label">{{ type() === 'income' ? 'Receber em' : 'Pagar com' }}</span><span class="value">{{ sourceName() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
            </button>
            <label class="mf-row">
              <span class="lead" style="--lead: var(--mf-category-transporte)"><ion-icon name="calendar-outline"></ion-icon></span>
              <span class="label grow">Dia do mês<span class="sub">{{ type() === 'income' ? 'Dia aproximado em que costuma cair' : 'Dia do vencimento' }}</span></span>
              <input class="value day" type="number" inputmode="numeric" min="1" max="31" [ngModel]="day()" (ngModelChange)="day.set(+$event || 0)" />
            </label>
            <div class="mf-row">
              <span class="lead" style="--lead: var(--mf-category-moradia)"><ion-icon name="repeat-outline"></ion-icon></span>
              <span class="label grow">Tem data para acabar?</span>
              <ion-toggle [checked]="hasEnd()" (ionChange)="hasEnd.set($any($event).detail.checked)" aria-label="Tem data para acabar"></ion-toggle>
            </div>
            @if (hasEnd()) {
              <button class="mf-row" type="button" (click)="pickEnd()">
                <span class="lead" style="--lead: var(--mf-category-moradia)"><ion-icon name="flag-outline"></ion-icon></span>
                <span class="label">Último mês</span><span class="value">{{ endLabel() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
              </button>
            }
            @if (ruleId) {
              <div class="mf-row">
                <span class="lead" style="--lead: var(--ion-color-success)"><ion-icon name="checkmark-circle-outline"></ion-icon></span>
                <span class="label grow">Ativa<span class="sub">Desative para parar de gerar nos próximos meses</span></span>
                <ion-toggle [checked]="active()" (ionChange)="active.set($any($event).detail.checked)" aria-label="Ativa"></ion-toggle>
              </div>
            }
          </div>
          @if (submitted() && error()) { <p class="err">{{ error() }}</p> }
          <p class="note t-footnote c-secondary">Todo mês o app cria este lançamento como <b>pendente</b>. Quando pagar (ou receber), toque nele e marque como pago — ou ajuste o valor daquele mês.</p>
        </div>
        <div class="pad">
          <ion-button expand="block" (click)="save()">Salvar</ion-button>
          @if (ruleId) { <ion-button expand="block" class="tonal-danger" (click)="remove()"><ion-icon slot="start" name="trash-outline"></ion-icon>Excluir recorrência</ion-button> }
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .day { max-width: 64px; }
    .mf-row.invalid .label { color: var(--ion-color-danger); }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: 0; }
    .note { margin: 0; padding: 0 4px; }
  `,
})
export class RecurringFormModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  ruleId?: string;
  presetType?: TxType;

  readonly type = signal<TxType>('expense');
  readonly amount = signal(0);
  readonly description = signal('');
  readonly categoryId = signal<string | null>(null);
  readonly accountId = signal<string>('');
  readonly cardId = signal<string | null>(null);
  readonly day = signal(new Date().getDate());
  readonly hasEnd = signal(false);
  readonly endMonth = signal(addMonths(monthKey(new Date()), 11));
  readonly active = signal(true);
  readonly submitted = signal(false);

  readonly category = computed(() => this.store.category(this.categoryId() ?? undefined));
  readonly sourceName = computed(() => (this.cardId() ? this.store.card(this.cardId()!)?.name : this.store.account(this.accountId())?.name) ?? 'Selecionar');
  readonly endLabel = computed(() => monthLabel(this.endMonth()));

  color(c: string): string {
    return catColor(c);
  }

  error(): string {
    if (this.amount() <= 0) return 'Informe o valor.';
    if (!this.description().trim()) return 'Informe uma descrição.';
    if (!this.categoryId()) return 'Selecione uma categoria.';
    if (!this.accountId()) return 'Selecione a conta.';
    if (this.day() < 1 || this.day() > 31) return 'Use um dia entre 1 e 31.';
    return '';
  }

  ngOnInit(): void {
    const r = this.store.recurringRule(this.ruleId);
    if (r) {
      this.type.set(r.type); this.amount.set(r.amount); this.description.set(r.description); this.categoryId.set(r.categoryId);
      this.accountId.set(r.accountId); this.cardId.set(r.cardId ?? null); this.day.set(r.day); this.active.set(r.active);
      this.hasEnd.set(!!r.endMonth); if (r.endMonth) this.endMonth.set(r.endMonth);
      return;
    }
    this.type.set(this.presetType ?? 'expense');
    this.accountId.set(this.store.activeAccounts()[0]?.id ?? '');
  }

  setType(t: TxType): void {
    this.type.set(t);
    if (this.category() && this.category()!.type !== t) this.categoryId.set(null);
    if (t === 'income') this.cardId.set(null);
  }

  async pickCategory(): Promise<void> {
    const id = await openPicker(this.modalCtrl, {
      title: 'Categoria', selected: this.categoryId(), searchable: true,
      options: this.store.categoriesOf(this.type()).map((c) => ({ id: c.id, label: c.name, icon: c.icon, color: c.color })),
    });
    if (id) this.categoryId.set(id);
  }

  async pickAccount(): Promise<void> {
    const opts = this.store.activeAccounts().map((a) => ({ id: a.id, label: a.name, icon: a.icon, color: a.color, group: 'Contas' }));
    if (this.type() === 'expense') opts.push(...this.store.cards().map((c) => ({ id: `card:${c.id}`, label: c.name, icon: 'card-outline', color: 'outros' as const, group: 'Cartões (entra na fatura)' })));
    const id = await openPicker(this.modalCtrl, { title: this.type() === 'income' ? 'Receber em' : 'Pagar com', selected: this.cardId() ? `card:${this.cardId()}` : this.accountId(), options: opts });
    if (!id) return;
    if (id.startsWith('card:')) {
      const c = this.store.card(id.slice(5));
      this.cardId.set(c?.id ?? null);
      if (c) this.accountId.set(c.accountId);
    } else {
      this.cardId.set(null);
      this.accountId.set(id);
    }
  }

  async pickEnd(): Promise<void> {
    const now = monthKey(new Date());
    const months = Array.from({ length: 36 }, (_, i) => addMonths(now, i));
    const id = await openPicker(this.modalCtrl, { title: 'Último mês', selected: this.endMonth(), options: months.map((m) => ({ id: m, label: monthLabel(m) })) });
    if (id) this.endMonth.set(id);
  }

  cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (this.error()) return;
    const data = {
      type: this.type(), description: this.description().trim(), amount: this.amount(), categoryId: this.categoryId()!,
      accountId: this.accountId(), cardId: this.cardId() ?? undefined, day: Math.round(this.day()),
      endMonth: this.hasEnd() ? this.endMonth() : undefined, active: this.active(),
    };
    const v = this.store.hidden() ? HIDDEN_MASK : money(data.amount);
    if (this.ruleId) {
      this.store.updateRecurring(this.ruleId, data);
      await this.ui.toast({ title: 'Recorrência atualizada', message: `${data.description} · ${v}/mês · os meses já pagos não mudam` });
    } else {
      this.store.addRecurring({ ...data, startMonth: monthKey(new Date()) });
      this.store.generateRecurring();
      await this.ui.toast({ title: data.type === 'income' ? 'Receita recorrente criada' : 'Conta fixa criada', message: `${data.description} · ${v} todo dia ${data.day}` });
    }
    void this.modalCtrl.dismiss(true, 'save');
  }

  async remove(): Promise<void> {
    const r = this.store.recurringRule(this.ruleId);
    if (!r) return;
    const ok = await this.ui.confirm({
      header: 'Excluir recorrência?',
      message: `“${r.description}” deixa de ser criada nos próximos meses. Os lançamentos pendentes dela são removidos; os já pagos continuam no histórico.`,
      confirmText: 'Excluir', destructive: true,
    });
    if (!ok) return;
    this.store.deleteRecurring(r.id);
    void this.modalCtrl.dismiss(true, 'delete');
  }
}

export async function openRecurringForm(modal: ModalController, props: { ruleId?: string; presetType?: TxType } = {}): Promise<boolean> {
  const m = await modal.create({ component: RecurringFormModal, componentProps: props, cssClass: 'mf-card-modal', presentingElement: document.querySelector('ion-tabs') as HTMLElement ?? undefined });
  await m.present();
  const { role } = await m.onWillDismiss();
  return role === 'save' || role === 'delete';
}
