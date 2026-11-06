import { Injectable, computed, inject } from '@angular/core';
import { CreditCard, Debt, Transaction } from '../models/models';
import { addMonths, monthKey, round2 } from '../utils/format';
import { StoreService } from './store.service';

export interface ProjectionItem {
  label: string;
  amount: number;
  kind: 'income' | 'fixed' | 'debt' | 'card' | 'other';
  /** valor estimado (média), não um lançamento conhecido */
  estimated?: boolean;
  /** "3/12" para parcelas */
  detail?: string;
}

export interface MonthProjection {
  key: string;
  income: number;
  fixed: number;
  debts: number;
  cards: number;
  other: number;
  expenses: number;
  net: number;
  /** saldo acumulado previsto ao fim do mês */
  balance: number;
  cardsEstimated: boolean;
  items: ProjectionItem[];
}

export interface DebtMilestone {
  name: string;
  lastMonth: string;
  monthlyFreed: number;
}

/**
 * Previsão dos próximos meses a partir do que o app já sabe:
 * lançamentos do mês, contas fixas/receitas recorrentes, parcelas de dívidas (até acabarem)
 * e faturas dos cartões (parcelas agendadas; sem compras lançadas, usa a média das faturas).
 */
@Injectable({ providedIn: 'root' })
export class ProjectionService {
  private readonly store = inject(StoreService);

  /** mês de vencimento da fatura em que uma compra cai, conforme fechamento e vencimento do cartão */
  cardDueMonth(card: CreditCard, iso: string): string {
    const d = new Date(iso);
    let k = monthKey(d);
    if (d.getDate() >= card.closingDay) k = addMonths(k, 1);
    return card.dueDay > card.closingDay ? k : addMonths(k, 1);
  }

  /** meses (YYYY-MM) em que vencem as parcelas ainda não pagas */
  debtSchedule(d: Debt): string[] {
    const remaining = Math.max(0, d.totalInstallments - d.paidInstallments);
    const first = d.nextDueMonth ?? monthKey(this.store.debtNextDue(d));
    return Array.from({ length: remaining }, (_, i) => addMonths(first, i));
  }

  /** média das faturas dos últimos meses com dados (por mês de vencimento) */
  cardAverage(card: CreditCard): number {
    const cur = monthKey(new Date());
    const totals = new Map<string, number>();
    for (const t of this.store.transactions()) {
      if (t.cardId !== card.id || t.type !== 'expense' || t.installment) continue;
      const due = this.cardDueMonth(card, t.date);
      if (due > addMonths(cur, 1) || due < addMonths(cur, -3)) continue;
      totals.set(due, (totals.get(due) ?? 0) + t.amount);
    }
    const vals = [...totals.values()].filter((v) => v > 0);
    return vals.length ? round2(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
  }

  readonly months = computed<MonthProjection[]>(() => this.project(12));

  readonly milestones = computed<DebtMilestone[]>(() =>
    this.store
      .debts()
      .map((d) => ({ d, sched: this.debtSchedule(d) }))
      .filter((x) => x.sched.length)
      .map((x) => ({ name: x.d.name, lastMonth: x.sched.at(-1)!, monthlyFreed: x.d.installmentAmount }))
      .sort((a, b) => a.lastMonth.localeCompare(b.lastMonth)),
  );

  project(n: number, from = monthKey(new Date())): MonthProjection[] {
    const txs = this.store.transactions();
    const rules = this.store.recurring();
    const debts = this.store.debts();
    const cards = this.store.cards();
    const schedules = new Map(debts.map((d) => [d.id, this.debtSchedule(d)]));
    const avg = new Map(cards.map((c) => [c.id, this.cardAverage(c)]));
    const out: MonthProjection[] = [];
    let balance = this.store.totalBalance();
    // pendências já vencidas entram no primeiro mês da previsão
    const overdue = txs.filter((t) => !t.paid && !t.cardId && monthKey(new Date(t.date)) < from);

    for (let i = 0; i < n; i++) {
      const k = addMonths(from, i);
      const items: ProjectionItem[] = [];
      const inMonth = txs.filter((t) => !t.cardId && monthKey(new Date(t.date)) === k);
      const list: Transaction[] = i === 0 ? [...inMonth, ...overdue] : inMonth;
      // no mês atual só conta o que ainda vai acontecer (pendente); o saldo já reflete o que foi pago
      for (const t of list) {
        if (i === 0 && t.paid) continue;
        const kind: ProjectionItem['kind'] = t.type === 'income' ? 'income' : t.debtId ? 'debt' : t.recurringId ? 'fixed' : 'other';
        items.push({ label: t.description, amount: t.amount, kind });
      }
      // contas fixas ainda não geradas para o mês
      for (const r of rules) {
        if (!r.active || r.startMonth > k || (r.endMonth && r.endMonth < k) || r.skip?.includes(k) || r.cardId) continue;
        if (txs.some((t) => t.recurringId === r.id && monthKey(new Date(t.date)) === k)) continue;
        items.push({ label: r.description, amount: r.amount, kind: r.type === 'income' ? 'income' : 'fixed' });
      }
      // parcelas de dívidas que vencem no mês
      for (const d of debts) {
        const sched = schedules.get(d.id) ?? [];
        const idx = sched.indexOf(k);
        if (idx < 0) continue;
        items.push({ label: d.name, amount: d.installmentAmount, kind: 'debt', detail: `${d.paidInstallments + idx + 1}/${d.totalInstallments}` });
      }
      // faturas dos cartões que vencem no mês
      let cardsEstimated = false;
      for (const c of cards) {
        const known = round2(
          txs.filter((t) => t.cardId === c.id && t.type === 'expense' && !t.invoicePaid && this.cardDueMonth(c, t.date) === k).reduce((s, t) => s + t.amount, 0),
        );
        const fixedOnCard = rules
          .filter((r) => r.cardId === c.id && r.active && r.startMonth <= k && (!r.endMonth || r.endMonth >= k))
          .filter((r) => !txs.some((t) => t.recurringId === r.id && this.cardDueMonth(c, t.date) === k))
          .reduce((s, r) => s + r.amount, 0);
        const firstDue = monthKey(this.store.nextDueDate(c));
        const base = round2(known + fixedOnCard);
        const estimate = avg.get(c.id) ?? 0;
        // faturas futuras sem compras lançadas: usa a média (as parcelas já conhecidas entram no mínimo)
        const useAvg = k > firstDue && estimate > base;
        const amount = useAvg ? estimate : base;
        if (amount <= 0) continue;
        cardsEstimated ||= useAvg;
        items.push({ label: `Fatura ${c.name}`, amount, kind: 'card', estimated: useAvg });
      }
      const sum = (kind: ProjectionItem['kind']) => round2(items.filter((x) => x.kind === kind).reduce((s, x) => s + x.amount, 0));
      const income = sum('income');
      const fixed = sum('fixed');
      const debtsTotal = sum('debt');
      const cardsTotal = sum('card');
      const other = sum('other');
      const expenses = round2(fixed + debtsTotal + cardsTotal + other);
      const net = round2(income - expenses);
      balance = round2(balance + net);
      out.push({ key: k, income, fixed, debts: debtsTotal, cards: cardsTotal, other, expenses, net, balance, cardsEstimated, items: items.sort((a, b) => b.amount - a.amount) });
    }
    return out;
  }
}
