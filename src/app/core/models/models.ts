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
  theme: 'platinum' | 'roxo' | 'grafite' | 'verde';
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

export interface AppData {
  version: number;
  settings: Settings;
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  cards: CreditCard[];
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
