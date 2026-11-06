import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { Recurring } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { monthKey, monthShortLabel, round2 } from '../../core/utils/format';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openRecurringForm } from './recurring-form.modal';

/** Contas fixas e receitas recorrentes */
@Component({
  selector: 'mf-recurring',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, CategoryIconComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border" [translucent]="true">
      <ion-toolbar>
        <ion-buttons slot="start"><ion-back-button defaultHref="/tabs/mais" text="Mais"></ion-back-button></ion-buttons>
        <ion-title>Contas fixas</ion-title>
        <ion-buttons slot="end"><button class="mf-reset mf-action" type="button" aria-label="Nova conta fixa" (click)="add('expense')"><ion-icon name="add"></ion-icon></button></ion-buttons>
      </ion-toolbar>
    </ion-header>
    <ion-content [fullscreen]="true" class="mf-page">
      <ion-header collapse="condense" class="ion-no-border"><ion-toolbar><ion-title size="large">Contas fixas</ion-title></ion-toolbar></ion-header>
      <div class="body">
        <div class="pad">
          <div class="grid3">
            <div class="kpi"><span class="t-caption1 c-secondary">Entra por mês</span><span class="t-headline c-success nowrap">{{ totals().income | money: 'int' }}</span></div>
            <div class="kpi"><span class="t-caption1 c-secondary">Sai por mês</span><span class="t-headline c-danger nowrap">{{ totals().expense | money: 'int' }}</span></div>
            <div class="kpi"><span class="t-caption1 c-secondary">Sobra fixa</span><span class="t-headline nowrap" [class.c-success]="totals().net >= 0" [class.c-danger]="totals().net < 0">{{ totals().net | money: 'int' }}</span></div>
          </div>
          <p class="note t-footnote c-secondary">Lançamentos que se repetem todo mês são criados automaticamente como pendentes — você só confirma quando pagar ou receber.</p>
        </div>

        @for (g of groups(); track g.title) {
          <div class="pad">
            <p class="mf-label">{{ g.title }}</p>
            @if (g.items.length) {
              <div class="mf-list">
                @for (r of g.items; track r.id) {
                  <button class="mf-reset row" type="button" [class.off]="!r.active || ended(r)" (click)="edit(r)">
                    <mf-category-icon [icon]="cat(r)?.icon ?? 'repeat-outline'" [color]="cat(r)?.color ?? 'outros'" [size]="40"></mf-category-icon>
                    <span class="text">
                      <span class="t-callout-sb ellipsis">{{ r.description }}</span>
                      <span class="t-footnote c-secondary ellipsis">{{ meta(r) }}</span>
                    </span>
                    <span class="t-footnote-sb nowrap" [class.c-success]="r.type === 'income'" [class.c-danger]="r.type === 'expense'">{{ (r.type === 'income' ? r.amount : -r.amount) | money: 'sign' }}</span>
                  </button>
                }
              </div>
            } @else {
              <div class="mf-card mf-empty"><p class="t-footnote">{{ g.empty }}</p></div>
            }
            <ion-button expand="block" fill="clear" (click)="add(g.type)"><ion-icon slot="start" name="add"></ion-icon>{{ g.addLabel }}</ion-button>
          </div>
        }
      </div>
    </ion-content>
  `,
  styles: `
    .body { display: flex; flex-direction: column; gap: 16px; padding: 4px 0 calc(110px + env(safe-area-inset-bottom)); }
    .pad { padding: 0 16px; display: flex; flex-direction: column; gap: 8px; }
    .grid3 { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
    .kpi { display: flex; flex-direction: column; gap: 4px; padding: 12px; border-radius: var(--mf-radius-lg); background: var(--ion-card-background); box-shadow: var(--mf-elevation-sm); min-width: 0; .t-headline { font-size: 15px; overflow: hidden; text-overflow: ellipsis; } }
    .note { margin: 0; padding: 0 4px; }
    .row { display: flex; align-items: center; gap: 12px; padding: 12px 16px; width: 100%; background: var(--ion-card-background); text-align: left; }
    .row.off { opacity: 0.5; }
    .text { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  `,
})
export class RecurringPage {
  private readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);

  private readonly current = (r: Recurring) => r.active && !this.ended(r);
  readonly totals = computed(() => {
    const live = this.store.recurring().filter(this.current);
    const income = round2(live.filter((r) => r.type === 'income').reduce((s, r) => s + r.amount, 0));
    const expense = round2(live.filter((r) => r.type === 'expense').reduce((s, r) => s + r.amount, 0));
    return { income, expense, net: round2(income - expense) };
  });
  readonly groups = computed(() => {
    const sort = (a: Recurring, b: Recurring) => a.day - b.day;
    const all = this.store.recurring();
    return [
      { title: 'Receitas', type: 'income' as const, items: all.filter((r) => r.type === 'income').sort(sort), empty: 'Cadastre seu salário e outras entradas mensais.', addLabel: 'Nova receita recorrente' },
      { title: 'Contas a pagar', type: 'expense' as const, items: all.filter((r) => r.type === 'expense').sort(sort), empty: 'Cadastre contas que se repetem: celular, internet, aluguel…', addLabel: 'Nova conta fixa' },
    ];
  });

  ended(r: Recurring): boolean {
    return !!r.endMonth && r.endMonth < monthKey(new Date());
  }
  cat(r: Recurring) {
    return this.store.category(r.categoryId);
  }
  meta(r: Recurring): string {
    const src = r.cardId ? this.store.card(r.cardId)?.name : this.store.account(r.accountId)?.name;
    const when = r.type === 'income' ? `por volta do dia ${r.day}` : `vence dia ${r.day}`;
    const end = !r.active ? ' · pausada' : this.ended(r) ? ' · encerrada' : r.endMonth ? ` · até ${monthShortLabel(r.endMonth)}` : '';
    return `${when} · ${src ?? ''}${end}`;
  }

  async add(type: 'income' | 'expense'): Promise<void> {
    await openRecurringForm(this.modal, { presetType: type });
  }
  async edit(r: Recurring): Promise<void> {
    await openRecurringForm(this.modal, { ruleId: r.id });
  }
}
