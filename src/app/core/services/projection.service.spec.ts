import { TestBed } from '@angular/core/testing';
import { AppData } from '../models/models';
import { addMonths, monthKey } from '../utils/format';
import { ProjectionService } from './projection.service';
import { StoreService } from './store.service';

describe('ProjectionService', () => {
  let store: StoreService;
  let proj: ProjectionService;
  const cur = monthKey(new Date());

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(StoreService);
    proj = TestBed.inject(ProjectionService);
    // cenário enxuto: salário recorrente, uma conta fixa e um acordo de 3 parcelas a partir do mês que vem
    const d = store.data();
    const clean: AppData = {
      ...d,
      transactions: [],
      cards: [],
      goals: [],
      budgets: [],
      debts: [{ id: 'd1', name: 'Acordo', creditor: 'Nubank', kind: 'acordo', installmentAmount: 1000, totalInstallments: 12, paidInstallments: 9, dueDay: 4, nextDueMonth: addMonths(cur, 1), accountId: 'a_nubank', createdAt: '' }],
      recurring: [
        { id: 'r1', type: 'income', description: 'Salário', amount: 6000, categoryId: 'c_salario', accountId: 'a_nubank', day: 25, startMonth: addMonths(cur, 1), active: true, createdAt: '' },
        { id: 'r2', type: 'expense', description: 'Claro', amount: 200, categoryId: 'c_moradia', accountId: 'a_nubank', day: 5, startMonth: addMonths(cur, 1), active: true, createdAt: '' },
      ],
    };
    store.importJson(JSON.stringify(clean));
  });

  it('projeta receitas, contas fixas e parcelas mês a mês', () => {
    const m = proj.project(6);
    expect(m[1].income).toBe(6000);
    expect(m[1].fixed).toBe(200);
    expect(m[1].debts).toBe(1000);
    expect(m[1].net).toBe(4800);
  });

  it('a dívida para depois da última parcela', () => {
    const m = proj.project(6);
    expect(m[3].debts).toBe(1000); // 3ª e última parcela
    expect(m[4].debts).toBe(0);
    expect(proj.milestones()[0].lastMonth).toBe(addMonths(cur, 3));
  });

  it('saldo acumulado soma as sobras', () => {
    const m = proj.project(3);
    expect(m[2].balance).toBeCloseTo(m[1].balance + m[2].net, 2);
  });
});

describe('ProjectionService · cartões', () => {
  it('fatura futura = parcelas lançadas + compras novas previstas', () => {
    TestBed.configureTestingModule({});
    const store = TestBed.inject(StoreService);
    const proj = TestBed.inject(ProjectionService);
    const cur = monthKey(new Date());
    const [y, m] = addMonths(cur, 1).split('-').map(Number);
    const d = store.data();
    store.importJson(JSON.stringify({
      ...d, debts: [], recurring: [], goals: [], budgets: [],
      cards: [{ id: 'k1', name: 'PF', bank: 'Nubank', tier: '', brand: 'Mastercard', last4: '0000', limit: 0, closingDay: 6, dueDay: 13, theme: 'roxo', accountId: 'a_nubank', monthlySpendEstimate: 300 }],
      // parcela lançada no dia 7 do mês que vem → fatura que vence dois meses à frente
      transactions: [{ id: 't1', type: 'expense', description: 'Terabyte', amount: 296.54, categoryId: 'c_compras', accountId: 'a_nubank', cardId: 'k1', date: new Date(y, m - 1, 7, 12).toISOString(), paid: true, createdAt: '', installment: { group: 'g', index: 8, total: 12 } }],
    }));
    const p = proj.project(4);
    expect(p[2].cards).toBeCloseTo(296.54 + 300, 2);
    expect(p[2].cardsEstimated).toBeTrue();
  });
});
