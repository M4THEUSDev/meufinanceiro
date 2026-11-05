import { Injectable, effect, inject } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { StoreService } from './store.service';
import { monthKey } from '../utils/format';

/**
 * Notificações locais:
 * - BillItem: lembrete às 9h do dia anterior ao vencimento (e no dia, se vencer hoje)
 * - BudgetProgress: alerta quando a categoria passa do limite de alerta / do orçamento
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly store = inject(StoreService);
  private readonly notifiedBudgets = new Set<string>();
  private permission: boolean | null = null;

  constructor() {
    effect(() => {
      const s = this.store.settings();
      const bills = this.store.bills();
      const key = monthKey(new Date());
      const budgets = this.store.budgetsFor(key).map((b) => ({ b, spent: this.store.spentInCategory(b.categoryId, key) }));
      if (!s.loggedIn || !Capacitor.isNativePlatform()) return;
      void this.sync(s.notifications && s.billReminders, s.notifications && s.budgetAlerts, bills, budgets);
    });
  }

  private async ensurePermission(): Promise<boolean> {
    if (this.permission !== null) return this.permission;
    try {
      let p = await LocalNotifications.checkPermissions();
      if (p.display === 'prompt' || p.display === 'prompt-with-rationale') p = await LocalNotifications.requestPermissions();
      this.permission = p.display === 'granted';
    } catch {
      this.permission = false;
    }
    return this.permission;
  }

  private async sync(
    bills: boolean,
    budgetsOn: boolean,
    list: ReturnType<StoreService['bills']>,
    budgets: { b: { id: string; categoryId: string; limit: number; alertAt: number }; spent: number }[],
  ): Promise<void> {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
      if (!bills && !budgetsOn) return;
      if (!(await this.ensurePermission())) return;
      const now = new Date();
      const notifications = [];
      if (bills) {
        for (const [i, b] of list.entries()) {
          const at = new Date(b.due.getFullYear(), b.due.getMonth(), b.due.getDate() - 1, 9, 0);
          if (at <= now) continue;
          notifications.push({
            id: 1000 + i,
            title: 'Conta vence amanhã',
            body: `${b.name} · R$ ${b.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            schedule: { at },
          });
        }
      }
      if (budgetsOn) {
        for (const { b, spent } of budgets) {
          const pct = b.limit ? (spent / b.limit) * 100 : 0;
          const level = pct > 100 ? 'over' : b.alertAt && pct >= b.alertAt ? 'warn' : null;
          const tag = `${b.id}:${level}`;
          if (!level || this.notifiedBudgets.has(tag)) continue;
          this.notifiedBudgets.add(tag);
          const name = this.store.category(b.categoryId)?.name ?? '';
          notifications.push({
            id: 2000 + this.notifiedBudgets.size,
            title: level === 'over' ? 'Orçamento estourado' : 'Orçamento quase no limite',
            body: level === 'over' ? `${name} passou do planejado (${Math.round(pct)}%).` : `${name} já consumiu ${Math.round(pct)}% do planejado.`,
            schedule: { at: new Date(Date.now() + 1000) },
          });
        }
      }
      if (notifications.length) await LocalNotifications.schedule({ notifications });
    } catch {
      /* plugin indisponível */
    }
  }
}
