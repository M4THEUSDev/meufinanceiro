import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController, NavController,
} from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { catColor } from '../../core/icons';
import { shortDate } from '../../core/utils/format';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { confirmDeleteTransaction } from './transaction-actions';
import { openTransactionForm } from './transaction-form.modal';

/** [K] Transações · Detalhes  /  [M] Confirmar exclusão */
@Component({
  selector: 'mf-transaction-detail',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, CategoryIconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/transacoes" text="Transações"></ion-back-button></ion-buttons>
        <ion-title>Detalhes</ion-title>
        @if (tx()) {
          <ion-buttons slot="end"><ion-button class="plain" (click)="edit()">Editar</ion-button></ion-buttons>
        }
      </ion-toolbar>
    </ion-header>

    <ion-content class="mf-page">
      @if (tx(); as t) {
        <div class="body">
          <div class="hero">
            <mf-category-icon [icon]="category()?.icon ?? 'help-circle-outline'" [color]="category()?.color ?? 'outros'" [size]="64"></mf-category-icon>
            <h1 class="t-title3">{{ t.description }}</h1>
            <p class="t-amount-large" [class.c-danger]="t.type === 'expense'" [class.c-success]="t.type === 'income'">
              {{ (t.type === 'income' ? t.amount : -t.amount) | money: 'sign' }}
            </p>
            <span class="status" [class.pending]="!t.paid">
              <ion-icon [name]="t.paid ? 'checkmark-circle-outline' : 'time-outline'"></ion-icon>{{ statusLabel() }}
            </span>
          </div>

          <div class="pad">
            <div class="mf-group elevated">
              <div class="mf-row">
                <span class="lead" [style.--lead]="t.type === 'expense' ? 'var(--ion-color-danger)' : 'var(--ion-color-success)'"><ion-icon [name]="t.type === 'expense' ? 'arrow-up' : 'arrow-down'"></ion-icon></span>
                <span class="label">Tipo</span><span class="value">{{ t.type === 'expense' ? 'Despesa' : 'Receita' }}</span>
              </div>
              <div class="mf-row">
                <span class="lead" [style.--lead]="color(category()?.color)"><ion-icon [name]="category()?.icon ?? 'pricetag-outline'"></ion-icon></span>
                <span class="label">Categoria</span><span class="value">{{ category()?.name ?? 'Sem categoria' }}</span>
              </div>
              <div class="mf-row">
                <span class="lead" [style.--lead]="color(account()?.color)"><ion-icon [name]="account()?.icon ?? 'business-outline'"></ion-icon></span>
                <span class="label">Conta</span><span class="value">{{ account()?.name ?? '—' }}</span>
              </div>
              @if (card()) {
                <div class="mf-row">
                  <span class="lead" style="--lead: var(--mf-text-secondary)"><ion-icon name="card-outline"></ion-icon></span>
                  <span class="label">Cartão</span><span class="value">{{ card()!.name }}</span>
                </div>
              }
              <div class="mf-row">
                <span class="lead" style="--lead: var(--mf-category-transporte)"><ion-icon name="calendar-outline"></ion-icon></span>
                <span class="label">Data</span><span class="value">{{ date() }}</span>
              </div>
              <button class="mf-row" type="button" (click)="togglePaid()">
                <span class="lead" [style.--lead]="t.paid ? 'var(--ion-color-success)' : 'var(--ion-color-warning)'"><ion-icon [name]="t.paid ? 'checkmark-circle-outline' : 'time-outline'"></ion-icon></span>
                <span class="label">Status</span>
                <span class="value">{{ statusLabel() }}</span>
                <span class="toggle-hint t-footnote">{{ t.paid ? 'Desmarcar' : (t.type === 'income' ? 'Marcar recebido' : 'Marcar pago') }}</span>
              </button>
            </div>
          </div>

          @if (t.notes) {
            <div class="pad">
              <p class="mf-label">Observações</p>
              <div class="notes t-body">{{ t.notes }}</div>
            </div>
          }

          <div class="pad actions">
            <ion-button expand="block" class="tonal" (click)="edit()"><ion-icon slot="start" name="create-outline"></ion-icon>Editar transação</ion-button>
            <ion-button expand="block" class="tonal-danger" (click)="remove()"><ion-icon slot="start" name="trash-outline"></ion-icon>Excluir transação</ion-button>
          </div>
        </div>
      } @else {
        <div class="mf-empty"><ion-icon name="receipt-outline"></ion-icon><p class="t-headline">Transação não encontrada</p><p class="t-footnote">Ela pode ter sido excluída.</p></div>
      }
    </ion-content>
  `,
  styles: `
    ion-button.plain { --color: var(--ion-color-primary); font-weight: 400; min-height: 44px; }
    .body { display: flex; flex-direction: column; gap: 20px; padding: 8px 0 calc(40px + env(safe-area-inset-bottom)); }
    .hero { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 8px 16px; text-align: center; }
    .hero h1, .hero p { margin: 0; }
    .status { position: relative; isolation: isolate; display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px;
      color: var(--ion-color-success); font-size: 12px; line-height: 16px; font-weight: 500; }
    .status::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: currentColor; opacity: 0.12; z-index: -1; }
    .status.pending { color: var(--ion-color-warning); }
    .status ion-icon { font-size: 14px; }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
    .notes { background: var(--ion-card-background); border-radius: var(--mf-radius-xl); padding: 16px; white-space: pre-wrap; }
    .actions { gap: 10px; }
    .toggle-hint { display: none; }
  `,
})
export class TransactionDetailPage {
  private readonly store = inject(StoreService);
  private readonly ui = inject(UiService);
  private readonly modal = inject(ModalController);
  private readonly nav = inject(NavController);

  readonly id = input.required<string>();
  readonly tx = computed(() => this.store.transaction(this.id()));
  readonly category = computed(() => this.store.category(this.tx()?.categoryId));
  readonly account = computed(() => this.store.account(this.tx()?.accountId));
  readonly card = computed(() => this.store.card(this.tx()?.cardId));
  readonly date = computed(() => (this.tx() ? shortDate(this.tx()!.date) : ''));
  readonly statusLabel = computed(() => {
    const t = this.tx();
    if (!t) return '';
    if (!t.paid) return 'Pendente';
    return t.type === 'income' ? 'Recebido' : 'Pago';
  });

  color(c?: string): string {
    return catColor(c ?? 'outros');
  }

  togglePaid(): void {
    const t = this.tx();
    if (!t) return;
    this.store.markPaid(t.id, !t.paid);
    this.ui.tap();
  }

  async edit(): Promise<void> {
    await openTransactionForm(this.modal, this.ui, this.store, { txId: this.id() });
  }

  async remove(): Promise<void> {
    const t = this.tx();
    if (!t) return;
    const ok = await confirmDeleteTransaction(this.store, this.ui, t);
    if (ok) void this.nav.back();
  }
}
