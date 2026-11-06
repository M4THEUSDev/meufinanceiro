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
