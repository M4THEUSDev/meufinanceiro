import { TestBed } from '@angular/core/testing';
import { monthKey } from '../utils/format';
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
    expect(store.netWorth()).toBeCloseTo(store.totalBalance() - store.debtSummary().total, 2);
  });

  it('importação ignora lançamentos repetidos', () => {
    const line = { type: 'expense' as const, description: 'Padaria', amount: 10, categoryId: 'c_alimentacao', accountId: 'a_nubank', date: new Date().toISOString(), paid: true, importId: 'nuconta:x1' };
    expect(store.importTransactions([line])).toBe(1);
    expect(store.importTransactions([line])).toBe(0);
  });
});
