import { Account, AppData, Budget, Category, CreditCard, Debt, Goal, Transaction } from '../models/models';
import { addMonths, monthKey, round2 } from '../utils/format';

export const DATA_VERSION = 5;

export const DEFAULT_CATEGORIES: Category[] = [
  // Despesas (padrão)
  { id: 'c_moradia', name: 'Moradia', type: 'expense', icon: 'home-outline', color: 'moradia' },
  { id: 'c_alimentacao', name: 'Alimentação', type: 'expense', icon: 'restaurant-outline', color: 'alimentacao' },
  { id: 'c_transporte', name: 'Transporte', type: 'expense', icon: 'car-outline', color: 'transporte' },
  { id: 'c_saude', name: 'Saúde', type: 'expense', icon: 'medkit-outline', color: 'saude' },
  { id: 'c_educacao', name: 'Educação', type: 'expense', icon: 'school-outline', color: 'educacao' },
  { id: 'c_assinaturas', name: 'Assinaturas', type: 'expense', icon: 'tv-outline', color: 'assinaturas' },
  { id: 'c_lazer', name: 'Lazer', type: 'expense', icon: 'game-controller-outline', color: 'lazer' },
  { id: 'c_compras', name: 'Compras', type: 'expense', icon: 'bag-handle-outline', color: 'compras' },
  { id: 'c_dividas', name: 'Dívidas e empréstimos', type: 'expense', icon: 'cash-outline', color: 'saude' },
  { id: 'c_outros_d', name: 'Outros', type: 'expense', icon: 'ellipsis-horizontal-circle-outline', color: 'outros' },
  // Receitas (padrão)
  { id: 'c_salario', name: 'Salário', type: 'income', icon: 'briefcase-outline', color: 'salario' },
  { id: 'c_extra', name: 'Trabalho extra', type: 'income', icon: 'laptop-outline', color: 'extra' },
  { id: 'c_reembolso', name: 'Reembolso', type: 'income', icon: 'return-down-back-outline', color: 'reembolso' },
  { id: 'c_rendimentos', name: 'Rendimentos', type: 'income', icon: 'trending-up-outline', color: 'rendimentos' },
  { id: 'c_outros_r', name: 'Outros', type: 'income', icon: 'ellipsis-horizontal-circle-outline', color: 'outros' },
];

const SEED_CUSTOM: Category[] = [
  { id: 'c_pets', name: 'Pets', type: 'expense', icon: 'leaf-outline', color: 'rendimentos', custom: true },
  { id: 'c_presentes', name: 'Presentes', type: 'expense', icon: 'sparkles-outline', color: 'assinaturas', custom: true },
];

/** gerador determinístico (mulberry32) para que o seed seja estável */
function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** divide `total` em `n` parcelas aleatórias que somam exatamente o total */
function split(total: number, n: number, rand: () => number): number[] {
  if (n <= 1) return [round2(total)];
  const w = Array.from({ length: n }, () => 0.4 + rand());
  const sum = w.reduce((a, b) => a + b, 0);
  const parts = w.map((x) => round2((x / sum) * total));
  const diff = round2(total - parts.reduce((a, b) => a + b, 0));
  parts[0] = round2(parts[0] + diff);
  return parts;
}

const FILLER: Record<string, string[]> = {
  c_moradia: ['Aluguel', 'Condomínio'],
  c_alimentacao: ['Padaria Real', 'Restaurante Coco Bambu', 'Hortifruti', 'Starbucks', 'Mercado Extra', 'Burger King', 'Feira livre'],
  c_transporte: ['99 Pop', 'Posto Shell', 'Estacionamento', 'Uber', 'Bilhete Único'],
  c_saude: ['Consulta dermatologista', 'Drogaria São Paulo', 'Academia SmartFit'],
  c_educacao: ['Curso de inglês', 'Alura'],
  c_assinaturas: ['Spotify', 'iCloud+', 'Amazon Prime', 'YouTube Premium'],
  c_lazer: ['Bar do Zé', 'Show no Allianz', 'Steam', 'Parque Ibirapuera'],
  c_compras: ['Renner', 'Mercado Livre', 'Shopee', 'Leroy Merlin', 'Zara'],
  c_pets: ['Petz — ração', 'Banho e tosa', 'Veterinário'],
  c_presentes: ['Presente aniversário'],
};

