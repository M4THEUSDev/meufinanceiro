import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonIcon, IonToggle, ModalController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, money, monthKey, monthLabel } from '../../core/utils/format';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';
import { openPicker } from '../../shared/components/picker.modal';

/** [S] Planejamento · Definir orçamento (bottom sheet) */
@Component({
  selector: 'mf-budget-form',
  imports: [IonHeader, IonContent, IonIcon, IonToggle, IonButton, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="cancel()">Cancelar</button>
        <span class="title">Orçamento</span>
        <button type="button" class="strong" (click)="save()">Salvar</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="body">
        <div class="mf-group">
          <button class="mf-row" type="button" (click)="pickCategory()">
            <span class="lead" [style.--lead]="category() ? 'var(--mf-category-' + category()!.color + ')' : 'var(--mf-text-tertiary)'"><ion-icon [name]="category()?.icon ?? 'pricetag-outline'"></ion-icon></span>
            <span class="label">Categoria</span>
            <span class="value">{{ category()?.name ?? 'Selecionar' }}</span>
            <ion-icon class="chev" name="chevron-forward"></ion-icon>
          </button>
        </div>
        @if (submitted() && !categoryId()) { <p class="err">Selecione uma categoria.</p> }

        <mf-currency-input [(value)]="limit" tone="neutral" label="Valor planejado por mês"></mf-currency-input>
        @if (submitted() && limit() <= 0) { <p class="err">Informe um valor maior que zero.</p> }

        @if (categoryId()) {
          <button class="mf-reset hint t-footnote c-secondary" type="button" (click)="limit.set(suggestion())">
            <ion-icon name="sparkles-outline"></ion-icon>
            <span>Média dos últimos 3 meses: {{ fmt(average()) }}. Sugestão: {{ fmt(suggestion()) }}.</span>
          </button>
        }

        <div class="mf-group">
          <div class="mf-row">
            <span class="lead" style="--lead: var(--ion-color-primary)"><ion-icon name="notifications-outline"></ion-icon></span>
            <span class="label grow">Alertar ao atingir 80%</span>
            <ion-toggle [checked]="alert()" (ionChange)="alert.set($any($event).detail.checked)" aria-label="Alertar ao atingir 80%"></ion-toggle>
          </div>
          <div class="mf-row">
            <span class="lead" style="--lead: var(--mf-category-transporte)"><ion-icon name="repeat-outline"></ion-icon></span>
            <span class="label grow">Repetir todos os meses</span>
            <ion-toggle [checked]="recurring()" (ionChange)="recurring.set($any($event).detail.checked)" aria-label="Repetir todos os meses"></ion-toggle>
          </div>
        </div>

        <ion-button expand="block" (click)="save()">Salvar orçamento</ion-button>
        @if (budgetId) {
          <ion-button expand="block" fill="clear" color="danger" (click)="remove()">Remover orçamento</ion-button>
        }
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 14px; }
    ion-content { --background: var(--ion-background-color); }
    .body { padding: 6px 16px 32px; display: flex; flex-direction: column; gap: 16px; }
    .hint { display: flex; gap: 8px; align-items: flex-start; padding: 12px 16px; border-radius: var(--mf-radius-lg); background: var(--ion-card-background); text-align: left; }
    .hint ion-icon { color: var(--ion-color-primary); font-size: 18px; flex: 0 0 auto; }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: -8px 4px 0; }
    ion-button[fill='clear'][color='danger'] { --color: var(--ion-color-danger); }
  `,
})
export class BudgetFormModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  budgetId?: string;
  month = monthKey(new Date());
  presetCategoryId?: string;

  readonly categoryId = signal<string | null>(null);
  readonly limit = signal(0);
  readonly alert = signal(true);
  readonly recurring = signal(true);
  readonly submitted = signal(false);

  readonly category = computed(() => this.store.category(this.categoryId() ?? undefined));
  readonly average = computed(() => (this.categoryId() ? this.store.categoryAverage(this.categoryId()!, this.month) : 0));
  readonly suggestion = computed(() => Math.max(50, Math.ceil((this.average() * 1.1) / 50) * 50));

  ngOnInit(): void {
    const b = this.budgetId ? this.store.budget(this.budgetId) : undefined;
    if (b) {
      this.categoryId.set(b.categoryId);
      this.limit.set(b.limit);
      this.alert.set(b.alertAt > 0);
      this.recurring.set(b.recurring);
    } else if (this.presetCategoryId) {
      this.categoryId.set(this.presetCategoryId);
    }
  }

  fmt(v: number): string {
    return this.store.hidden() ? HIDDEN_MASK : money(v);
  }

  async pickCategory(): Promise<void> {
    const used = new Set(this.store.budgetsFor(this.month).map((b) => b.categoryId));
    const id = await openPicker(this.modalCtrl, {
      title: 'Categoria',
      selected: this.categoryId(),
      options: this.store.categoriesOf('expense').map((c) => ({
        id: c.id, label: c.name, icon: c.icon, color: c.color,
        subtitle: used.has(c.id) && c.id !== this.categoryId() ? 'Já possui orçamento' : undefined,
      })),
    });
    if (!id) return;
    this.categoryId.set(id);
    const existing = this.store.budgetsFor(this.month).find((b) => b.categoryId === id);
    if (existing && !this.budgetId) {
      this.budgetId = existing.id;
      this.limit.set(existing.limit);
    } else if (!this.limit()) {
      this.limit.set(this.suggestion());
    }
  }

  cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (!this.categoryId() || this.limit() <= 0) return;
    const prev = this.budgetId ? this.store.budget(this.budgetId) : undefined;
    // orçamento recorrente vale a partir deste mês; pontual vale só para o mês selecionado
    const sameScope = prev && prev.recurring === this.recurring() && (this.recurring() || prev.month === this.month);
    this.store.saveBudget({
      id: sameScope ? prev!.id : undefined,
      categoryId: this.categoryId()!,
      limit: this.limit(),
      alertAt: this.alert() ? 80 : 0,
      recurring: this.recurring(),
      month: sameScope && this.recurring() ? prev!.month : this.month,
    });
    const name = this.category()?.name ?? '';
    await this.ui.toast({
      title: 'Orçamento salvo',
      message: `${name} · ${this.fmt(this.limit())}/mês${this.recurring() ? '' : ` em ${monthLabel(this.month).toLowerCase()}`}`,
    });
    void this.modalCtrl.dismiss(true, 'save');
  }

  async remove(): Promise<void> {
    const b = this.budgetId ? this.store.budget(this.budgetId) : undefined;
    if (!b) return;
    const ok = await this.ui.confirm({
      header: 'Remover orçamento?',
      message: `O limite de ${this.category()?.name ?? 'categoria'} deixará de ser acompanhado.`,
      confirmText: 'Remover',
      destructive: true,
    });
    if (!ok) return;
    this.store.deleteBudget(b.id);
    void this.modalCtrl.dismiss(true, 'delete');
  }
}

export async function openBudgetForm(modal: ModalController, props: { budgetId?: string; month: string; presetCategoryId?: string }): Promise<boolean> {
  const m = await modal.create({ component: BudgetFormModal, componentProps: props, breakpoints: [0, 0.68, 1], initialBreakpoint: 0.68, cssClass: 'mf-sheet', handle: true });
  await m.present();
  const { role } = await m.onWillDismiss();
  return role === 'save' || role === 'delete';
}
