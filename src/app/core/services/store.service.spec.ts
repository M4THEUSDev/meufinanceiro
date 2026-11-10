import { TestBed } from '@angular/core/testing';
import { addMonths, monthKey } from '../utils/format';
import { StoreService, defaultFilters } from './store.service';

describe('StoreService', () => {
  let store: StoreService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
  });

  it('seed bate com os saldos do design', () => {
    expect(store.balanceOf('a_nubank')).toBeCloseTo(8240.15, 2);
    expect(store.balanceOf('a_itau')).toBeCloseTo(5932.6, 2);
    expect(store.totalBalance()).toBeCloseTo(24583.4, 2);
  });

  it('receitas do mês somam salário + freela', () => {
    expect(store.summary(monthKey(new Date())).income).toBeCloseTo(9850, 2);
  });

  it('adicionar despesa paga reduz o saldo da conta', () => {
    const before = store.balanceOf('a_nubank');
    store.addTransaction({ type: 'expense', description: 'Teste', amount: 100, categoryId: 'c_lazer', accountId: 'a_nubank', date: new Date().toISOString(), paid: true });
    expect(store.balanceOf('a_nubank')).toBeCloseTo(before - 100, 2);
  });

  it('despesa pendente não afeta o saldo', () => {
    const before = store.balanceOf('a_nubank');
    store.addTransaction({ type: 'expense', description: 'Boleto', amount: 50, categoryId: 'c_lazer', accountId: 'a_nubank', date: new Date().toISOString(), paid: false });
    expect(store.balanceOf('a_nubank')).toBeCloseTo(before, 2);
  });

  it('compras no cartão só afetam a conta após pagar a fatura', () => {
    const before = store.balanceOf('a_itau');
    const open = store.cardOpenAmount('k_platinum');
    expect(open).toBeGreaterThan(0);
    store.payCardInvoice('k_platinum');
    expect(store.cardOpenAmount('k_platinum')).toBe(0);
    expect(store.balanceOf('a_itau')).toBeCloseTo(before - open, 2);
  });

  it('parcelamento cria uma transação por mês somando o total', () => {
    const list = store.addInstallments(
      { type: 'expense', description: 'TV', amount: 1000, categoryId: 'c_compras', accountId: 'a_itau', cardId: 'k_platinum', date: new Date().toISOString(), paid: true },
      3,
    );
    expect(list.length).toBe(3);
    expect(list.reduce((s, t) => s + t.amount, 0)).toBeCloseTo(1000, 2);
    expect(store.installmentPlans('k_platinum').some((p) => p.description === 'TV' && p.total === 3)).toBeTrue();
  });

  it('filtra por tipo, categoria e busca', () => {
    const f = { ...defaultFilters(), type: 'expense' as const, categoryIds: ['c_alimentacao'] };
    const list = store.filterTransactions(f);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((t) => t.type === 'expense' && t.categoryId === 'c_alimentacao')).toBeTrue();
    const search = store.filterTransactions({ ...defaultFilters(), search: 'uber' });
    expect(search.some((t) => t.description === 'Uber')).toBeTrue();
    const byValue = store.filterTransactions({ ...defaultFilters(), search: '23,40' });
    expect(byValue.some((t) => t.description === 'Uber')).toBeTrue();
  });

  it('orçamentos vigentes e cópia do mês anterior', () => {
    const key = monthKey(new Date());
    expect(store.budgetsFor(key).length).toBe(7);
    store.saveBudget({ categoryId: 'c_lazer', limit: 350, alertAt: 80, recurring: false, month: key });
    expect(store.budgetsFor(key).find((b) => b.categoryId === 'c_lazer')?.limit).toBe(350);
  });

  it('contribuição conclui a meta ao atingir o objetivo', () => {
    const g = store.goal('g_notebook')!;
    store.addContribution(g.id, { amount: g.target - store.goalSaved(g), date: new Date().toISOString() });
    expect(store.goal(g.id)!.completedAt).toBeTruthy();
  });
});

describe('StoreService · dívidas e importação', () => {
  let store: StoreService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
  });

  it('pagar parcela lança despesa, avança o contador e desfazer devolve', () => {
    const before = store.debt('d_carro')!.paidInstallments;
    const bal = store.balanceOf('a_itau');
    const tx = store.payDebtInstallment('d_carro')!;
    expect(store.debt('d_carro')!.paidInstallments).toBe(before + 1);
    expect(store.balanceOf('a_itau')).toBeCloseTo(bal - 890, 2);
    store.deleteTransaction(tx.id);
    expect(store.debt('d_carro')!.paidInstallments).toBe(before);
  });

  it('saldo devedor e patrimônio líquido', () => {
    const d = store.debt('d_carro')!;
    const loan = store.debtSummary().loans.find((l) => l.id === 'd_carro')!;
    expect(loan.total).toBeCloseTo((d.totalInstallments - d.paidInstallments) * d.installmentAmount, 2);
    expect(store.netWorth()).toBeCloseTo(store.totalBalance() + store.investmentTotals().mine - store.debtSummary().total, 2);
  });

  it('importação ignora lançamentos repetidos', () => {
    const line = { type: 'expense' as const, description: 'Padaria', amount: 10, categoryId: 'c_alimentacao', accountId: 'a_nubank', date: new Date().toISOString(), paid: true, importId: 'nuconta:x1' };
    expect(store.importTransactions([line])).toBe(1);
    expect(store.importTransactions([line])).toBe(0);
  });
});

