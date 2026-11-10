import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItemOption, IonItemOptions, IonItemSliding, IonTitle, IonToolbar,
  ModalController, NavController,
} from '@ionic/angular/standalone';
import { InvestmentMoveType } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { round2, shortDate } from '../../core/utils/format';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { MOVE_LABEL } from '../../shared/components/investment-item.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openInvestmentForm } from './investment-form.modal';
import { MoveMode, openInvestmentMove } from './investment-move.modal';

interface StatementRow {
  id: string;
  type: InvestmentMoveType | 'inicial';
  title: string;
  date: string;
  note?: string;
  /** valor com sinal */
  value: number;
  /** saldo depois desta linha */
  balance: number;
}

/** Investimento · saldo, resumo e extrato com saldo após cada movimentação */
@Component({
  selector: 'mf-investment-detail',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, IonItemSliding, IonItemOptions, IonItemOption, CategoryIconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/mais/investimentos" text="Voltar"></ion-back-button></ion-buttons>
        <ion-title>{{ inv()?.name ?? 'Investimento' }}</ion-title>
        @if (inv()) { <ion-buttons slot="end"><ion-button class="plain" (click)="edit()">Editar</ion-button></ion-buttons> }
      </ion-toolbar>
    </ion-header>
    <ion-content class="mf-page">
      @if (inv(); as i) {
        <div class="body">
          <div class="hero">
            <mf-category-icon [icon]="i.icon" [color]="i.color" [size]="56"></mf-category-icon>
            <span class="t-footnote c-secondary">{{ i.institution ? i.institution + ' · ' : '' }}{{ i.mine ? 'Seu' : 'De outra pessoa' }}</span>
            <span class="t-amount-large nowrap">{{ balance() | money }}</span>
            @if (withdrawn() > 0) {
              <span class="t-footnote c-secondary">Era {{ peak() | money }} · retirado {{ withdrawn() | money }}</span>
            }
          </div>

          <div class="pad">
            <div class="mf-card stats">
              <div><span class="t-subhead c-secondary">Aportes</span><span class="t-subhead-sb nowrap" [class.c-success]="sums().aporte > 0">{{ sums().aporte | money }}</span></div>
              <div><span class="t-subhead c-secondary">Resgates</span><span class="t-subhead-sb nowrap" [class.c-danger]="sums().resgate > 0">{{ -sums().resgate | money }}</span></div>
              <div><span class="t-subhead c-secondary">Rendimentos</span><span class="t-subhead-sb nowrap" [class.c-success]="sums().rendimento > 0" [class.c-danger]="sums().rendimento < 0">{{ sums().rendimento | money }}</span></div>
            </div>
          </div>

          <div class="pad actions">
            <button class="mf-reset act" type="button" (click)="move('resgate')"><span class="ic out"><ion-icon name="arrow-up"></ion-icon></span><span class="t-footnote-sb">Resgate</span></button>
            <button class="mf-reset act" type="button" (click)="move('aporte')"><span class="ic in"><ion-icon name="arrow-down"></ion-icon></span><span class="t-footnote-sb">Aporte</span></button>
            <button class="mf-reset act" type="button" (click)="move('saldo')"><span class="ic up"><ion-icon name="refresh-outline"></ion-icon></span><span class="t-footnote-sb">Atualizar saldo</span></button>
          </div>

          <div class="pad">
            <h2 class="t-title3">Extrato</h2>
            <div class="mf-list">
              @for (r of rows(); track r.id) {
                <ion-item-sliding [disabled]="r.type === 'inicial'">
                  <div class="row">
                    <span class="ic" [class.in]="r.type === 'aporte' || (r.type === 'rendimento' && r.value >= 0)" [class.out]="r.type === 'resgate' || (r.type === 'rendimento' && r.value < 0)" [class.start]="r.type === 'inicial'">
                      <ion-icon [name]="icon(r)"></ion-icon>
                    </span>
                    <span class="text">
                      <span class="t-callout-sb ellipsis">{{ r.title }}</span>
                      <span class="t-footnote c-secondary ellipsis">{{ date(r.date) }}{{ r.note ? ' · ' + r.note : '' }}</span>
                    </span>
                    <span class="right">
                      <span class="t-footnote-sb nowrap" [class.c-success]="r.type !== 'inicial' && r.value > 0" [class.c-danger]="r.value < 0">{{ r.value | money: (r.type === 'inicial' ? undefined : 'sign') }}</span>
                      <span class="t-caption1 c-tertiary nowrap">Saldo {{ r.balance | money }}</span>
                    </span>
                  </div>
                  <ion-item-options side="end"><ion-item-option color="danger" (click)="removeMove(r.id)">Excluir</ion-item-option></ion-item-options>
                </ion-item-sliding>
              }
            </div>
            <p class="t-caption1 c-tertiary">Deslize uma movimentação para a esquerda para excluir.</p>
          </div>
        </div>
      } @else {
        <div class="mf-empty"><ion-icon name="trending-up-outline"></ion-icon><p class="t-headline">Investimento não encontrado</p></div>
      }
    </ion-content>
  `,
  styles: `
    ion-button.plain { --color: var(--ion-color-primary); font-weight: 400; }
    .body { display: flex; flex-direction: column; gap: 20px; padding: 12px 0 calc(110px + env(safe-area-inset-bottom)); }
    .hero { display: flex; flex-direction: column; align-items: center; gap: 6px; text-align: center; padding: 0 16px; }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 12px; }
    h2 { margin: 0; }
    p { margin: 0; }
    .stats { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; }
    .stats > div { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
    .actions { flex-direction: row; justify-content: space-around; }
    .act { display: flex; flex-direction: column; align-items: center; gap: 6px; color: var(--ion-text-color); }
    .act .ic { width: 52px; height: 52px; font-size: 22px; }
    ion-item-sliding { display: block; }
    .row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--ion-card-background); }
    .ic { position: relative; isolation: isolate; width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center; font-size: 18px; flex: 0 0 auto; color: var(--mf-text-secondary); }
    .ic::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: currentColor; opacity: 0.14; z-index: -1; }
    .ic.in { color: var(--ion-color-success); }
    .ic.out { color: var(--ion-color-danger); }
    .ic.up { color: var(--ion-color-primary); }
    .ic.start { color: var(--ion-color-primary); }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  `,
})
export class InvestmentDetailPage {
  private readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly ui = inject(UiService);
  private readonly nav = inject(NavController);

  readonly id = input.required<string>();
  readonly inv = computed(() => this.store.investment(this.id()));
  readonly balance = computed(() => (this.inv() ? this.store.investmentBalance(this.inv()!) : 0));
  readonly sums = computed(() => {
    const s = { aporte: 0, resgate: 0, rendimento: 0 };
    for (const m of this.inv()?.moves ?? []) s[m.type] = round2(s[m.type] + m.amount);
    return s;
  });
  readonly withdrawn = computed(() => this.sums().resgate);
  /** saldo antes dos resgates (inicial + aportes + rendimentos) */
  readonly peak = computed(() => round2(this.balance() + this.withdrawn()));

  /** extrato do mais recente para o mais antigo, com o saldo após cada linha */
  readonly rows = computed<StatementRow[]>(() => {
    const i = this.inv();
    if (!i) return [];
    const moves = [...i.moves].sort((a, b) => a.date.localeCompare(b.date));
    let bal = i.initialAmount;
    const rows: StatementRow[] = [{ id: '__initial', type: 'inicial', title: 'Saldo inicial', date: i.initialDate, value: i.initialAmount, balance: bal }];
    for (const m of moves) {
      const value = m.type === 'resgate' ? -m.amount : m.amount;
      bal = round2(bal + value);
      const title = m.type === 'rendimento' && m.amount < 0 ? 'Desvalorização' : MOVE_LABEL[m.type];
      rows.push({ id: m.id, type: m.type, title, date: m.date, note: m.note && m.note !== title ? m.note : undefined, value, balance: bal });
    }
    return rows.reverse();
  });

  icon(r: StatementRow): string {
    if (r.type === 'inicial') return 'flag-outline';
    if (r.type === 'resgate') return 'arrow-up';
    if (r.type === 'aporte') return 'arrow-down';
    return r.value >= 0 ? 'trending-up' : 'trending-down';
  }

  date(iso: string): string {
    return shortDate(iso);
  }

  async move(mode: MoveMode): Promise<void> {
    await openInvestmentMove(this.modal, this.id(), mode);
  }

  async edit(): Promise<void> {
    const r = await openInvestmentForm(this.modal, this.id());
    if (r.role === 'delete') void this.nav.back();
  }

  async removeMove(moveId: string): Promise<void> {
    const ok = await this.ui.confirm({ header: 'Excluir movimentação?', message: 'O saldo do investimento será recalculado.', confirmText: 'Excluir', destructive: true });
    if (ok) this.store.removeInvestmentMove(this.id(), moveId);
  }
}
