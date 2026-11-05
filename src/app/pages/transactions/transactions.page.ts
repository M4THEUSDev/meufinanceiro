import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItemOption, IonItemOptions, IonItemSliding,
  IonSearchbar, IonTitle, IonToolbar, ModalController,
} from '@ionic/angular/standalone';
import { Transaction } from '../../core/models/models';
import { StoreService, defaultFilters } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { dayHeader, monthKey, monthLabel, round2, startOfDay } from '../../core/utils/format';
import { TransactionItemComponent } from '../../shared/components/transaction-item.component';
import { openPicker } from '../../shared/components/picker.modal';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { FiltersModal } from './filters.modal';
import { confirmDeleteTransaction } from './transaction-actions';
import { openTransactionForm } from './transaction-form.modal';

interface DayGroup {
  key: string;
  label: string;
  net: number;
  items: Transaction[];
}

/** [I] Transações · Lista */
@Component({
  selector: 'mf-transactions',
  imports: [
    IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon, IonSearchbar, IonItemSliding, IonItemOptions,
    IonItemOption, TransactionItemComponent, MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transactions.page.html',
  styleUrl: './transactions.page.scss',
})
export class TransactionsPage {
  protected readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly actionSheet = inject(ActionSheetController);

  readonly filters = this.store.filters;
  readonly list = computed(() => this.store.filterTransactions(this.filters()));
  readonly totals = computed(() => {
    let income = 0;
    let expense = 0;
    for (const t of this.list()) t.type === 'income' ? (income += t.amount) : (expense += t.amount);
    return { income: round2(income), expense: round2(expense), net: round2(income - expense) };
  });
  readonly groups = computed<DayGroup[]>(() => {
    const map = new Map<string, DayGroup>();
    for (const t of this.list()) {
      const d = startOfDay(new Date(t.date));
      const key = d.toISOString();
      let g = map.get(key);
      if (!g) {
        g = { key, label: dayHeader(d), net: 0, items: [] };
        map.set(key, g);
      }
      g.items.push(t);
      g.net = round2(g.net + (t.type === 'income' ? t.amount : -t.amount));
    }
    return [...map.values()];
  });

  readonly periodLabel = computed(() => {
    const f = this.filters();
    switch (f.period) {
      case 'month': return monthLabel(f.month);
      case 'last3': return 'Últimos 3 meses';
      case 'year': return 'Este ano';
      case 'custom': return 'Personalizado';
      default: return 'Todo o período';
    }
  });
  readonly categoryLabel = computed(() => {
    const ids = this.filters().categoryIds;
    if (!ids.length) return 'Categoria';
    if (ids.length === 1) return this.store.category(ids[0])?.name ?? 'Categoria';
    return `${ids.length} categorias`;
  });
  readonly typeLabel = computed(() => ({ all: 'Tipo', income: 'Receitas', expense: 'Despesas' })[this.filters().type]);
  readonly extraActive = computed(() => !!this.filters().accountId);
  readonly hasFilters = computed(() => {
    const f = this.filters();
    return f.type !== 'all' || f.categoryIds.length > 0 || !!f.accountId || f.period !== 'month' || f.month !== monthKey(new Date()) || !!f.search;
  });
  readonly emptyHint = signal('');

  search(v: string | null | undefined): void {
    this.filters.update((f) => ({ ...f, search: v ?? '' }));
  }

  async pickPeriod(): Promise<void> {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1)));
    const id = await openPicker(this.modal, {
      title: 'Período',
      selected: this.filters().period === 'month' ? this.filters().month : this.filters().period,
      options: [
        ...months.map((m) => ({ id: m, label: monthLabel(m), group: 'Mês' })),
        { id: 'last3', label: 'Últimos 3 meses', group: 'Intervalos' },
        { id: 'year', label: 'Este ano', group: 'Intervalos' },
        { id: 'all', label: 'Todo o período', group: 'Intervalos' },
      ],
    });
    if (!id) return;
    if (id === 'last3' || id === 'year' || id === 'all') this.filters.update((f) => ({ ...f, period: id }));
    else this.filters.update((f) => ({ ...f, period: 'month', month: id }));
  }

  async pickCategory(): Promise<void> {
    await this.openFilters();
  }

  async pickType(): Promise<void> {
    const sheet = await this.actionSheet.create({
      header: 'Tipo de transação',
      buttons: [
        { text: 'Todas', handler: () => this.filters.update((f) => ({ ...f, type: 'all' })) },
        { text: 'Receitas', handler: () => this.filters.update((f) => ({ ...f, type: 'income', categoryIds: [] })) },
        { text: 'Despesas', handler: () => this.filters.update((f) => ({ ...f, type: 'expense', categoryIds: [] })) },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  async openFilters(): Promise<void> {
    const m = await this.modal.create({ component: FiltersModal, breakpoints: [0, 0.92], initialBreakpoint: 0.92, cssClass: 'mf-sheet', handle: true });
    await m.present();
  }

  clearFilters(): void {
    this.filters.set(defaultFilters());
  }

  open(t: Transaction): void {
    void this.router.navigateByUrl(`/tabs/transacoes/${t.id}`);
  }

  async edit(t: Transaction, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    await openTransactionForm(this.modal, this.ui, this.store, { txId: t.id });
  }

  async remove(t: Transaction, sliding: IonItemSliding): Promise<void> {
    await sliding.close();
    await confirmDeleteTransaction(this.store, this.ui, t);
  }

  async add(): Promise<void> {
    await openTransactionForm(this.modal, this.ui, this.store);
  }
}
