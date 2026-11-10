import { Injectable, computed, effect, signal } from '@angular/core';
import { Preferences } from '@capacitor/preferences';
import {
  Account, AppData, Budget, Category, CreditCard, Debt, Goal, GoalContribution, Investment, InvestmentMove, Recurring, Settings, Transaction, TxFilters, TxType,
} from '../models/models';
import { addMonths, daysBetween, monthKey, round2, startOfDay, uid } from '../utils/format';
import { DATA_VERSION, DEFAULT_CATEGORIES, buildSeed } from './seed';

const STORAGE_KEY = 'mf:data';

export interface Bill {
  id: string;
  kind: 'tx' | 'card' | 'debt';
  name: string;
  amount: number;
  due: Date;
  /** dias até o vencimento (negativo = vencida) */
  days: number;
  status: 'overdue' | 'soon' | 'later';
  refId: string;
}

/** rota para abrir um vencimento */
export function billRoute(b: Pick<Bill, 'kind' | 'refId'>): string {
  if (b.kind === 'card') return '/tabs/mais/cartoes';
  if (b.kind === 'debt') return '/tabs/mais/financas';
  return `/tabs/transacoes/${b.refId}`;
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

export const defaultFilters = (): TxFilters => ({ period: 'month', month: monthKey(new Date()), type: 'all', categoryIds: [], accountId: null, search: '' });

@Injectable({ providedIn: 'root' })
export class StoreService {
  private readonly _data = signal<AppData>(buildSeed());
  readonly ready = signal(false);

  /** mês selecionado no Dashboard / Planejamento (YYYY-MM) */
  readonly selectedMonth = signal(monthKey(new Date()));
  readonly filters = signal<TxFilters>(defaultFilters());

  readonly data = this._data.asReadonly();
  readonly settings = computed(() => this._data().settings);
  readonly accounts = computed(() => this._data().accounts);
  readonly activeAccounts = computed(() => this.accounts().filter((a) => a.active));
  readonly categories = computed(() => this._data().categories.filter((c) => !c.archived));
  readonly transactions = computed(() => [...this._data().transactions].sort((a, b) => b.date.localeCompare(a.date)));
  readonly budgets = computed(() => this._data().budgets);
  readonly goals = computed(() => this._data().goals);
  readonly cards = computed(() => this._data().cards);
  readonly debts = computed(() => this._data().debts ?? []);
  readonly recurring = computed(() => this._data().recurring ?? []);
  readonly investments = computed(() => this._data().investments ?? []);
  /** total investido: o que é seu e o que é de outras pessoas */
  readonly investmentTotals = computed(() => {
    const list = this.investments();
    const mine = round2(list.filter((i) => i.mine).reduce((s, i) => s + this.investmentBalance(i), 0));
    const others = round2(list.filter((i) => !i.mine).reduce((s, i) => s + this.investmentBalance(i), 0));
    return { mine, others, total: round2(mine + others) };
  });
  readonly hidden = computed(() => this.settings().hideValues);

  private readonly catMap = computed(() => new Map(this._data().categories.map((c) => [c.id, c])));
  private readonly accMap = computed(() => new Map(this.accounts().map((a) => [a.id, a])));

  readonly balances = computed(() => {
    const map = new Map<string, number>();
    this.accounts().forEach((a) => map.set(a.id, a.initialBalance));
    for (const t of this._data().transactions) {
      const acc = this.effectiveAccount(t);
      if (!t.paid || (t.cardId && !t.invoicePaid) || !map.has(acc)) continue;
      map.set(acc, round2(map.get(acc)! + (t.type === 'income' ? t.amount : -t.amount)));
    }
    // contribuições para metas: transferência da conta de origem para a conta onde a meta é guardada
    for (const g of this._data().goals) {
      for (const c of g.contributions) {
        if (!c.accountId || c.accountId === g.accountId) continue;
        if (map.has(c.accountId)) map.set(c.accountId, round2(map.get(c.accountId)! - c.amount));
        if (g.accountId && map.has(g.accountId)) map.set(g.accountId, round2(map.get(g.accountId)! + c.amount));
      }
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
    for (const d of this.debts()) {
      if (d.paidInstallments >= d.totalInstallments) continue;
      const due = this.debtNextDue(d);
      const days = daysBetween(today, due);
      out.push({ id: `b_${d.id}`, kind: 'debt', name: `${d.name} (${d.paidInstallments + 1}/${d.totalInstallments})`, amount: d.installmentAmount, due, days, status: this.billStatus(days), refId: d.id });
    }
    return out.sort((a, b) => a.due.getTime() - b.due.getTime());
  });

  // ---------------- Ganhos e dívidas ----------------
  /** receitas pendentes (a receber) */
  readonly receivables = computed(() =>
    this.transactions()
      .filter((t) => t.type === 'income' && !t.paid)
      .sort((a, b) => a.date.localeCompare(b.date)),
  );

  /** saldo devedor de cada dívida (cartões + empréstimos) */
  readonly debtSummary = computed(() => {
    const cards = this.cards().map((c) => {
      const open = this.cardOpenAmount(c.id);
      const future = this.cardFutureAmount(c.id);
      return { id: c.id, kind: 'card' as const, name: c.name, creditor: c.bank, current: open, total: round2(open + future), future, byInstallments: round2(open + future), informed: false };
    });
    const loans = this.debts().map((d) => {
      const remaining = Math.max(0, d.totalInstallments - d.paidInstallments);
      const byInstallments = round2(remaining * d.installmentAmount);
      // saldo informado pelo credor vale enquanto houver parcelas a pagar
      const informed = remaining && d.payoffAmount != null ? round2(d.payoffAmount) : null;
      return {
        id: d.id, kind: 'debt' as const, name: d.name, creditor: d.creditor, current: remaining ? d.installmentAmount : 0,
        total: informed ?? byInstallments, byInstallments, informed: informed != null, future: 0, debt: d,
      };
    });
    const total = round2([...cards, ...loans].reduce((s, x) => s + x.total, 0));
    return { cards, loans, total };
  });

  /** patrimônio líquido = saldo das contas + seus investimentos − dívidas */
  readonly netWorth = computed(() => round2(this.totalBalance() + this.investmentTotals().mine - this.debtSummary().total));

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
        const migrated = this.migrate(parsed);
        if (migrated) this._data.set(migrated);
      }
    } catch {
      /* dados corrompidos: mantém o seed */
    }
    this.generateRecurring();
    this.ready.set(true);
  }

  /**
   * Atualiza dados salvos por versões anteriores sem perder nada:
   * acrescenta coleções/campos novos e categorias padrão que faltarem.
   */
  private migrate(d: AppData): AppData | null {
    if (!d || !Array.isArray(d.transactions) || !d.settings) return null;
    if (d.version > DATA_VERSION) return null;
    const seed = buildSeed();
    const ids = new Set((d.categories ?? []).map((c) => c.id));
    return {
      ...d,
      version: DATA_VERSION,
      settings: { ...seed.settings, ...d.settings },
      accounts: d.accounts ?? [],
      categories: [...(d.categories ?? []), ...DEFAULT_CATEGORIES.filter((c) => !ids.has(c.id))],
      budgets: d.budgets ?? [],
      goals: d.goals ?? [],
      cards: (d.cards ?? []).map((c) => ({ ...c, bank: c.bank ?? c.name, tier: c.tier ?? '' })),
      debts: d.debts ?? [],
      recurring: d.recurring ?? [],
      investments: d.investments ?? [],
    };
  }

  /** compras no cartão saem da conta que paga a fatura */
  private effectiveAccount(t: Transaction): string {
    if (!t.cardId) return t.accountId;
    return this._data().cards.find((c) => c.id === t.cardId)?.accountId ?? t.accountId;
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

  // ---------------- Filtros ----------------
  /** aplica período/tipo/categorias/conta/busca */
  filterTransactions(f: TxFilters, includeSearch = true): Transaction[] {
    const now = new Date();
    let from = -Infinity;
    let to = Infinity;
    if (f.period === 'month') {
      const [y, m] = f.month.split('-').map(Number);
      from = new Date(y, m - 1, 1).getTime();
      to = new Date(y, m, 1).getTime() - 1;
    } else if (f.period === 'last3') {
      from = new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime();
      to = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime() - 1;
    } else if (f.period === 'year') {
      from = new Date(now.getFullYear(), 0, 1).getTime();
      to = new Date(now.getFullYear() + 1, 0, 1).getTime() - 1;
    } else if (f.period === 'custom') {
      if (f.from) from = new Date(`${f.from}T00:00:00`).getTime();
      if (f.to) to = new Date(`${f.to}T23:59:59`).getTime();
    }
    const q = includeSearch ? f.search.trim().toLowerCase() : '';
    const qNum = q.replace(/[^\d,.]/g, '');
    return this.transactions().filter((t) => {
      const ts = new Date(t.date).getTime();
      if (ts < from || ts > to) return false;
      if (f.type !== 'all' && t.type !== f.type) return false;
      if (f.categoryIds.length && !f.categoryIds.includes(t.categoryId)) return false;
      if (f.accountId && t.accountId !== f.accountId) return false;
      if (q) {
        const cat = this.category(t.categoryId)?.name.toLowerCase() ?? '';
        const amount = t.amount.toFixed(2).replace('.', ',');
        const amountBr = t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        const textHit = t.description.toLowerCase().includes(q) || cat.includes(q) || (t.notes ?? '').toLowerCase().includes(q);
        const numHit = !!qNum && (amount.includes(qNum) || amountBr.includes(qNum));
        if (!textHit && !numHit) return false;
      }
      return true;
    });
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
      if (!t.paid || (t.cardId && !t.invoicePaid) || !ids.has(this.effectiveAccount(t)) || new Date(t.date).getTime() > limit) continue;
      total += t.type === 'income' ? t.amount : -t.amount;
    }
    for (const g of this._data().goals) {
      for (const c of g.contributions) {
        if (!c.accountId || c.accountId === g.accountId || new Date(c.date).getTime() > limit) continue;
        if (ids.has(c.accountId)) total -= c.amount;
        if (g.accountId && ids.has(g.accountId)) total += c.amount;
      }
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

  /**
   * Orçamentos vigentes no mês: para cada categoria vale o orçamento específico do mês
   * ou, na falta dele, o recorrente mais recente iniciado até o mês.
   */
  budgetsFor(key: string): Budget[] {
    const byCat = new Map<string, Budget>();
    for (const b of this.budgets()) {
      if (b.month > key) continue;
      if (!b.recurring && b.month !== key) continue;
      const cur = byCat.get(b.categoryId);
      const score = (x: Budget) => (x.month === key && !x.recurring ? '9999-99' : x.month);
      if (!cur || score(b) >= score(cur)) byCat.set(b.categoryId, b);
    }
    return [...byCat.values()].filter((b) => this.category(b.categoryId) && b.limit > 0);
  }

  /** média de gasto da categoria nos `n` meses anteriores a `key` */
  categoryAverage(categoryId: string, key: string, n = 3): number {
    let total = 0;
    for (let i = 1; i <= n; i++) total += this.spentInCategory(categoryId, addMonths(key, -i));
    return round2(total / n);
  }

  /** copia os orçamentos vigentes do mês anterior como orçamentos específicos deste mês */
  copyBudgetsFrom(fromKey: string, toKey: string): number {
    const src = this.budgetsFor(fromKey);
    const existing = new Set(this.budgets().filter((b) => b.month === toKey).map((b) => b.categoryId));
    const copies = src.filter((b) => !existing.has(b.categoryId)).map((b) => ({ ...b, id: uid('b'), month: toKey, recurring: false }));
    if (copies.length) this.patch((d) => ({ ...d, budgets: [...d.budgets, ...copies] }));
    return copies.length;
  }

  goalSaved(g: Goal): number {
    return round2(g.contributions.reduce((s, c) => s + c.amount, 0));
  }

  /**
   * Corte da fatura atual: início do dia de fechamento ligado ao próximo vencimento.
   * Compras feitas a partir do dia de fechamento entram na fatura seguinte.
   */
  cardCutoff(cardId: string, from = new Date()): number {
    const c = this.card(cardId);
    if (!c) return from.getTime();
    const due = this.nextDueDate(c, from);
    let closing = new Date(due.getFullYear(), due.getMonth(), c.closingDay);
    if (closing >= due) closing = new Date(due.getFullYear(), due.getMonth() - 1, c.closingDay);
    return Math.min(closing.getTime(), startOfDay(new Date(from.getTime() + 86400000)).getTime());
  }

  /** compras do cartão na fatura atual (não quitadas, antes do fechamento) */
  cardInvoiceItems(cardId: string): Transaction[] {
    const cut = this.cardCutoff(cardId);
    return this.transactions().filter((t) => t.cardId === cardId && !t.invoicePaid && new Date(t.date).getTime() < cut);
  }

  /** fatura atual */
  cardOpenAmount(cardId: string): number {
    return round2(this.cardInvoiceItems(cardId).reduce((s, t) => s + t.amount, 0));
  }

  /** próximas faturas: compras após o fechamento + parcelas futuras */
  cardFutureAmount(cardId: string): number {
    const cut = this.cardCutoff(cardId);
    return round2(
      this._data().transactions.filter((t) => t.cardId === cardId && !t.invoicePaid && new Date(t.date).getTime() >= cut).reduce((s, t) => s + t.amount, 0),
    );
  }

  /** limite comprometido = fatura atual + parcelas futuras */
  cardUsed(cardId: string): number {
    return round2(this.cardOpenAmount(cardId) + this.cardFutureAmount(cardId));
  }

  /** compras parceladas com parcelas ainda por vir */
  installmentPlans(cardId?: string): { group: string; description: string; amount: number; current: number; total: number; categoryId: string; cardId: string }[] {
    const now = Date.now();
    const groups = new Map<string, Transaction[]>();
    for (const t of this._data().transactions) {
      if (!t.installment || (cardId && t.cardId !== cardId)) continue;
      groups.set(t.installment.group, [...(groups.get(t.installment.group) ?? []), t]);
    }
    return [...groups.values()]
      .map((list) => {
        const sorted = list.sort((a, b) => a.date.localeCompare(b.date));
        const past = sorted.filter((t) => new Date(t.date).getTime() <= now);
        const f = sorted[0];
        return { group: f.installment!.group, description: f.description, amount: f.amount, current: past.length, total: f.installment!.total, categoryId: f.categoryId, cardId: f.cardId! };
      })
      .filter((p) => p.current < p.total);
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

  /** vencimento da próxima parcela da dívida */
  debtNextDue(d: Debt, from = new Date()): Date {
    if (d.nextDueMonth) {
      const [y, m] = d.nextDueMonth.split('-').map(Number);
      return new Date(y, m - 1, Math.min(d.dueDay, new Date(y, m, 0).getDate()));
    }
    const today = startOfDay(from);
    const key = monthKey(today);
    const paidThisMonth = this._data().transactions.some((t) => t.debtId === d.id && monthKey(new Date(t.date)) === key);
    const last = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
    if (paidThisMonth) {
      const y = today.getFullYear();
      const m = today.getMonth() + 1;
      return new Date(y, m, Math.min(d.dueDay, last(y, m)));
    }
    return new Date(today.getFullYear(), today.getMonth(), Math.min(d.dueDay, last(today.getFullYear(), today.getMonth())));
  }

  debt(id: string | undefined): Debt | undefined {
    return id ? this.debts().find((d) => d.id === id) : undefined;
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

  /** cria uma compra parcelada no cartão: uma transação por mês */
  addInstallments(t: Omit<Transaction, 'id' | 'createdAt' | 'installment'>, parts: number): Transaction[] {
    const group = uid('ig');
    const each = Math.floor((t.amount / parts) * 100) / 100;
    const first = round2(t.amount - each * (parts - 1));
    const base = new Date(t.date);
    const list: Transaction[] = Array.from({ length: parts }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth() + i, base.getDate(), base.getHours(), base.getMinutes());
      return { ...t, id: uid('t'), amount: i === 0 ? first : each, date: d.toISOString(), createdAt: new Date().toISOString(), installment: { group, index: i + 1, total: parts } };
    });
    this.patch((d) => ({ ...d, transactions: [...list, ...d.transactions] }));
    return list;
  }

  deleteInstallmentGroup(group: string): void {
    this.patch((d) => ({ ...d, transactions: d.transactions.filter((t) => t.installment?.group !== group) }));
  }

  updateTransaction(id: string, p: Partial<Transaction>): void {
    this.patch((d) => ({ ...d, transactions: d.transactions.map((t) => (t.id === id ? { ...t, ...p, id } : t)) }));
  }

  deleteTransaction(id: string): Transaction | undefined {
    const t = this.transaction(id);
    this.patch((d) => ({
      ...d,
      transactions: d.transactions.filter((x) => x.id !== id),
      recurring: t?.recurringId
        ? (d.recurring ?? []).map((r) => (r.id === t.recurringId ? { ...r, skip: [...new Set([...(r.skip ?? []), monthKey(new Date(t.date))])] } : r))
        : d.recurring,
      // excluir o pagamento de uma parcela devolve a parcela à dívida
      debts: t?.debtId ? (d.debts ?? []).map((x) => (x.id === t.debtId ? { ...x, paidInstallments: Math.max(0, x.paidInstallments - 1), nextDueMonth: x.nextDueMonth ? addMonths(x.nextDueMonth, -1) : undefined } : x)) : d.debts,
    }));
    return t;
  }

  restoreTransactionWithDebt(t: Transaction): void {
    this.patch((d) => ({
      ...d,
      transactions: [t, ...d.transactions],
      debts: t.debtId ? (d.debts ?? []).map((x) => (x.id === t.debtId ? { ...x, paidInstallments: Math.min(x.totalInstallments, x.paidInstallments + 1), nextDueMonth: x.nextDueMonth ? addMonths(x.nextDueMonth, 1) : undefined } : x)) : d.debts,
    }));
  }

  restoreTransaction(t: Transaction): void {
    if (t.debtId) return this.restoreTransactionWithDebt(t);
    const k = monthKey(new Date(t.date));
    this.patch((d) => ({
      ...d,
      transactions: [t, ...d.transactions],
      recurring: t.recurringId ? (d.recurring ?? []).map((r) => (r.id === t.recurringId ? { ...r, skip: (r.skip ?? []).filter((x) => x !== k) } : r)) : d.recurring,
    }));
  }

  markPaid(id: string, paid = true): void {
    this.updateTransaction(id, { paid });
  }

  /**
   * Fatura informada manualmente (sem detalhar compras): fica como um único lançamento no cartão.
   * Se já houver uma fatura informada em aberto neste cartão, o valor é atualizado.
   */
  setInvoiceAmount(cardId: string, amount: number): Transaction | undefined {
    const card = this.card(cardId);
    if (!card) return undefined;
    const open = this._data().transactions.find((t) => t.cardId === cardId && !t.invoicePaid && t.importId === `invoice:${cardId}`);
    const others = round2(this.cardOpenAmount(cardId) - (open?.amount ?? 0));
    const value = round2(Math.max(0, amount - others));
    if (open) {
      this.updateTransaction(open.id, { amount: value });
      return this.transaction(open.id);
    }
    if (value <= 0) return undefined;
    const due = this.nextDueDate(card);
    return this.addTransaction({
      type: 'expense', description: `Fatura ${card.name} (valor informado)`, amount: value,
      categoryId: this.category('c_outros_d') ? 'c_outros_d' : (this.categoriesOf('expense')[0]?.id ?? ''),
      accountId: card.accountId, cardId, date: new Date().toISOString(), paid: true, importId: `invoice:${cardId}`,
      notes: `Valor total da fatura com vencimento em ${due.toLocaleDateString('pt-BR')}, informado sem o detalhe das compras.`,
    });
  }

  payCardInvoice(cardId: string): number {
    const amount = this.cardOpenAmount(cardId);
    const cut = this.cardCutoff(cardId);
    this.patch((d) => ({
      ...d,
      transactions: d.transactions.map((t) =>
        t.cardId === cardId && !t.invoicePaid && new Date(t.date).getTime() < cut
          ? { ...t, paid: true, invoicePaid: true, importId: t.importId === `invoice:${cardId}` ? `invoice:${cardId}:${t.id}` : t.importId }
          : t,
      ),
    }));
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
    const existing = b.id ? this.budget(b.id) : this.budgets().find((x) => x.categoryId === b.categoryId && x.month === b.month);
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
      contributions: initial ? [{ id: uid('gc'), amount: round2(initial), date: new Date().toISOString(), note: 'Valor inicial' }] : [],
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
      goals: d.goals.map((g) => {
        if (g.id !== goalId) return g;
        const contributions = [...g.contributions, contribution];
        const saved = contributions.reduce((s, x) => s + x.amount, 0);
        return { ...g, contributions, completedAt: saved >= g.target ? (g.completedAt ?? new Date().toISOString()) : undefined };
      }),
    }));
  }

  removeContribution(goalId: string, contributionId: string): void {
    this.patch((d) => ({
      ...d,
      goals: d.goals.map((g) => {
        if (g.id !== goalId) return g;
        const contributions = g.contributions.filter((c) => c.id !== contributionId);
        const saved = contributions.reduce((s, x) => s + x.amount, 0);
        return { ...g, contributions, completedAt: saved >= g.target ? g.completedAt : undefined };
      }),
    }));
  }

  investment(id: string | undefined): Investment | undefined {
    return id ? this.investments().find((i) => i.id === id) : undefined;
  }

  /** saldo = inicial + aportes + rendimentos − resgates (rendimento pode ser negativo) */
  investmentBalance(i: Investment): number {
    return round2(i.moves.reduce((s, m) => s + (m.type === 'resgate' ? -m.amount : m.amount), i.initialAmount));
  }

  addInvestment(i: Omit<Investment, 'id' | 'createdAt' | 'moves'> & { moves?: InvestmentMove[] }): Investment {
    const inv: Investment = { ...i, initialAmount: round2(i.initialAmount), moves: i.moves ?? [], id: uid('i'), createdAt: new Date().toISOString() };
    this.patch((x) => ({ ...x, investments: [...(x.investments ?? []), inv] }));
    return inv;
  }

  updateInvestment(id: string, p: Partial<Investment>): void {
    this.patch((x) => ({ ...x, investments: (x.investments ?? []).map((i) => (i.id === id ? { ...i, ...p, id } : i)) }));
  }

  deleteInvestment(id: string): void {
    this.patch((x) => ({ ...x, investments: (x.investments ?? []).filter((i) => i.id !== id) }));
  }

  addInvestmentMove(id: string, m: Omit<InvestmentMove, 'id'>): InvestmentMove | undefined {
    const inv = this.investment(id);
    if (!inv || !m.amount) return undefined;
    const move: InvestmentMove = { ...m, amount: round2(m.amount), id: uid('im') };
    this.updateInvestment(id, { moves: [...inv.moves, move] });
    return move;
  }

  removeInvestmentMove(id: string, moveId: string): void {
    const inv = this.investment(id);
    if (inv) this.updateInvestment(id, { moves: inv.moves.filter((m) => m.id !== moveId) });
  }

  /** registra a diferença entre o saldo informado e o calculado como rendimento */
  setInvestmentBalance(id: string, value: number, date = new Date().toISOString()): InvestmentMove | undefined {
    const inv = this.investment(id);
    if (!inv) return undefined;
    const diff = round2(value - this.investmentBalance(inv));
    if (!diff) return undefined;
    return this.addInvestmentMove(id, { type: 'rendimento', amount: diff, date, note: diff > 0 ? 'Rendimento' : 'Desvalorização' });
  }

  addDebt(d: Omit<Debt, 'id' | 'createdAt'>): Debt {
    const debt: Debt = { ...d, installmentAmount: round2(d.installmentAmount), id: uid('d'), createdAt: new Date().toISOString() };
    this.patch((x) => ({ ...x, debts: [...(x.debts ?? []), debt] }));
    return debt;
  }

  updateDebt(id: string, p: Partial<Debt>): void {
    this.patch((x) => ({ ...x, debts: (x.debts ?? []).map((d) => (d.id === id ? { ...d, ...p, id } : d)) }));
  }

  deleteDebt(id: string): void {
    this.patch((x) => ({ ...x, debts: (x.debts ?? []).filter((d) => d.id !== id) }));
  }

  /** paga a próxima parcela: lança a despesa na conta e avança o contador */
  payDebtInstallment(id: string, amount?: number, date = new Date().toISOString(), cardId?: string): Transaction | undefined {
    const d = this.debt(id);
    if (!d || d.paidInstallments >= d.totalInstallments) return undefined;
    const n = d.paidInstallments + 1;
    const tx = this.addTransaction({
      type: 'expense',
      description: `${d.name} — parcela ${n}/${d.totalInstallments}`,
      amount: amount ?? d.installmentAmount,
      categoryId: this.category('c_dividas') ? 'c_dividas' : (this.categoriesOf('expense')[0]?.id ?? 'c_outros_d'),
      accountId: cardId ? (this.card(cardId)?.accountId ?? d.accountId) : d.accountId,
      cardId,
      date,
      paid: true,
      debtId: d.id,
    });
    this.updateDebt(id, { paidInstallments: n, nextDueMonth: d.nextDueMonth ? addMonths(d.nextDueMonth, 1) : undefined });
    return tx;
  }

  // ---------------- Contas fixas / recorrentes ----------------
  recurringRule(id: string | undefined): Recurring | undefined {
    return id ? this.recurring().find((r) => r.id === id) : undefined;
  }

  /**
   * Cria os lançamentos pendentes das regras recorrentes do primeiro mês da regra até o mês seguinte ao atual
   * (assim as contas do começo do próximo mês já aparecem). Nunca duplica e respeita meses excluídos.
   */
  generateRecurring(now = new Date()): number {
    const last = addMonths(monthKey(now), 1);
    const existing = new Set(this._data().transactions.filter((t) => t.recurringId).map((t) => `${t.recurringId}|${monthKey(new Date(t.date))}`));
    const created: Transaction[] = [];
    for (const r of this.recurring()) {
      if (!r.active) continue;
      const end = r.endMonth && r.endMonth < last ? r.endMonth : last;
      for (let k = r.startMonth; k <= end; k = addMonths(k, 1)) {
        if (existing.has(`${r.id}|${k}`) || r.skip?.includes(k)) continue;
        const [y, m] = k.split('-').map(Number);
        const day = Math.min(r.day, new Date(y, m, 0).getDate());
        const date = new Date(y, m - 1, day, 9, 0).toISOString();
        created.push({
          id: uid('t'), type: r.type, description: r.description, amount: r.amount, categoryId: r.categoryId, accountId: r.accountId,
          cardId: r.cardId, date, paid: false, recurringId: r.id, createdAt: new Date().toISOString(),
        });
      }
    }
    if (created.length) this.patch((d) => ({ ...d, transactions: [...created, ...d.transactions] }));
    return created.length;
  }

  addRecurring(r: Omit<Recurring, 'id' | 'createdAt'>): Recurring {
    const rule: Recurring = { ...r, amount: round2(r.amount), id: uid('r'), createdAt: new Date().toISOString() };
    this.patch((d) => ({ ...d, recurring: [...(d.recurring ?? []), rule] }));
    return rule;
  }

  /** altera a regra; lançamentos futuros ainda pendentes acompanham a mudança */
  updateRecurring(id: string, p: Partial<Recurring>): void {
    const cur = monthKey(new Date());
    this.patch((d) => {
      const rule = { ...(d.recurring ?? []).find((r) => r.id === id)!, ...p, id };
      return {
        ...d,
        recurring: (d.recurring ?? []).map((r) => (r.id === id ? rule : r)),
        transactions: d.transactions
          .filter((t) => !(t.recurringId === id && !t.paid && monthKey(new Date(t.date)) >= cur && (!rule.active || (rule.endMonth && monthKey(new Date(t.date)) > rule.endMonth))))
          .map((t) => {
            if (t.recurringId !== id || t.paid || monthKey(new Date(t.date)) < cur) return t;
            const dt = new Date(t.date);
            const day = Math.min(rule.day, new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate());
            return { ...t, description: rule.description, amount: rule.amount, categoryId: rule.categoryId, accountId: rule.accountId, cardId: rule.cardId, type: rule.type, date: new Date(dt.getFullYear(), dt.getMonth(), day, 9, 0).toISOString() };
          }),
      };
    });
    this.generateRecurring();
  }

  /** remove a regra e os lançamentos dela ainda pendentes (os já pagos ficam no histórico) */
  deleteRecurring(id: string): void {
    this.patch((d) => ({
      ...d,
      recurring: (d.recurring ?? []).filter((r) => r.id !== id),
      transactions: d.transactions.filter((t) => !(t.recurringId === id && !t.paid)),
    }));
  }

  /** importa lançamentos de extrato, ignorando os que já existem (importId) */
  importTransactions(list: Omit<Transaction, 'id' | 'createdAt'>[]): number {
    const existing = new Set(this._data().transactions.map((t) => t.importId).filter(Boolean));
    const now = new Date().toISOString();
    const fresh = list
      .filter((t) => !t.importId || !existing.has(t.importId))
      .map((t) => ({ ...t, amount: round2(t.amount), id: uid('t'), createdAt: now }) as Transaction);
    if (fresh.length) this.patch((d) => ({ ...d, transactions: [...fresh, ...d.transactions] }));
    return fresh.length;
  }

  hasImportId(id: string): boolean {
    return this._data().transactions.some((t) => t.importId === id);
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
    this.generateRecurring();
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
      debts: [],
      investments: [],
      recurring: [],
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
      const d = this.migrate(JSON.parse(json) as AppData);
      if (!d) return false;
      // o backup não troca a sessão/senha deste aparelho
      const s = this.settings();
      const raw = (JSON.parse(json) as AppData).settings ?? {};
      d.settings = {
        ...d.settings,
        loggedIn: s.loggedIn,
        email: raw.passwordHash ? d.settings.email : s.email,
        passwordHash: raw.passwordHash ?? s.passwordHash,
        hasLoggedBefore: raw.passwordHash ? d.settings.hasLoggedBefore : s.hasLoggedBefore,
        faceId: raw.passwordHash ? d.settings.faceId : s.faceId,
        onboarded: true,
        lastActiveAt: new Date().toISOString(),
      };
      this._data.set(d);
      this.generateRecurring();
      return true;
    } catch {
      return false;
    }
  }
}
