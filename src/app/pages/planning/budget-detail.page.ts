import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { StoreService, defaultFilters } from '../../core/services/store.service';
import { HIDDEN_MASK, addMonths, money, monthKey, parseMonthKey, shortDate } from '../../core/utils/format';
import { budgetState } from '../../shared/components/budget-progress.component';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { RingComponent } from '../../shared/components/ring.component';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openBudgetForm } from './budget-form.modal';

/** [U] Planejamento · Acompanhar gastos */
@Component({
  selector: 'mf-budget-detail',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, RingComponent, CategoryIconComponent, SectionHeaderComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/planejamento" text="Planejamento"></ion-back-button></ion-buttons>
        <ion-title>{{ category()?.name ?? 'Orçamento' }}</ion-title>
        @if (budget()) { <ion-buttons slot="end"><ion-button class="plain" (click)="adjust()">Editar</ion-button></ion-buttons> }
      </ion-toolbar>
    </ion-header>
    <ion-content class="mf-page">
      @if (budget(); as b) {
        <div class="body">
          <div class="hero">
            <mf-ring [value]="pct() / 100" [size]="180" [stroke]="22" [color]="ringColor()">
              <mf-category-icon [icon]="category()?.icon ?? 'pricetag-outline'" [color]="category()?.color ?? 'outros'" [size]="40"></mf-category-icon>
              <span class="t-title1">{{ pct() }}%</span>
              <span class="t-footnote c-tertiary">do orçamento</span>
            </mf-ring>
            <p class="t-title3">{{ spent() | money }} de {{ b.limit | money }}</p>
            <span class="mf-pill status" [class]="'mf-pill status ' + state()">{{ status() }}</span>
          </div>

          <div class="pad stats">
            <div class="stat"><span class="t-footnote c-secondary">Média 3 meses</span><span class="t-headline">{{ average() | money }}</span></div>
            <div class="stat"><span class="t-footnote c-secondary">Mês passado</span><span class="t-headline">{{ lastMonth() | money }}</span></div>
          </div>

          <div class="pad">
            <mf-section-header [title]="'Gastos em ' + (category()?.name ?? '')" action="Ver todos" (actionClick)="seeAll()"></mf-section-header>
            @if (txs().length) {
              <div class="mf-list">
                @for (t of txs().slice(0, 6); track t.id) {
                  <button class="mf-reset tx" type="button" (click)="openTx(t.id)">
                    <mf-category-icon [icon]="category()?.icon ?? 'pricetag-outline'" [color]="category()?.color ?? 'outros'" [size]="40"></mf-category-icon>
                    <span class="text"><span class="t-callout-sb ellipsis">{{ t.description }}</span><span class="t-footnote c-secondary">{{ meta(t) }}</span></span>
                    <span class="t-footnote-sb c-danger nowrap">{{ -t.amount | money: 'sign' }}</span>
                  </button>
                }
              </div>
            } @else {
              <div class="mf-card mf-empty"><p class="t-footnote">Nenhum gasto nesta categoria no mês.</p></div>
            }
          </div>

          <div class="pad"><ion-button expand="block" class="tonal" (click)="adjust()">Ajustar orçamento</ion-button></div>
        </div>
      } @else {
        <div class="mf-empty"><ion-icon name="pie-chart-outline"></ion-icon><p class="t-headline">Orçamento não encontrado</p></div>
      }
    </ion-content>
  `,
  styles: `
    ion-button.plain { --color: var(--ion-color-primary); font-weight: 400; }
    .body { display: flex; flex-direction: column; gap: 20px; padding: 12px 0 calc(40px + env(safe-area-inset-bottom)); }
    .hero { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
    .hero p { margin: 0; }
    .status { position: relative; isolation: isolate; }
    .status::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: currentColor; opacity: 0.14; z-index: -1; }
    .status.normal { color: var(--ion-color-primary-shade); }
    .status.warning { color: var(--ion-color-warning); }
    .status.exceeded { color: var(--ion-color-danger); }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 12px; }
    .stats { flex-direction: row; }
    .stat { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: var(--mf-radius-lg); background: var(--ion-card-background); box-shadow: var(--mf-elevation-sm); }
    .tx { display: flex; align-items: center; gap: 12px; padding: 12px 16px; width: 100%; background: var(--ion-card-background); text-align: left; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  `,
})
export class BudgetDetailPage {
  private readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly router = inject(Router);

  readonly id = input.required<string>();
  readonly month = this.store.selectedMonth;
  readonly budget = computed(() => {
    const b = this.store.budget(this.id());
    if (!b) return undefined;
    // usa o orçamento vigente no mês da mesma categoria (pode haver um pontual)
    return this.store.budgetsFor(this.month()).find((x) => x.categoryId === b.categoryId) ?? b;
  });
  readonly category = computed(() => this.store.category(this.budget()?.categoryId));
  readonly spent = computed(() => (this.budget() ? this.store.spentInCategory(this.budget()!.categoryId, this.month()) : 0));
  readonly pct = computed(() => (this.budget()?.limit ? Math.round((this.spent() / this.budget()!.limit) * 100) : 0));
  readonly state = computed(() => (this.budget() ? budgetState(this.spent(), this.budget()!) : 'normal'));
  readonly ringColor = computed(() => ({ normal: 'var(--ion-color-primary)', warning: 'var(--ion-color-warning)', exceeded: 'var(--ion-color-danger)' })[this.state()]);
  readonly average = computed(() => (this.budget() ? this.store.categoryAverage(this.budget()!.categoryId, this.month()) : 0));
  readonly lastMonth = computed(() => (this.budget() ? this.store.spentInCategory(this.budget()!.categoryId, addMonths(this.month(), -1)) : 0));
  readonly txs = computed(() => this.store.txOfMonth(this.month()).filter((t) => t.type === 'expense' && t.categoryId === this.budget()?.categoryId));

  readonly status = computed(() => {
    const b = this.budget();
    if (!b) return '';
    const rest = b.limit - this.spent();
    const v = (n: number) => (this.store.hidden() ? HIDDEN_MASK : money(n));
    if (rest < 0) return `${v(-rest)} acima do limite`;
    const now = new Date();
    const key = this.month();
    if (key < monthKey(now)) return `Sobraram ${v(rest)}`;
    const d = parseMonthKey(key);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const days = key === monthKey(now) ? last - now.getDate() + 1 : last;
    return `Restam ${v(rest)} · ${v(rest / days)}/dia`;
  });

  meta(t: { date: string; accountId: string; cardId?: string }): string {
    const src = t.cardId ? this.store.card(t.cardId)?.name : this.store.account(t.accountId)?.name;
    return `${shortDate(t.date).slice(0, 5)} · ${src ?? ''}`;
  }

  openTx(id: string): void {
    void this.router.navigateByUrl(`/tabs/transacoes/${id}`);
  }

  seeAll(): void {
    const b = this.budget();
    if (!b) return;
    this.store.filters.set({ ...defaultFilters(), month: this.month(), type: 'expense', categoryIds: [b.categoryId] });
    void this.router.navigateByUrl('/tabs/transacoes');
  }

  async adjust(): Promise<void> {
    const b = this.budget();
    if (b) await openBudgetForm(this.modal, { budgetId: b.id, month: this.month() });
  }
}