describe('StoreService · recorrências, fechamento do cartão e acordos', () => {
  let store: StoreService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
  });

  it('conta fixa gera lançamento pendente por mês, sem duplicar e respeitando exclusões', () => {
    store.generateRecurring(); // recorrências dos dados de exemplo
    const r = store.addRecurring({ type: 'expense', description: 'Claro', amount: 232, categoryId: 'c_moradia', accountId: 'a_nubank', day: 5, startMonth: monthKey(new Date()), active: true });
    const n = store.generateRecurring();
    expect(n).toBe(2); // mês atual + próximo
    expect(store.generateRecurring()).toBe(0);
    const occ = store.transactions().filter((t) => t.recurringId === r.id);
    expect(occ.every((t) => !t.paid && t.amount === 232)).toBeTrue();
    store.deleteTransaction(occ[0].id);
    expect(store.generateRecurring()).toBe(0);
  });

  it('compra feita no dia do fechamento vai para a próxima fatura', () => {
    const today = new Date();
    store.updateCard('k_black', { closingDay: today.getDate(), dueDay: ((today.getDate() + 6) % 28) + 1 });
    const before = store.cardOpenAmount('k_black');
    store.addTransaction({ type: 'expense', description: 'Pix no crédito', amount: 200, categoryId: 'c_outros_d', accountId: 'a_itau', cardId: 'k_black', date: today.toISOString(), paid: true });
    expect(store.cardOpenAmount('k_black')).toBeCloseTo(before, 2);
    expect(store.cardFutureAmount('k_black')).toBeGreaterThanOrEqual(200);
  });

  it('dívida com próxima parcela em outro mês vence no mês certo e avança ao pagar', () => {
    const next = addMonths(monthKey(new Date()), 1);
    const d = store.addDebt({ name: 'Acordo', creditor: 'Nubank', kind: 'acordo', installmentAmount: 1000, totalInstallments: 12, paidInstallments: 8, dueDay: 4, accountId: 'a_nubank', nextDueMonth: next });
    expect(monthKey(store.debtNextDue(d))).toBe(next);
    const tx = store.payDebtInstallment(d.id)!;
    expect(store.debt(d.id)!.nextDueMonth).toBe(addMonths(next, 1));
    store.deleteTransaction(tx.id);
    expect(store.debt(d.id)!.nextDueMonth).toBe(next);
  });
});

describe('StoreService · saldo devedor informado', () => {
  it('usa o saldo informado pelo credor no lugar de parcelas × valor', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(StoreService);
    const d = store.addDebt({ name: 'Empréstimo', creditor: 'Banco', kind: 'emprestimo', installmentAmount: 577, totalInstallments: 10, paidInstallments: 0, dueDay: 10, accountId: 'a_nubank', payoffAmount: 3042.74 });
    const l = store.debtSummary().loans.find((x) => x.id === d.id)!;
    expect(l.total).toBe(3042.74);
    expect(l.byInstallments).toBe(5770);
  });

  it('investimento: saldo considera resgates e entra no patrimônio só se for seu', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(StoreService);
    const net0 = store.netWorth();
    const mae = store.addInvestment({ name: 'Investimento Mãe', mine: false, icon: 'heart-outline', color: 'lazer', initialAmount: 18787.73, initialDate: '2026-09-30T12:00:00.000Z' });
    store.addInvestmentMove(mae.id, { type: 'resgate', amount: 200, date: '2026-10-01T12:00:00.000Z' });
    store.addInvestmentMove(mae.id, { type: 'resgate', amount: 1000, date: '2026-10-16T12:00:00.000Z' });
    expect(store.investmentBalance(store.investment(mae.id)!)).toBe(17587.73);
    expect(store.netWorth()).toBe(net0);
    const meu = store.addInvestment({ name: 'Meu investimento', mine: true, icon: 'trending-up-outline', color: 'rendimentos', initialAmount: 12347.12, initialDate: '2026-11-10T12:00:00.000Z' });
    expect(store.netWorth()).toBe(Math.round((net0 + 12347.12) * 100) / 100);
    const m = store.setInvestmentBalance(meu.id, 12400);
    expect(m?.type).toBe('rendimento');
    expect(m?.amount).toBe(52.88);
    expect(store.investmentBalance(store.investment(meu.id)!)).toBe(12400);
  });
});
