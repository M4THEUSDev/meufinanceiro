import { Transaction } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, money } from '../../core/utils/format';

/** [M] Confirmar exclusão — alerta destrutivo + toast com "Desfazer" */
export async function confirmDeleteTransaction(store: StoreService, ui: UiService, t: Transaction): Promise<boolean> {
  const value = store.hidden() ? HIDDEN_MASK : money(t.type === 'income' ? t.amount : -t.amount, { sign: true });
  const source = t.cardId ? store.card(t.cardId)?.name : store.account(t.accountId)?.name;
  const ok = await ui.confirm({
    header: 'Excluir transação?',
    message: `“${t.description}” (${value}) será removida e o saldo ${t.cardId ? 'da fatura do' : 'do'} ${source ?? 'conta'} será recalculado. Esta ação não pode ser desfeita.`,
    confirmText: 'Excluir',
    destructive: true,
  });
  if (!ok) return false;
  const removed = store.deleteTransaction(t.id);
  await ui.toast({
    title: 'Transação excluída',
    message: t.description,
    tone: 'danger',
    action: removed ? { text: 'Desfazer', handler: () => store.restoreTransaction(removed) } : undefined,
  });
  return true;
}
