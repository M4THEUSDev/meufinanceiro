import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonItemOption, IonItemOptions, IonItemSliding, IonTitle, IonToolbar,
  ModalController, NavController,
} from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, MONTHS, money, monthKey, parseMonthKey, shortDate } from '../../core/utils/format';
import { RingComponent } from '../../shared/components/ring.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openContribution } from './contribution.modal';
import { GoalFormModal } from './goal-form.modal';

/** [Y] Metas · Acompanhar progresso */
@Component({
  selector: 'mf-goal-detail',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, IonItemSliding, IonItemOptions, IonItemOption, RingComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/mais/metas" text="Metas"></ion-back-button></ion-buttons>
        <ion-title>{{ goal()?.name ?? 'Meta' }}</ion-title>
        @if (goal()) { <ion-buttons slot="end"><ion-button class="plain" (click)="edit()">Editar</ion-button></ion-buttons> }
      </ion-toolbar>
    </ion-header>
    <ion-content class="mf-page">
      @if (goal(); as g) {
        <div class="body">
          <div class="hero">
            <mf-ring [value]="pct() / 100" [size]="180" [stroke]="18" [color]="'var(--mf-category-' + g.color + ')'">
              <ion-icon [name]="g.icon" class="gi" [style.color]="'var(--mf-category-' + g.color + ')'"></ion-icon>
              <span class="t-title1">{{ pct() }}%</span>
              <span class="t-footnote c-tertiary">concluído</span>
            </mf-ring>
            <p class="t-title3">{{ saved() | money }} de {{ g.target | money }}</p>
            <span class="mf-pill left"><ion-icon name="calendar-outline"></ion-icon>{{ leftLabel() }}</span>
          </div>

          <div class="pad stats">
            <div class="stat"><span class="t-footnote c-secondary">Por mês</span><span class="t-headline">{{ perMonth() | money }}</span></div>
            <div class="stat"><span class="t-footnote c-secondary">No ritmo</span><span class="t-headline" [class.c-success]="onTrack()" [class.c-warning]="!onTrack()">{{ onTrack() ? 'Sim' : 'Atrasada' }}</span></div>
          </div>

          <div class="pad">
            <h2 class="t-title3">Contribuições</h2>
            @if (contributions().length) {
              <div class="mf-list">
                @for (c of contributions(); track c.id) {
                  <ion-item-sliding>
                    <div class="row">
                      <span class="in"><ion-icon name="arrow-down"></ion-icon></span>
                      <span class="text"><span class="t-callout-sb">{{ date(c.date) }}</span><span class="t-footnote c-secondary">{{ c.note ?? (acc(c.accountId) || 'Contribuição') }}</span></span>
                      <span class="t-footnote-sb c-success nowrap">{{ c.amount | money: 'sign' }}</span>
                    </div>
                    <ion-item-options side="end"><ion-item-option color="danger" (click)="removeContribution(c.id)">Excluir</ion-item-option></ion-item-options>
                  </ion-item-sliding>
                }
              </div>
            } @else {
              <div class="mf-card mf-empty"><p class="t-footnote">Nenhuma contribuição ainda.</p></div>
            }
          </div>

          <div class="pad actions">
            @if (!g.completedAt) {
              <ion-button expand="block" (click)="contribute()"><ion-icon slot="start" name="add"></ion-icon>Adicionar contribuição</ion-button>
            }
            <ion-button expand="block" class="tonal" (click)="edit()">Editar meta</ion-button>
          </div>
        </div>
      } @else {
        <div class="mf-empty"><ion-icon name="flag-outline"></ion-icon><p class="t-headline">Meta não encontrada</p></div>
      }
    </ion-content>
  `,
  styles: `
    ion-button.plain { --color: var(--ion-color-primary); font-weight: 400; }
    .body { display: flex; flex-direction: column; gap: 20px; padding: 12px 0 calc(110px + env(safe-area-inset-bottom)); }
    .hero { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
    .hero p { margin: 0; }
    .gi { font-size: 28px; margin-bottom: 4px; }
    .left { position: relative; isolation: isolate; color: var(--ion-color-primary-shade); }
    .left::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--ion-color-primary); opacity: 0.12; z-index: -1; }
    .left ion-icon { font-size: 14px; }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 12px; }
    h2 { margin: 0; }
    .stats { flex-direction: row; }
    .stat { flex: 1; display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: var(--mf-radius-lg); background: var(--ion-card-background); box-shadow: var(--mf-elevation-sm); }
    ion-item-sliding { display: block; }
    .row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: var(--ion-card-background); }
    .in { position: relative; isolation: isolate; width: 36px; height: 36px; border-radius: 999px; display: grid; place-items: center; color: var(--ion-color-success); font-size: 18px; flex: 0 0 auto; }
    .in::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: currentColor; opacity: 0.14; z-index: -1; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .actions { gap: 10px; }
  `,
})
export class GoalDetailPage {
  private readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly ui = inject(UiService);
  private readonly nav = inject(NavController);

  readonly id = input.required<string>();
  readonly goal = computed(() => this.store.goal(this.id()));
  readonly saved = computed(() => (this.goal() ? this.store.goalSaved(this.goal()!) : 0));
  readonly pct = computed(() => (this.goal()?.target ? Math.min(100, Math.round((this.saved() / this.goal()!.target) * 100)) : 0));
  readonly contributions = computed(() => [...(this.goal()?.contributions ?? [])].sort((a, b) => b.date.localeCompare(a.date)));
  readonly monthsLeft = computed(() => {
    const g = this.goal();
    if (!g) return 1;
    const now = parseMonthKey(monthKey(new Date()));
    const d = parseMonthKey(g.deadline);
    return Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
  });
  readonly remaining = computed(() => Math.max(0, (this.goal()?.target ?? 0) - this.saved()));
  readonly perMonth = computed(() => Math.ceil((this.remaining() / this.monthsLeft()) * 100) / 100);
  /** no ritmo: média mensal das contribuições (excluindo o valor inicial) ≥ necessário por mês */
  readonly onTrack = computed(() => {
    const g = this.goal();
    if (!g) return true;
    if (g.completedAt || this.remaining() <= 0) return true;
    const regular = g.contributions.filter((c) => c.note !== 'Valor inicial');
    if (!regular.length) return false;
    const first = new Date(Math.min(...regular.map((c) => new Date(c.date).getTime())));
    const now = new Date();
    const months = Math.max(1, (now.getFullYear() - first.getFullYear()) * 12 + now.getMonth() - first.getMonth() + 1);
    const avg = regular.reduce((s, c) => s + c.amount, 0) / months;
    return avg >= this.perMonth() * 0.9;
  });
  readonly leftLabel = computed(() => {
    const g = this.goal();
    if (!g) return '';
    if (g.completedAt) return 'Meta concluída';
    const d = parseMonthKey(g.deadline);
    const v = this.store.hidden() ? HIDDEN_MASK : money(this.remaining());
    return `Faltam ${v} · ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
  });

  date(iso: string): string {
    return shortDate(iso);
  }
  acc(id?: string): string {
    return this.store.account(id)?.name ?? '';
  }

  async contribute(): Promise<void> {
    await openContribution(this.modal, this.id());
  }

  async edit(): Promise<void> {
    const m = await this.modal.create({ component: GoalFormModal, componentProps: { goalId: this.id() }, cssClass: 'mf-card-modal' });
    await m.present();
    const { role } = await m.onWillDismiss();
    if (role === 'delete') void this.nav.back();
  }

  async removeContribution(cid: string): Promise<void> {
    const ok = await this.ui.confirm({ header: 'Excluir contribuição?', message: 'O valor será removido do acumulado da meta.', confirmText: 'Excluir', destructive: true });
    if (ok) this.store.removeContribution(this.id(), cid);
  }
}
