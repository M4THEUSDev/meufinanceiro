export type TxType = 'expense' | 'income';

export type CategoryColor =
  | 'moradia' | 'alimentacao' | 'transporte' | 'saude' | 'educacao' | 'assinaturas'
  | 'lazer' | 'compras' | 'salario' | 'extra' | 'reembolso' | 'rendimentos' | 'outros';

export interface Category {
  id: string;
  name: string;
  type: TxType;
  icon: string;
  color: CategoryColor;
  custom?: boolean;
  archived?: boolean;
}

export type AccountKind = 'corrente' | 'digital' | 'poupanca' | 'investimento' | 'carteira' | 'dinheiro';

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  /** ex.: "ag. 0001" */
  detail?: string;
  icon: string;
  color: CategoryColor;
  initialBalance: number;
  active: boolean;
  includeInTotal: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  type: TxType;
  description: string;
  /** valor sempre positivo; o sinal vem de `type` */
  amount: number;
  categoryId: string;
  accountId: string;
  /** cartão de crédito (opcional) — despesas no cartão entram na fatura */
  cardId?: string;
  /** compra no cartão já quitada via pagamento de fatura */
  invoicePaid?: boolean;
  /** compra parcelada: id do grupo + parcela atual / total */
  installment?: { group: string; index: number; total: number };
  /** id da linha do extrato importado (OFX FITID ou hash) — evita duplicar */
  importId?: string;
  /** parcela de dívida (empréstimo/financiamento) paga por esta transação */
  debtId?: string;
  /** gerada por uma conta fixa / receita recorrente */
  recurringId?: string;
  /** ISO date-time */
  date: string;
  paid: boolean;
  notes?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  limit: number;
  /** alerta ao atingir (%) — 0 desativa */
  alertAt: number;
  /** repete todos os meses */
  recurring: boolean;
  /** YYYY-MM do mês de início */
  month: string;
}

export interface GoalContribution {
  id: string;
  amount: number;
  date: string;
  accountId?: string;
  note?: string;
}

export interface Goal {
  id: string;
  name: string;
  icon: string;
  color: CategoryColor;
  target: number;
  /** YYYY-MM */
  deadline: string;
  /** conta onde o dinheiro da meta fica guardado */
  accountId?: string;
  contributions: GoalContribution[];
  /** ISO — preenchido quando o objetivo é alcançado */
  completedAt?: string;
  createdAt: string;
}

export interface CreditCard {
  id: string;
  name: string;
  /** emissor exibido no cartão, ex.: "Banco Digital" */
  bank: string;
  /** categoria do cartão, ex.: "Platinum" */
  tier: string;
  brand: 'Visa' | 'Mastercard' | 'Elo' | 'Amex';
  last4: string;
  limit: number;
  closingDay: number;
  dueDay: number;
  /** gradiente do cartão */
  theme: 'platinum' | 'roxo' | 'grafite' | 'verde' | 'xp';
  /** previsão de compras novas por mês, além das parcelas já lançadas (usada em Próximos meses) */
  monthlySpendEstimate?: number;
  accountId: string;
}

export type ThemePref = 'system' | 'light' | 'dark';

export interface Settings {
  userName: string;
  email: string;
  hideValues: boolean;
  theme: ThemePref;
  onboarded: boolean;
  loggedIn: boolean;
  faceId: boolean;
  notifications: boolean;
  billReminders: boolean;
  budgetAlerts: boolean;
  savingsGoalPct: number;
  currency: 'BRL';
  startOfMonthDay: number;
  /** SHA-256 da senha local (definida no primeiro login) */
  passwordHash?: string;
  /** foto de perfil (data URL) */
  photo?: string;
  /** bloqueio do app ao voltar do segundo plano */
  appLock: 'off' | 'immediately' | '1min' | '5min';
  dateFormat: 'DD/MM/AAAA' | 'AAAA-MM-DD';
  /** última atividade (ISO) — sessão expira após 30 dias sem uso */
  lastActiveAt?: string;
  /** já fez login neste dispositivo (habilita Face ID) */
  hasLoggedBefore?: boolean;
}

export type DebtKind = 'emprestimo' | 'financiamento' | 'acordo' | 'consignado' | 'cheque_especial' | 'outro';

/** Conta fixa ou receita recorrente: gera um lançamento pendente todo mês */
export interface Recurring {
  id: string;
  type: TxType;
  description: string;
  amount: number;
  categoryId: string;
  accountId: string;
  cardId?: string;
  /** dia do mês (1–31; meses curtos usam o último dia) */
  day: number;
  /** YYYY-MM do primeiro mês */
  startMonth: string;
  /** YYYY-MM do último mês (opcional) */
  endMonth?: string;
  active: boolean;
  /** meses em que o lançamento foi excluído pelo usuário (não recriar) */
  skip?: string[];
  createdAt: string;
}

/** Empréstimo, financiamento ou outra dívida parcelada fora do cartão */
export interface Debt {
  id: string;
  name: string;
  /** credor, ex.: "Santander" */
  creditor: string;
  kind: DebtKind;
  installmentAmount: number;
  totalInstallments: number;
  paidInstallments: number;
  /** dia do vencimento da parcela */
  dueDay: number;
  /** conta de onde sai o pagamento */
  accountId: string;
  /** YYYY-MM da próxima parcela a vencer (avança a cada pagamento) */
  nextDueMonth?: string;
  /** saldo devedor informado pelo credor (substitui parcelas × valor) */
  payoffAmount?: number;
  /** ISO da data em que o saldo devedor foi informado */
  payoffDate?: string;
  /** juros ao mês (%), informativo */
  monthlyRate?: number;
  createdAt: string;
  notes?: string;
}

export type InvestmentMoveType = 'aporte' | 'resgate' | 'rendimento';

/** movimentação de um investimento (valor sempre positivo; o tipo define o sinal) */
export interface InvestmentMove {
  id: string;
  type: InvestmentMoveType;
  amount: number;
  /** ISO */
  date: string;
  note?: string;
}

/** Investimento acompanhado à parte das contas (CDB, Tesouro, ações, cofrinho…) */
export interface Investment {
  id: string;
  name: string;
  /** onde está aplicado, ex.: "Nubank", "XP" */
  institution?: string;
  /** false = dinheiro de outra pessoa que você administra (não entra no seu patrimônio) */
  mine: boolean;
  color: CategoryColor;
  icon: string;
  /** saldo quando começou a acompanhar */
  initialAmount: number;
  /** ISO da data do saldo inicial */
  initialDate: string;
  moves: InvestmentMove[];
  notes?: string;
  createdAt: string;
}

export interface AppData {
  version: number;
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  cards: CreditCard[];
  debts: Debt[];
  recurring: Recurring[];
  investments: Investment[];
}

export interface TxFilters {
  /** month = mês em `month`; last3 = 3 meses até hoje; year = ano corrente; custom = intervalo from/to */
  period: 'month' | 'last3' | 'year' | 'custom' | 'all';
  month: string;
  from?: string;
  to?: string;
  type: 'all' | TxType;
  categoryIds: string[];
  accountId: string | null;
  search: string;
}
