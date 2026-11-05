import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { HIDDEN_MASK, money } from '../../core/utils/format';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { GoalProgressComponent } from '../../shared/components/goal-progress.component';
import { RingComponent } from '../../shared/components/ring.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openContribution } from './contribution.modal';
import { GoalFormModal } from './goal-form.modal';

/** [V] Metas · Lista */
@Component({
  selector: 'mf-goals',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, RingComponent, GoalProgressComponent, CategoryIconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/mais" text="Mais"></ion-back-button></ion-buttons>
        <ion-title>Metas</ion-title>
        <ion-buttons slot="end"><button class="mf-reset mf-action" type="button" aria-label="Nova meta" (click)="create()"><ion-icon name="add"></ion-icon></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true" class="mf-page">
      <ion-header collapse="condense" class="ion-no-border"><ion-toolbar><ion-title size="large">Metas</ion-title></ion-toolbar></ion-header>
      <div class="body">
        @if (active().length) {
          <div class="pad">
            <div class="total">
              <mf-ring [value]="pct() / 100" [size]="64" [stroke]="8" color="var(--ion-color-primary)" class="ring">
                <span class="t-subhead-sb">{{ pct() }}%</span>
              </mf-ring>
              <div class="grow">
                <span class="t-footnote">Total acumulado</span>
                <span class="t-amount-large nowrap">{{ saved() | money }}</span>
                <span class="t-footnote sub">de {{ targetLabel() }} em {{ active().length }} {{ active().length === 1 ? 'meta' : 'metas' }}</span>
              </div>
            </div>
          </div>
          <div class="pad">
            <h2 class="t-title3">Metas ativas</h2>
            @for (g of active(); track g.id) {
              <mf-goal-progress [goal]="g" (click)="open(g.id)" (contribute)="contribute(g.id)"></mf-goal-progress>
            }
          </div>
        } @else {
          <div class="pad">
            <div class="mf-card mf-empty">
              <ion-icon name="flag-outline"></ion-icon>
              <p class="t-headline">Crie sua primeira meta</p>
              <p class="t-footnote">Reserva de emergência, uma viagem ou um equipamento novo: defina o valor e a data e acompanhe o progresso.</p>
              <ion-button class="mf-small" (click)="create()"><ion-icon slot="start" name="add"></ion-icon>Criar meta</ion-button>
            </div>
          </div>
        }
        @if (done().length) {
          <div class="pad">
            <p class="mf-label">Concluídas</p>
            <div class="mf-list">
              @for (g of done(); track g.id) {
                <button class="mf-row" type="button" (click)="open(g.id)">
                  <mf-category-icon [icon]="g.icon" [color]="g.color" [size]="32"></mf-category-icon>
                  <span class="label grow">{{ g.name }}<span class="sub">{{ doneLabel(g.completedAt!, g.target) }}</span></span>
                  <ion-icon name="checkmark-circle" class="ok"></ion-icon>
                </button>
              }
            </div>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 20px; padding: 4px 0 calc(110px + env(safe-area-inset-bottom)); }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 12px; }
    h2 { margin: 0; }
    .total { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: var(--mf-radius-xl); background: var(--mf-brand-deep); color: #fff; box-shadow: var(--mf-elevation-brand); }
    .ring { --ion-color-step-50: rgba(255,255,255,0.18); }
    .grow { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .sub { opacity: 0.75; }
    .ok { color: var(--ion-color-success); font-size: 22px; }
  `,
})
export class GoalsPage {
  private readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly router = inject(Router);

  readonly active = computed(() => this.store.goals().filter((g) => !g.completedAt));
  readonly done = computed(() => this.store.goals().filter((g) => !!g.completedAt));
  readonly saved = computed(() => this.active().reduce((s, g) => s + this.store.goalSaved(g), 0));
  readonly target = computed(() => this.active().reduce((s, g) => s + g.target, 0));
  readonly pct = computed(() => (this.target() ? Math.round((this.saved() / this.target()) * 100) : 0));
  readonly targetLabel = computed(() => (this.store.hidden() ? HIDDEN_MASK : money(this.target())));

  doneLabel(iso: string, target: number): string {
    const d = new Date(iso);
    return `Concluída em ${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()} · ${this.store.hidden() ? HIDDEN_MASK : money(target)}`;
  }

  open(id: string): void {
    void this.router.navigateByUrl(`/tabs/mais/metas/${id}`);
  }

  async contribute(id: string): Promise<void> {
    await openContribution(this.modal, id);
  }

  async create(): Promise<void> {
    const m = await this.modal.create({ component: GoalFormModal, cssClass: 'mf-card-modal', presentingElement: document.querySelector('ion-tabs') as HTMLElement });
    await m.present();
  }
}