const ACCOUNT_FOR: Record<string, string> = {
  c_moradia: 'a_itau', c_alimentacao: 'a_nubank', c_transporte: 'a_nubank', c_saude: 'a_nubank',
  c_educacao: 'a_itau', c_assinaturas: 'a_nubank', c_lazer: 'a_nubank', c_compras: 'a_nubank',
  c_pets: 'a_carteira', c_presentes: 'a_carteira',
};

/** totais e quantidades do mês corrente (Figma · Categorias / Dashboard) */
const CURRENT_MONTH: Record<string, { total: number; count: number }> = {
  c_moradia: { total: 2150, count: 3 },
  c_alimentacao: { total: 612.4, count: 23 },
  c_transporte: { total: 452.8, count: 14 },
  c_saude: { total: 410, count: 3 },
  c_educacao: { total: 547, count: 2 },
  c_assinaturas: { total: 214, count: 5 },
  c_lazer: { total: 276, count: 6 },
  c_compras: { total: 1552.17, count: 9 },
};

/** receitas e despesas dos 5 meses anteriores (gráfico Receitas x Despesas) */
const HISTORY = [
  { income: 9200, expense: 8100 },
  { income: 8700, expense: 7200 },
  { income: 8700, expense: 6600 },
  { income: 9000, expense: 6900 },
  { income: 8950, expense: 7100 },
  { income: 9300, expense: 6700 },
  { income: 8900, expense: 6800 },
  { income: 9100, expense: 7250 },
  { income: 8750, expense: 6100 },
  { income: 9400, expense: 6900 },
  { income: 8800, expense: 6400 },
];

const SHARE: Record<string, number> = {
  c_moradia: 0.34, c_alimentacao: 0.11, c_transporte: 0.08, c_saude: 0.06, c_educacao: 0.08,
  c_assinaturas: 0.035, c_lazer: 0.055, c_compras: 0.2, c_pets: 0.025, c_presentes: 0.015,
};

const TARGET_BALANCES: Record<string, number> = {
  a_nubank: 8240.15, a_itau: 5932.6, a_caixa: 9870, a_carteira: 540.65, a_inter: 0,
};

