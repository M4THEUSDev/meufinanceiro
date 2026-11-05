import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import {
  ActionSheetController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSearchbar, IonSegment, IonSegmentButton, IonTitle, IonToolbar, ModalController,
} from '@ionic/angular/standalone';
import { Category, TxType } from '../../core/models/models';
import { StoreService, defaultFilters } from '../../core/services/store.service';
import { MONTHS, parseMonthKey } from '../../core/utils/format';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { CategoryFormModal } from './category-form.modal';

/** [Z1] Categorias · Despesas / Receitas */
@Component({
  selector: 'mf-categories',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, IonSegment, IonSegmentButton, IonSearchbar, CategoryIconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/mais" text="Mais"></ion-back-button></ion-buttons>
        <ion-title>Categorias</ion-title>
        <ion-buttons slot="end"><button class="mf-reset mf-action" type="button" aria-label="Nova categoria" (click)="create()"><ion-icon name="add"></ion-icon></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true" class="mf-page">
      <ion-header collapse="condense" class="ion-no-border"><ion-toolbar><ion-title size="large">Categorias</ion-title></ion-toolbar></ion-header>
      <div class="body">
        <div class="pad">
          <ion-segment mode="ios" [value]="type()" (ionChange)="type.set($any($event).detail.value)">
            <ion-segment-button value="expense">Despesas</ion-segment-button>
            <ion-segment-button value="income">Receitas</ion-segment-button>
          </ion-segment>
          <ion-searchbar class="mf-search" mode="ios" placeholder="Buscar categoria" [debounce]="0" (ionInput)="q.set($any($event).detail.value ?? '')"></ion-searchbar>
        </div>

        @for (sec of sections(); track sec.title) {
          @if (sec.items.length) {
            <div class="pad">
              <p class="mf-label">{{ sec.title }}</p>
              <div class="mf-group elevated">
                @for (r of sec.items; track r.c.id) {
                  <button class="mf-row cat" type="button" (click)="open(r.c)">
                    <mf-category-icon [icon]="r.c.icon" [color]="r.c.color" [size]="40"></mf-category-icon>
                    <span class="label grow">
                      <span class="name"><span class="t-callout-sb">{{ r.c.name }}</span>@if (r.c.custom) {<span class="badge t-caption2">Própria</span>}</span>
                      <span class="sub">{{ r.count }} {{ r.count === 1 ? 'transação' : 'transações' }}</span>
                    </span>
                    <span class="t-footnote-sb nowrap">{{ r.total | money }}</span>
                    <ion-icon class="chev" name="chevron-forward"></ion-icon>
                  </button>
                }
              </div>
            </div>
          }
        }
        @if (!hasAny()) {
          <div class="pad"><div class="mf-card mf-empty"><ion-icon name="search-outline"></ion-icon><p class="t-footnote">Nenhuma categoria encontrada.</p></div></div>
        }

        <div class="pad">
          <ion-button expand="block" class="tonal" (click)="create()"><ion-icon slot="start" name="add"></ion-icon>Criar categoria personalizada</ion-button>
        </div>
      </div>
    </ion-content>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 16px; padding: 4px 0 calc(110px + env(safe-area-inset-bottom)); }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 12px; }
    .mf-label { margin-bottom: -4px; }
    .cat { min-height: 60px; padding: 10px 16px; }
    .cat + .cat::before { left: 68px !important; }
    .name { display: flex; align-items: center; gap: 6px; }
    .badge { background: var(--ion-color-step-50); color: var(--mf-text-secondary); padding: 2px 6px; border-radius: 999px; }
  `,
})
export class CategoriesPage {
  private readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly router = inject(Router);
  private readonly sheet = inject(ActionSheetController);

  readonly type = signal<TxType>('expense');
  readonly q = signal('');
  readonly month = this.store.selectedMonth;

  readonly rows = computed(() => {
    const spend = new Map(this.store.categorySpend(this.month(), this.type()).map((s) => [s.category.id, s]));
    const q = this.q().trim().toLowerCase();
    return this.store
      .categoriesOf(this.type())
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .map((c) => ({ c, total: spend.get(c.id)?.total ?? 0, count: spend.get(c.id)?.count ?? 0 }))
      .sort((a, b) => b.total - a.total);
  });
  readonly sections = computed(() => {
    const m = MONTHS[parseMonthKey(this.month()).getMonth()].toUpperCase();
    return [
      { title: `${this.type() === 'expense' ? 'Despesas' : 'Receitas'} · ${m}`, items: this.rows().filter((r) => !r.c.custom) },
      { title: 'Personalizadas', items: this.rows().filter((r) => r.c.custom) },
    ];
  });
  readonly hasAny = computed(() => this.rows().length > 0);

  async open(c: Category): Promise<void> {
    const a = await this.sheet.create({
      header: c.name,
      buttons: [
        { text: 'Ver transações', handler: () => this.seeTransactions(c) },
        { text: c.custom ? 'Editar categoria' : 'Editar aparência', handler: () => void this.edit(c) },
        { text: 'Cancelar', role: 'cancel' },
      ],
    });
    await a.present();
  }

  seeTransactions(c: Category): void {
    this.store.filters.set({ ...defaultFilters(), month: this.month(), type: c.type, categoryIds: [c.id] });
    void this.router.navigateByUrl('/tabs/transacoes');
  }

  async create(): Promise<void> {
    const m = await this.modal.create({ component: CategoryFormModal, componentProps: { presetType: this.type() }, cssClass: 'mf-card-modal', presentingElement: document.querySelector('ion-tabs') as HTMLElement });
    await m.present();
  }

  async edit(c: Category): Promise<void> {
    const m = await this.modal.create({ component: CategoryFormModal, componentProps: { categoryId: c.id }, cssClass: 'mf-card-modal' });
    await m.present();
  }
}
