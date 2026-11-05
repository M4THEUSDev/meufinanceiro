import { Account, AccountKind } from './models/models';

export const ACCOUNT_KINDS: { id: AccountKind; label: string; chip: string; icon: string; group: string }[] = [
  { id: 'corrente', chip: 'Conta corrente', label: 'Conta corrente', icon: 'business-outline', group: 'Contas bancárias' },
  { id: 'poupanca', chip: 'Poupança', label: 'Conta poupança', icon: 'leaf-outline', group: 'Poupança' },
  { id: 'digital', chip: 'Conta digital', label: 'Conta digital', icon: 'phone-portrait-outline', group: 'Contas bancárias' },
  { id: 'investimento', chip: 'Investimento', label: 'Investimento', icon: 'trending-up-outline', group: 'Investimentos' },
  { id: 'carteira', chip: 'Carteira', label: 'Carteira digital', icon: 'wallet-outline', group: 'Dinheiro' },
  { id: 'dinheiro', chip: 'Dinheiro', label: 'Dinheiro em espécie', icon: 'cash-outline', group: 'Dinheiro' },
];

export const ACCOUNT_COLORS = ['rendimentos', 'salario', 'transporte', 'educacao', 'moradia', 'assinaturas', 'alimentacao', 'saude', 'extra', 'outros'] as const;

export function kindInfo(kind: AccountKind) {
  return ACCOUNT_KINDS.find((k) => k.id === kind) ?? ACCOUNT_KINDS[0];
}

export function accountSubtitle(a: Pick<Account, 'kind' | 'detail'>): string {
  const label = kindInfo(a.kind).label;
  return a.detail ? `${label} · ${a.detail}` : label;
}
