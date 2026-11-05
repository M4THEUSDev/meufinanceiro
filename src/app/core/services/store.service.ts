import { Injectable, computed, effect, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  Account, AppData, Budget, Category, CreditCard, Goal, GoalContribution, Settings, Transaction, TxFilters, TxType,
} from '../models/models';
import { addMonths, daysBetween, monthKey, round2, startOfDay, uid } from '../utils/format';
import { DATA_VERSION, buildSeed } from './seed';

const STORAGE_KEY = 'mf:data';

export interface Bill {
  id: string;
  kind: 'tx' | 'card';
  name: string;
  amount: number;
  due: Date;
  /** dias até o vencimento (negativo = vencida) */
  days: number;
  status: 'overdue' | 'soon' | 'later';
  refId: string;
}

export interface CategorySpend {
  category: Category;
  total: number;
  count: number;
  share: number;
}

export interface MonthSummary {
  key: string;
  income: number;
  expense: number;
  net: number;
}

export const DEFAULT_FILTERS: TxFilters = { period: 'month', type: 'all', categoryIds: [], accountId: null, search: '' };

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly _data = signal<AppData>(buildSeed());
  readonly ready = signal(false);

  /** mês selecionado no Dashboard / Planejamento (YYYY-MM) */
  readonly selectedMonth = signal(monthKey(new Date()));
  readonly filters = signal<TxFilters>({ ...DEFAULT_FILTERS });

  readonly data = this._data.asReadonly();
  readonly settings = computed(() => this._data().settings);
  readonly accounts = computed(() => this._data().accounts);
  readonly activeAccounts = computed(() => this.accounts().filter((a) => a.active));
  readonly categories = computed(() => this._data().categories.filter((c) => !c.archived));
  readonly transactions = computed(() => [...this._data().transactions].sort((a, b) => b.date.localeCompare(a.date)));
  readonly budgets = computed(() => this._data().budgets);
  readonly goals = computed(() => this._data().goals);
  readonly cards = computed(() => this._data().cards);
  readonly hidden = computed(() => this.settings().hideValues);

  private readonly catMap = computed(() => new Map(this._data().categories.map((c) => [c.id, c])));
  private readonly accMap = computed(() => new Map(this.accounts().map((a) => [a.id, a])));

  readonly balances = computed(() => {
    const map = new Map<string, number>();
    this.accounts().forEach((a) => map.set(a.id, a.initialBalance));
    for (const t of this._data().transactions) {
      if (!t.paid || (t.cardId && !t.invoicePaid) || !map.has(t.accountId)) continue;
      map.set(t.accountId, round2(map.get(t.accountId)! + (t.type === 'income' ? t.amount : -t.amount)));
    }
    return map;
  });

  readonly totalBalance = computed(() =>
    round2(this.accounts().filter((a) => a.active && a.includeInTotal).reduce((s, a) => s + (this.balances().get(a.id) ?? 0), 0)),
  );

  readonly bills = computed<Bill[]>(() => {
    const today = startOfDay(new Date());
    const out: Bill[] = [];
    for (const t of this._data().transactions) {
      if (t.type !== 'expense' || t.paid || t.cardId) continue;
      const due = new Date(t.date);
      const days = daysBetween(today, due);
      out.push({ id: `b_${t.id}`, kind: 'tx', name: t.description, amount: t.amount, due, days, status: this.billStatus(days), refId: t.id });
    }
    for (const c of this.cards()) {
      const amount = this.cardOpenAmount(c.id);
      if (amount <= 0) continue;
      const due = this.nextDueDate(c);
      const days = daysBetween(today, due);
      out.push({ id: `b_${c.id}`, kind: 'card', name: `Fatura ${c.name}`, amount, due, days, status: this.billStatus(days), refId: c.id });
    }
    return out.sort((a, b) => a.due.getTime() - b.due.getTime());
  });

  constructor() {
    effect(() => {
      const d = this._data();
      if (!this.ready()) return;
      void Preferences.set({ key: STORAGE_KEY, value: JSON.stringify(d) });
    });
  }

  async load(): Promise<void> {
    try {
      const { value } = await Preferences.get({ key: STORAGE_KEY });
      if (value) {
        const parsed = JSON.parse(value) as AppData;
        if (parsed?.version === DATA_VERSION) this._data.set(parsed);
      }
    } catch {
      /* dados corrompidos: mantém o seed */
    }
    this.ready.set(true);
  }

  // ---------------- Lookups ----------------
  category(id: string | undefined): Category | undefined {
    return id ? this.catMap().get(id) : undefined;
  }
  account(id: string | undefined): Account | undefined {
    return id ? this.accMap().get(id) : undefined;
  }
  card(id: string | undefined): CreditCard | undefined {
    return id ? this.cards().find((c) => c.id === id) : undefined;
  }
  transaction(id: string): Transaction | undefined {
    return this._data().transactions.find((t) => t.id === id);
  }
  goal(id: string): Goal | undefined {
    return this.goals().find((g) => g.id === id);
  }
  budget(id: string): Budget | undefined {
    return this.budgets().find((b) => b.id === id);
  }
  categoriesOf(type: TxType): Category[] {
    return this.categories().filter((c) => c.type === type);
  }
  balanceOf(accountId: string): number {
    return this.balances().get(accountId) ?? 0;
  }

  // ---------------- Agregações ----------------
  txOfMonth(key: string): Transaction[] {
    return this.transactions().filter((t) => monthKey(new Date(t.date)) === key);
  }

  summary(key: string): MonthSummary {
    let income = 0;
    let expense = 0;
    for (const t of this.txOfMonth(key)) {
      if (t.type === 'income') income += t.amount;
      else expense += t.amount;
    }
    return { key, income: round2(income), expense: round2(expense), net: round2(income - expense) };
  }

  history(endKey: string, months = 6): MonthSummary[] {
    return Array.from({ length: months }, (_, i) => this.summary(addMonths(endKey, i - (months - 1))));
  }

  categorySpend(key: string, type: TxType = 'expense'): CategorySpend[] {
    const map = new Map<string, { total: number; count: number }>();
    for (const t of this.txOfMonth(key)) {
      if (t.type !== type) continue;
      const e = map.get(t.categoryId) ?? { total: 0, count: 0 };
      e.total += t.amount;
      e.count++;
      map.set(t.categoryId, e);
    }
    const total = [...map.values()].reduce((s, e) => s + e.total, 0);
    return [...map.entries()]
      .map(([id, e]) => ({
        category: this.category(id) ?? { id, name: 'Sem categoria', type, icon: 'help-circle-outline', color: 'outros' as const },
        total: round2(e.total),
        count: e.count,
        share: total ? e.total / total : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }

  spentInCategory(categoryId: string, key: string): number {
    return round2(this.txOfMonth(key).filter((t) => t.type === 'expense' && t.categoryId === categoryId).reduce((s, t) => s + t.amount, 0));
  }

  /** saldo consolidado ao fim do dia `d` (considera apenas transações pagas) */
  balanceAt(d: Date): number {
    const limit = d.getTime();
    let total = this.accounts().filter((a) => a.active && a.includeInTotal).reduce((s, a) => s + a.initialBalance, 0);
    const ids = new Set(this.accounts().filter((a) => a.active && a.includeInTotal).map((a) => a.id));
    for (const t of this._data().transactions) {
      if (!t.paid || (t.cardId && !t.invoicePaid) || !ids.has(t.accountId) || new Date(t.date).getTime() > limit) continue;
      total += t.type === 'income' ? t.amount : -t.amount;
    }
    return round2(total);
  }

  /** saldo ao final de cada um dos últimos `months` meses (mês corrente = hoje) */
  wealthHistory(endKey: string, months = 6): { key: string; value: number }[] {
    const nowKey = monthKey(new Date());
    return Array.from({ length: months }, (_, i) => {
      const key = addMonths(endKey, i - (months - 1));
      const [y, m] = key.split('-').map(Number);
      const end = key >= nowKey ? new Date() : new Date(y, m, 0, 23, 59, 59);
      return { key, value: this.balanceAt(end) };
    });
  }

  budgetsFor(key: string): Budget[] {
    return this.budgets().filter((b) => (b.recurring ? b.month <= key : b.month === key));
  }

  goalSaved(g: Goal): number {
    return round2(g.contributions.reduce((s, c) => s + c.amount, 0));
  }

  cardOpenAmount(cardId: string): number {
    return round2(this._data().transactions.filter((t) => t.cardId === cardId && !t.invoicePaid).reduce((s, t) => s + t.amount, 0));
  }

  cardUsed(cardId: string): number {
    return this.cardOpenAmount(cardId);
  }

  nextDueDate(c: CreditCard, from = new Date()): Date {
    const today = startOfDay(from);
    let due = new Date(today.getFullYear(), today.getMonth(), c.dueDay);
    if (due < today) due = new Date(today.getFullYear(), today.getMonth() + 1, c.dueDay);
    return due;
  }

  nextClosingDate(c: CreditCard, from = new Date()): Date {
    const today = startOfDay(from);
    let d = new Date(today.getFullYear(), today.getMonth(), c.closingDay);
    if (d < today) d = new Date(today.getFullYear(), today.getMonth() + 1, c.closingDay);
    return d;
  }

  private billStatus(days: number): Bill['status'] {
    if (days < 0) return 'overdue';
    if (days <= 3) return 'soon';
    return 'later';
  }

  // ---------------- Mutations ----------------
  private patch(fn: (d: AppData) => AppData): void {
    this._data.update(fn);
  }

  updateSettings(p: Partial<Settings>): void {
    this.patch((d) => ({ ...d, settings: { ...d.settings, ...p } }));
  }

  toggleHidden(): void {
    this.updateSettings({ hideValues: !this.settings().hideValues });
  }

  addTransaction(t: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const tx: Transaction = { ...t, amount: round2(t.amount), id: uid('t'), createdAt: new Date().toISOString() };
    this.patch((d) => ({ ...d, transactions: [tx, ...d.transactions] }));
    return tx;
  }

  updateTransaction(id: string, p: Partial<Transaction>): void {
    this.patch((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...p, id } : t)) }));
  }

  deleteTransaction(id: string): Transaction | undefined {
    const t = this.transaction(id);
    this.patch((d) => ({ ...d, transactions: d.transactions.filter((x) => x.id !== id) }));
    return t;
  }

  restoreTransaction(t: Transaction): void {
    this.patch((d) => ({ ...d, transactions: [t, ...d.transactions] }));
  }

  markPaid(id: string, paid = true): void {
    this.updateTransaction(id, { paid });
  }

  payCardInvoice(cardId: string): number {
    const amount = this.cardOpenAmount(cardId);
    this.patch((d) => ({ ...d, transactions: d.transactions.map((t) => (t.cardId === cardId && !t.invoicePaid ? { ...t, paid: true, invoicePaid: true } : t)) }));
    return amount;
  }

  addAccount(a: Omit<Account, 'id' | 'createdAt'>): Account {
    const acc: Account = { ...a, id: uid('a'), createdAt: new Date().toISOString() };
    this.patch((d) => ({ ...d, accounts: [...d.accounts, acc] }));
    return acc;
  }

  updateAccount(id: string, p: Partial<Account>): void {
    this.patch((d) => ({ ...d, accounts: d.accounts.map((a) => (a.id === id ? { ...a, ...p, id } : a)) }));
  }

  deleteAccount(id: string): void {
    this.patch((d) => ({
      ...d,
      accounts: d.accounts.filter((a) => a.id !== id),
      transactions: d.transactions.filter((t) => t.accountId !== id),
    }));
  }

  addCategory(c: Omit<Category, 'id'>): Category {
    const cat: Category = { ...c, id: uid('c') };
    this.patch((d) => ({ ...d, categories: [...d.categories, cat] }));
    return cat;
  }

  updateCategory(id: string, p: Partial<Category>): void {
    this.patch((d) => ({ ...d, categories: d.categories.map((c) => (c.id === id ? { ...c, ...p, id } : c)) }));
  }

  deleteCategory(id: string): void {
    const used = this._data().transactions.some((t) => t.categoryId === id);
    if (used) this.updateCategory(id, { archived: true });
    else this.patch((d) => ({ ...d, categories: d.categories.filter((c) => c.id !== id), budgets: d.budgets.filter((b) => b.categoryId !== id) }));
  }

  saveBudget(b: Omit<Budget, 'id'> & { id?: string }): Budget {
    const existing = b.id ? this.budget(b.id) : this.budgets().find((x) => x.categoryId === b.categoryId);
    const budget: Budget = { ...b, limit: round2(b.limit), id: existing?.id ?? uid('b') };
    this.patch((d) => ({
      ...d,
      budgets: existing ? d.budgets.map((x) => (x.id === existing.id ? budget : x)) : [...d.budgets, budget],
    }));
    return budget;
  }

  deleteBudget(id: string): void {
    this.patch((d) => ({ ...d, budgets: d.budgets.filter((b) => b.id !== id) }));
  }

  addGoal(g: Omit<Goal, 'id' | 'createdAt' | 'contributions'> & { initial?: number }): Goal {
    const { initial, ...rest } = g;
    const goal: Goal = {
      ...rest,
      id: uid('g'),
      createdAt: new Date().toISOString(),
      contributions: initial ? [{ id: uid('gc'), amount: round2(initial), date: new Date().toISOString() }] : [],
    };
    this.patch((d) => ({ ...d, goals: [...d.goals, goal] }));
    return goal;
  }

  updateGoal(id: string, p: Partial<Goal>): void {
    this.patch((d) => ({ ...d, goals: d.goals.map((g) => (g.id === id ? { ...g, ...p, id } : g)) }));
  }

  deleteGoal(id: string): void {
    this.patch((d) => ({ ...d, goals: d.goals.filter((g) => g.id !== id) }));
  }

  addContribution(goalId: string, c: Omit<GoalContribution, 'id'>): void {
    const contribution: GoalContribution = { ...c, amount: round2(c.amount), id: uid('gc') };
    this.patch((d) => ({
      ...d,
      goals: d.goals.map((g) => (g.id === goalId ? { ...g, contributions: [...g.contributions, contribution] } : g)),
    }));
  }

  addCard(c: Omit<CreditCard, 'id'>): CreditCard {
    const card: CreditCard = { ...c, id: uid('k') };
    this.patch((d) => ({ ...d, cards: [...d.cards, card] }));
    return card;
  }

  updateCard(id: string, p: Partial<CreditCard>): void {
    this.patch((d) => ({ ...d, cards: d.cards.map((c) => (c.id === id ? { ...c, ...p, id } : c)) }));
  }

  deleteCard(id: string): void {
    this.patch((d) => ({
      ...d,
      cards: d.cards.filter((c) => c.id !== id),
      transactions: d.transactions.map((t) => (t.cardId === id ? { ...t, cardId: undefined, invoicePaid: undefined } : t)),
    }));
  }

  /** apaga dados financeiros mantendo preferências / sessão */
  resetAll(): void {
    const seed = buildSeed();
    const s = this.settings();
    this._data.set({ ...seed, settings: { ...seed.settings, ...s } });
  }

  clearAll(): void {
    const s = this.settings();
    const seed = buildSeed();
    this._data.set({
      ...seed,
      settings: s,
      accounts: [],
      transactions: [],
      budgets: [],
      goals: [],
      cards: [],
      categories: seed.categories.filter((c) => !c.custom),
    });
  }

  exportJson(): string {
    return JSON.stringify(this._data(), null, 2);
  }

  exportCsv(): string {
    const rows = [['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta', 'Valor', 'Status']];
    for (const t of this.transactions()) {
      rows.push([
        t.date.slice(0, 10),
        t.description,
        t.type === 'income' ? 'Receita' : 'Despesa',
        this.category(t.categoryId)?.name ?? '',
        this.account(t.accountId)?.name ?? '',
        (t.type === 'income' ? t.amount : -t.amount).toFixed(2).replace('.', ','),
        t.paid ? 'Pago' : 'Pendente',
      ]);
    }
    return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  }

  importJson(json: string): boolean {
    try {
      const d = JSON.parse(json) as AppData;
      if (!d || !Array.isArray(d.transactions) || !d.settings) return false;
      this._data.set({ ...d, version: DATA_VERSION });
      return true;
    } catch {
      return false;
    }
  }
}