export function buildSeed(now = new Date()): AppData {
  const rand = rng(20261126);
  const created = new Date(now.getFullYear(), now.getMonth() - 12, 1).toISOString();
  const accounts: Account[] = [
    { id: 'a_nubank', name: 'Nubank', kind: 'digital', detail: 'ag. 0001', icon: 'phone-portrait-outline', color: 'educacao', initialBalance: 0, active: true, includeInTotal: true, createdAt: created },
    { id: 'a_itau', name: 'Itaú', kind: 'corrente', detail: 'ag. 1234', icon: 'business-outline', color: 'alimentacao', initialBalance: 0, active: true, includeInTotal: true, createdAt: created },
    { id: 'a_caixa', name: 'Caixa Poupança', kind: 'poupanca', icon: 'leaf-outline', color: 'extra', initialBalance: 0, active: true, includeInTotal: true, createdAt: created },
    { id: 'a_carteira', name: 'Carteira', kind: 'dinheiro', icon: 'cash-outline', color: 'salario', initialBalance: 0, active: true, includeInTotal: true, createdAt: created },
    { id: 'a_inter', name: 'Inter', kind: 'digital', detail: 'encerrada', icon: 'phone-portrait-outline', color: 'outros', initialBalance: 0, active: false, includeInTotal: false, createdAt: created },
  ];

  const cards: CreditCard[] = [
    { id: 'k_platinum', name: 'Cartão Platinum', bank: 'Banco Digital', tier: 'Platinum', brand: 'Mastercard', last4: '4821', limit: 12000, closingDay: 3, dueDay: 10, theme: 'platinum', accountId: 'a_itau' },
    { id: 'k_black', name: 'Cartão Black', bank: 'Banco Tradicional', tier: 'Black', brand: 'Visa', last4: '0937', limit: 20000, closingDay: 8, dueDay: 15, theme: 'grafite', accountId: 'a_itau' },
  ];

  const tx: Transaction[] = [];
  const mk = (p: Partial<Transaction> & Pick<Transaction, 'type' | 'description' | 'amount' | 'categoryId' | 'accountId' | 'date'>) => {
    tx.push({ id: `t_${tx.length + 1}`, paid: true, createdAt: p.date, ...p });
  };
  const at = (base: Date, dayOffset: number, h: number, m: number) => {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dayOffset, h, m);
    return d.toISOString();
  };
  const dayInMonth = (mk_: string, day: number, h = 12, m = 0) => {
    const [y, mo] = mk_.split('-').map(Number);
    const last = new Date(y, mo, 0).getDate();
    return new Date(y, mo - 1, Math.min(day, last), h, m).toISOString();
  };

  const curKey = monthKey(now);
  const today = now.getDate();

  // ---------- Meses anteriores ----------
  HISTORY.forEach((h, i) => {
    const key = addMonths(curKey, i - HISTORY.length);
    // receitas
    mk({ type: 'income', description: 'Salário — Acme Ltda', amount: 8650, categoryId: 'c_salario', accountId: 'a_itau', date: dayInMonth(key, 5, 9, 0) });
    const extra = round2(h.income - 8650);
    if (extra > 0) {
      mk({ type: 'income', description: i % 2 ? 'Rendimento poupança' : 'Freela — Landing page', amount: extra, categoryId: i % 2 ? 'c_rendimentos' : 'c_extra', accountId: i % 2 ? 'a_caixa' : 'a_nubank', date: dayInMonth(key, 18, 14, 20) });
    }
    // despesas
    Object.entries(SHARE).forEach(([cat, share]) => {
      const total = round2(h.expense * share);
      const n = cat === 'c_moradia' ? 2 : Math.max(1, Math.round(share * 30));
      const parts = cat === 'c_moradia' ? [round2(total * 0.78), round2(total - round2(total * 0.78))] : split(total, n, rand);
      parts.forEach((amount, j) => {
        const names = FILLER[cat];
        const desc = cat === 'c_moradia' ? names[j % names.length] : names[Math.floor(rand() * names.length)];
        mk({ type: 'expense', description: desc, amount, categoryId: cat, accountId: ACCOUNT_FOR[cat], date: dayInMonth(key, 1 + Math.floor(rand() * 28), 8 + Math.floor(rand() * 13), Math.floor(rand() * 60)) });
      });
    });
  });

  // ---------- Mês corrente ----------
  const day = (n: number) => Math.max(1, Math.min(today, n));
  // Receitas: salário + freela pendente = 9.850,00
  mk({ type: 'income', description: 'Salário — Acme Ltda', amount: 8650, categoryId: 'c_salario', accountId: 'a_itau', date: dayInMonth(curKey, day(5), 9, 0) });
  mk({ type: 'income', description: 'Freela — Identidade visual', amount: 1200, categoryId: 'c_extra', accountId: 'a_nubank', date: at(now, -1, 16, 30), paid: false, notes: 'Aguardando transferência do cliente.' });

  // Transações nomeadas (Figma · Transações · Lista)
  const named: Array<[string, string, number, number, number, number, Partial<Transaction>?]> = [
    // [categoria, descrição, valor, dias atrás, h, m]
    ['c_transporte', 'Uber', 23.4, 0, 8, 42],
    ['c_alimentacao', 'iFood', 58.9, 0, 12, 15, { cardId: 'k_platinum' }],
    ['c_alimentacao', 'Mercado Pão de Açúcar', 89.9, 1, 19, 4, { notes: 'Compra do mês: hortifruti, limpeza e itens de café da manhã.' }],
    ['c_saude', 'Drogasil', 72.35, 2, 10, 20],
    ['c_assinaturas', 'Netflix', 39.9, 2, 7, 0],
    ['c_compras', 'Amazon — Fone de ouvido', 329, 4, 21, 10, { cardId: 'k_platinum' }],
    ['c_lazer', 'Cinema Kinoplex', 59, 4, 20, 0],
    ['c_moradia', 'Aluguel', 1663.58, 25, 9, 0],
    ['c_moradia', 'Conta de luz', 186.42, 2, 10, 0, { paid: false }],
    ['c_moradia', 'Condomínio', 300, 25, 9, 5],
    ['c_educacao', 'Curso de inglês', 397, 20, 10, 0],
    ['c_educacao', 'Alura', 150, 20, 10, 5],
    // contas a vencer (pendentes)
    ['c_assinaturas', 'Internet Fibra', 119.9, -2, 10, 0, { paid: false }],
  ];
  const usedTotals: Record<string, { total: number; count: number }> = {};
  named.forEach(([cat, desc, amount, ago, h, m, extra]) => {
    const isFixed = ago >= 20;
    if (ago < 0) {
      mk({ type: 'expense', description: desc, amount, categoryId: cat, accountId: 'a_itau', date: at(now, -ago, h, m), ...(extra ?? {}) });
      usedTotals[cat] = { total: round2((usedTotals[cat]?.total ?? 0) + amount), count: (usedTotals[cat]?.count ?? 0) + 1 };
      return;
    }
    const date = isFixed ? dayInMonth(curKey, 1, h, m) : at(now, -ago, h, m);
    mk({ type: 'expense', description: desc, amount, categoryId: cat, accountId: ACCOUNT_FOR[cat], date, ...(extra ?? {}) });
    usedTotals[cat] = usedTotals[cat] ?? { total: 0, count: 0 };
    usedTotals[cat].total = round2(usedTotals[cat].total + amount);
    usedTotals[cat].count++;
  });

  // Parcelamentos no cartão (parcelas passadas quitadas; atual na fatura aberta; futuras agendadas)
  const plans: Array<[string, string, number, number, number]> = [
    // [descrição, categoria, valor da parcela, parcela atual, total]
    ['Notebook Dell Inspiron', 'c_compras', 450, 3, 10],
    ['Passagem aérea — Tóquio', 'c_outros_d', 380, 2, 6],
    ['Geladeira Frost Free', 'c_compras', 289.9, 8, 12],
  ];
  plans.forEach(([desc, cat, amount, current, total], gi) => {
    for (let i = 1; i <= total; i++) {
      const offset = i - current;
      const date = new Date(now.getFullYear(), now.getMonth() + offset, Math.min(2, today), 11, 0);
      if (offset === 0 && date > now) date.setDate(1);
      tx.push({
        id: `t_inst_${gi}_${i}`, type: 'expense', description: desc, amount, categoryId: cat, accountId: 'a_itau', cardId: 'k_platinum',
        date: date.toISOString(), paid: true, invoicePaid: offset < 0, createdAt: date.toISOString(),
        installment: { group: `ig_${gi}`, index: i, total },
      });
      if (offset === 0) {
        usedTotals[cat] = { total: round2((usedTotals[cat]?.total ?? 0) + amount), count: (usedTotals[cat]?.count ?? 0) + 1 };
      }
    }
  });

  // Completa cada categoria até o total do mês (dias anteriores aos nomeados)
  Object.entries(CURRENT_MONTH).forEach(([cat, target]) => {
    const used = usedTotals[cat] ?? { total: 0, count: 0 };
    const remaining = round2(target.total - used.total);
    const n = target.count - used.count;
    if (n <= 0 || remaining <= 0) return;
    split(remaining, n, rand).forEach((amount, j) => {
      const names = FILLER[cat];
      const onCard = cat === 'c_compras' && j % 2 === 0;
      const d = Math.max(1, Math.min(today - 5, 1 + Math.floor(rand() * 26)));
      mk({
        type: 'expense', description: names[Math.floor(rand() * names.length)], amount, categoryId: cat,
        accountId: ACCOUNT_FOR[cat], date: dayInMonth(curKey, Math.max(1, d), 8 + Math.floor(rand() * 13), Math.floor(rand() * 60)),
        ...(onCard ? { cardId: 'k_platinum' } : {}),
      });
    });
  });


  // Fatura do cartão: despesas no cartão dos últimos meses já pagas
  tx.filter((t) => t.categoryId === 'c_compras' && !t.cardId && t.date < dayInMonth(curKey, 1)).forEach((t, i) => {
    if (i % 3 === 0) { t.cardId = 'k_platinum'; t.invoicePaid = true; }
  });

  // compras no cartão são debitadas da conta que paga a fatura
  tx.forEach((t) => {
    if (t.cardId) t.accountId = cards.find((c) => c.id === t.cardId)!.accountId;
  });

  // Saldos iniciais para que os saldos atuais batam com o design
  accounts.forEach((a) => {
    const net = tx
      .filter((t) => t.accountId === a.id && t.paid && (!t.cardId || t.invoicePaid))
      .reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
    a.initialBalance = round2(TARGET_BALANCES[a.id] - net);
  });

  const debts: Debt[] = [
    {
      id: 'd_carro', name: 'Financiamento do carro', creditor: 'Santander', kind: 'financiamento', installmentAmount: 890,
      totalInstallments: 48, paidInstallments: 18, dueDay: 20, accountId: 'a_itau', monthlyRate: 1.49, createdAt: created,
    },
  ];

  const bm = addMonths(curKey, -5);
  const budgets: Budget[] = [
    ['c_transporte', 400], ['c_lazer', 300], ['c_assinaturas', 250], ['c_compras', 2000],
    ['c_alimentacao', 800], ['c_educacao', 800], ['c_saude', 700],
  ].map(([categoryId, limit]) => ({ id: `b_${String(categoryId).slice(2)}`, categoryId: String(categoryId), limit: Number(limit), alertAt: 80, recurring: true, month: bm }));


  const contrib = (amounts: number[], startOffset: number) =>
    amounts.map((amount, i) => ({
      id: `gc_${startOffset}_${i}`,
      amount,
      date: new Date(now.getFullYear(), now.getMonth() - (amounts.length - 1 - i), Math.min(5, today)).toISOString(),
      note: i === 0 ? 'Valor inicial' : undefined,
    }));

  const goals: Goal[] = [
    { id: 'g_reserva', name: 'Reserva de emergência', icon: 'shield-checkmark-outline', color: 'salario', target: 20000, deadline: `${now.getFullYear() + 1}-12`, contributions: contrib([7000, 1200, 1000, 1100, 1000, 1100], 1), createdAt: created },
    { id: 'g_japao', name: 'Viagem ao Japão', icon: 'airplane-outline', color: 'lazer', target: 18000, deadline: `${now.getFullYear() + 1}-07`, contributions: contrib([2500, 700, 600, 800, 700], 2), createdAt: created },
    { id: 'g_notebook', name: 'Novo notebook', icon: 'laptop-outline', color: 'educacao', target: 6500, deadline: `${now.getFullYear() + 1}-03`, contributions: contrib([1600, 800, 900, 800], 3), createdAt: created },
    { id: 'g_invest', name: 'Investimento pessoal', icon: 'trending-up-outline', color: 'rendimentos', target: 10000, deadline: `${now.getFullYear()}-12`, contributions: contrib([5000, 1000, 1000, 1000], 4), createdAt: created },
    { id: 'g_camera', name: 'Câmera mirrorless', icon: 'sparkles-outline', color: 'assinaturas', target: 4800, deadline: `${now.getFullYear()}-08`, contributions: contrib([2400, 1200, 1200], 5).map((c, i) => ({ ...c, date: new Date(now.getFullYear(), now.getMonth() - 6 + i, 8).toISOString() })), createdAt: created, completedAt: new Date(now.getFullYear(), now.getMonth() - 3, 8).toISOString() },
  ];

  return {
    version: DATA_VERSION,
    settings: {
      userName: 'Matheus Assis',
      email: 'matheus@exemplo.com',
      hideValues: false,
      theme: 'system',
      onboarded: false,
      loggedIn: false,
      faceId: false,
      notifications: true,
      billReminders: true,
      budgetAlerts: true,
      savingsGoalPct: 30,
      currency: 'BRL',
      startOfMonthDay: 1,
      appLock: 'off',
      dateFormat: 'DD/MM/AAAA',
    },
    accounts,
    categories: [...DEFAULT_CATEGORIES, ...SEED_CUSTOM],
    transactions: tx.sort((a, b) => b.date.localeCompare(a.date)),
    budgets,
    goals,
    cards,
    debts,
    investments: [
      {
        id: 'i_tesouro', name: 'Tesouro Selic', institution: 'XP', mine: true, color: 'rendimentos', icon: 'trending-up-outline',
        initialAmount: 8000, initialDate: new Date(now.getFullYear(), now.getMonth() - 3, 2).toISOString(), createdAt: created,
        moves: [
          { id: 'im_1', type: 'aporte', amount: 500, date: new Date(now.getFullYear(), now.getMonth() - 2, 5).toISOString() },
          { id: 'im_2', type: 'rendimento', amount: 212.4, date: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString() },
          { id: 'im_3', type: 'resgate', amount: 300, date: new Date(now.getFullYear(), now.getMonth() - 1, 18).toISOString(), note: 'Conserto do carro' },
        ],
      },
    ],
    recurring: [
      { id: 'r_salario', type: 'income', description: 'Salário — Acme Ltda', amount: 8650, categoryId: 'c_salario', accountId: 'a_itau', day: 5, startMonth: addMonths(curKey, 1), active: true, createdAt: created },
      { id: 'r_internet', type: 'expense', description: 'Internet Fibra', amount: 119.9, categoryId: 'c_assinaturas', accountId: 'a_itau', day: Math.min(28, today + 2), startMonth: addMonths(curKey, 1), active: true, createdAt: created },
    ],
  };
}
