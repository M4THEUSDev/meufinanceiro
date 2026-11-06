import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  IonButton, IonContent, IonDatetime, IonHeader, IonIcon, IonModal, IonSegment, IonSegmentButton, IonToggle, ModalController,
} from '@ionic/angular/standalone';
import { Transaction, TxType } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { catColor } from '../../core/icons';
import { daysBetween, fromDateInput, monthKey, shortDate, toDateInput } from '../../core/utils/format';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';
import { openPicker } from '../../shared/components/picker.modal';
import { CategoryFormModal } from '../categories/category-form.modal';

export interface TxFormResult {
  tx: Transaction;
  mode: 'create' | 'edit';
}

/** [G] Nova transação / [L] Editar transação — ion-modal (card) */
@Component({
  selector: 'mf-transaction-form',
  imports: [FormsModule, IonHeader, IonContent, IonSegment, IonSegmentButton, IonToggle, IonIcon, IonButton, IonModal, IonDatetime, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transaction-form.modal.html',
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .lead-desc { --lead: var(--mf-text-secondary); }
    .lead-date { --lead: var(--mf-category-transporte); }
    .lead-paid { --lead: var(--ion-color-success); }
    .err { color: var(--ion-color-danger); font-size: 13px; padding: 0 4px; margin: 0; }
    .mf-row.invalid .label { color: var(--ion-color-danger); }
    .mf-row.invalid input::placeholder, .mf-row.invalid .value { color: var(--ion-color-danger); }
    ion-datetime { --background: var(--ion-card-background); margin: 0 auto; }
    .dt-wrap { padding: 8px 16px 24px; display: flex; flex-direction: column; gap: 12px; background: var(--ion-background-color); }
  `,
})
export class TransactionFormModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  // componentProps
  txId?: string;
  presetType?: TxType;
  presetCategoryId?: string;
  presetCardId?: string;

  readonly type = signal<TxType>('expense');
  readonly amount = signal(0);
  readonly description = signal('');
  readonly categoryId = signal<string | null>(null);
  readonly accountId = signal<string | null>(null);
  readonly cardId = signal<string | null>(null);
  readonly date = signal(new Date().toISOString());
  readonly paid = signal(true);
  readonly notes = signal('');
  readonly parts = signal(1);
  readonly repeat = signal(false);
  readonly submitted = signal(false);
  readonly dateOpen = signal(false);
  readonly maxDate = toDateInput(new Date(new Date().getFullYear() + 2, 11, 31).toISOString());

  readonly isEdit = computed(() => !!this.txId);
  readonly category = computed(() => this.store.category(this.categoryId() ?? undefined));
  readonly account = computed(() => this.store.account(this.accountId() ?? undefined));
  readonly card = computed(() => this.store.card(this.cardId() ?? undefined));
  readonly sourceLabel = computed(() => this.card()?.name ?? this.account()?.name ?? 'Selecionar');
  readonly sourceColor = computed(() => (this.card() ? 'var(--mf-text-secondary)' : catColor(this.account()?.color ?? 'outros')));
  readonly sourceIcon = computed(() => (this.card() ? 'card-outline' : 'wallet-outline'));
  readonly dateLabel = computed(() => {
    const diff = daysBetween(new Date(this.date()), new Date());
    const prefix = diff === 0 ? 'Hoje, ' : diff === 1 ? 'Ontem, ' : diff === -1 ? 'Amanhã, ' : '';
    return `${prefix}${shortDate(this.date())}`;
  });
  readonly errors = computed(() => ({
    amount: this.amount() <= 0 ? 'Informe um valor maior que zero.' : '',
    description: !this.description().trim() ? 'Informe uma descrição.' : '',
    category: !this.categoryId() ? 'Selecione uma categoria.' : '',
    account: !this.accountId() ? 'Selecione uma conta.' : '',
  }));
  readonly missing = computed(() => {
    const e = this.errors();
    const list = [e.description && 'descrição', e.category && 'categoria', e.account && 'conta'].filter(Boolean) as string[];
    return list.length > 1 ? `${list.slice(0, -1).join(', ')} e ${list.at(-1)}` : list[0] ?? '';
  });
  readonly valid = computed(() => Object.values(this.errors()).every((e) => !e));

  ngOnInit(): void {
    const t = this.txId ? this.store.transaction(this.txId) : undefined;
    if (t) {
      this.type.set(t.type);
      this.amount.set(t.amount);
      this.description.set(t.description);
      this.categoryId.set(t.categoryId);
      this.accountId.set(t.accountId);
      this.cardId.set(t.cardId ?? null);
      this.date.set(t.date);
      this.paid.set(t.paid);
      this.notes.set(t.notes ?? '');
      return;
    }
    this.type.set(this.presetType ?? 'expense');
    const acc = this.store.activeAccounts()[0];
    this.accountId.set(acc?.id ?? null);
    if (this.presetCardId) {
      const c = this.store.card(this.presetCardId);
      this.cardId.set(c?.id ?? null);
      if (c) this.accountId.set(c.accountId);
    }
    this.categoryId.set(this.presetCategoryId ?? null);
  }

  setType(t: TxType): void {
    if (t === this.type()) return;
    this.type.set(t);
    const cat = this.category();
    if (cat && cat.type !== t) this.categoryId.set(null);
    if (t === 'income') this.cardId.set(null);
    this.ui.tap();
  }

  async pickCategory(): Promise<void> {
    const cats = this.store.categoriesOf(this.type());
    const id = await openPicker(this.modalCtrl, {
      title: 'Categoria',
      selected: this.categoryId(),
      searchable: cats.length > 8,
      createLabel: 'Nova categoria',
      options: cats.map((c) => ({ id: c.id, label: c.name, icon: c.icon, color: c.color, group: c.custom ? 'Personalizadas' : 'Padrão' })),
    });
    if (id === '__create__') {
      const m = await this.modalCtrl.create({ component: CategoryFormModal, componentProps: { presetType: this.type() }, cssClass: 'mf-card-modal' });
      await m.present();
      const { data } = await m.onWillDismiss<string>();
      if (data) this.categoryId.set(data);
    } else if (id) this.categoryId.set(id);
  }

  async pickAccount(): Promise<void> {
    const opts = this.store.activeAccounts().map((a) => ({ id: a.id, label: a.name, icon: a.icon, color: a.color, group: 'Contas' }));
    if (this.type() === 'expense') {
      opts.push(...this.store.cards().map((c) => ({ id: `card:${c.id}`, label: c.name, icon: 'card-outline', color: 'outros' as const, group: 'Cartões de crédito' })));
    }
    const id = await openPicker(this.modalCtrl, {
      title: this.type() === 'expense' ? 'Pagar com' : 'Receber em',
      selected: this.cardId() ? `card:${this.cardId()}` : this.accountId(),
      options: opts,
    });
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

  async pickParts(): Promise<void> {
    const opts = Array.from({ length: 12 }, (_, i) => {
      const n = i + 1;
      const each = this.amount() / n;
      return { id: String(n), label: n === 1 ? 'À vista' : `${n}x`, subtitle: this.store.hidden() || !this.amount() ? undefined : `${n}x de R$ ${each.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` };
    });
    const id = await openPicker(this.modalCtrl, { title: 'Parcelas', selected: String(this.parts()), options: opts });
    if (id) this.parts.set(Number(id));
  }

  onDate(value: string | string[] | null | undefined): void {
    const v = Array.isArray(value) ? value[0] : value;
    if (!v) return;
    this.date.set(fromDateInput(v.slice(0, 10), this.date()));
  }

  cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  save(): void {
    this.submitted.set(true);
    if (!this.valid()) {
      const n = Object.values(this.errors()).filter(Boolean).length;
      this.ui.notify('error');
      void this.ui.toast({ title: 'Revise os campos destacados', message: `${n} ${n === 1 ? 'campo obrigatório não foi preenchido' : 'campos obrigatórios não foram preenchidos'}.`, tone: 'danger' });
      return;
    }
    const payload = {
      type: this.type(),
      amount: this.amount(),
      description: this.description().trim(),
      categoryId: this.categoryId()!,
      accountId: this.accountId()!,
      cardId: this.cardId() ?? undefined,
      date: this.date(),
      paid: this.paid(),
      notes: this.notes().trim() || undefined,
    };
    let tx: Transaction;
    if (this.txId) {
      const prev = this.store.transaction(this.txId);
      this.store.updateTransaction(this.txId, { ...payload, invoicePaid: payload.cardId && payload.cardId === prev?.cardId ? prev?.invoicePaid : undefined });
      tx = this.store.transaction(this.txId)!;
    } else if (this.repeat()) {
      const d = new Date(payload.date);
      const rule = this.store.addRecurring({
        type: payload.type, description: payload.description, amount: payload.amount, categoryId: payload.categoryId,
        accountId: payload.accountId, cardId: payload.cardId, day: d.getDate(), startMonth: monthKey(d), active: true,
      });
      tx = this.store.addTransaction({ ...payload, recurringId: rule.id });
      this.store.generateRecurring();
    } else if (payload.cardId && this.parts() > 1) {
      tx = this.store.addInstallments(payload, this.parts())[0];
    } else {
      tx = this.store.addTransaction(payload);
    }
    this.ui.notify('success');
    void this.modalCtrl.dismiss({ tx, mode: this.txId ? 'edit' : 'create' } satisfies TxFormResult, 'save');
  }
}

/** Abre o modal de transação e mostra o toast de confirmação */
export async function openTransactionForm(
  modalCtrl: ModalController,
  ui: UiService,
  store: StoreService,
  props: { txId?: string; presetType?: TxType; presetCategoryId?: string; presetCardId?: string } = {},
): Promise<TxFormResult | null> {
  const m = await modalCtrl.create({
    component: TransactionFormModal,
    componentProps: props,
    cssClass: 'mf-card-modal',
    presentingElement: document.querySelector('ion-router-outlet ion-tabs') as HTMLElement ?? undefined,
    canDismiss: true,
  });
  await m.present();
  const { data, role } = await m.onWillDismiss<TxFormResult>();
  if (role !== 'save' || !data) return null;
  const t = data.tx;
  const kind = t.type === 'income' ? 'Receita' : 'Despesa';
  const value = store.hidden() ? '' : ` · ${t.type === 'income' ? '+' : '−'} R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
  if (data.mode === 'create') {
    const parts = t.installment ? ` · ${t.installment.total}x no cartão` : '';
    await ui.toast({
      title: `${kind} salva`,
      message: `${t.description}${value}${parts || ' · Saldo atualizado'}`,
      action: {
        text: 'Desfazer',
        handler: () => {
          if (t.installment) store.deleteInstallmentGroup(t.installment.group);
          else store.deleteTransaction(t.id);
        },
      },
    });
  } else {
    await ui.toast({ title: 'Transação atualizada', message: `${t.description}${value}` });
  }
  return data;
}
