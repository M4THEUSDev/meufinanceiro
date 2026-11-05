import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonHeader, IonIcon, IonSegment, IonSegmentButton, ModalController } from '@ionic/angular/standalone';
import { TxFilters } from '../../core/models/models';
import { StoreService, defaultFilters } from '../../core/services/store.service';
import { addMonths, monthKey, toDateInput } from '../../core/utils/format';
import { openPicker } from '../../shared/components/picker.modal';

type PeriodChip = 'this' | 'last' | 'last3' | 'year' | 'custom';

/** [J] Transações · Filtros (bottom sheet) */
@Component({
  selector: 'mf-filters',
  imports: [IonHeader, IonContent, IonIcon, IonButton, IonSegment, IonSegmentButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="clear()">Limpar</button>
        <span class="title">Filtros</span>
        <button type="button" class="strong" (click)="apply()">Aplicar</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="body">
        <p class="mf-label">Período</p>
        <div class="chips">
          @for (p of periods; track p.id) {
            <button type="button" class="chip" [class.on]="period() === p.id" (click)="period.set(p.id)">{{ p.label }}</button>
          }
        </div>
        @if (period() === 'custom') {
          <div class="range">
            <label class="mf-row no-lead"><span class="label">De</span><input class="value" type="date" [value]="from()" [max]="to() || null" (change)="from.set($any($event.target).value)" /></label>
            <label class="mf-row no-lead"><span class="label">Até</span><input class="value" type="date" [value]="to()" [min]="from() || null" (change)="to.set($any($event.target).value)" /></label>
          </div>
        }

        <p class="mf-label">Tipo</p>
        <ion-segment mode="ios" [value]="type()" (ionChange)="type.set($any($event).detail.value)">
          <ion-segment-button value="all">Todas</ion-segment-button>
          <ion-segment-button value="income">Receitas</ion-segment-button>
          <ion-segment-button value="expense">Despesas</ion-segment-button>
        </ion-segment>

        <p class="mf-label">Categorias</p>
        <div class="chips">
          @for (c of categories(); track c.id) {
            <button type="button" class="badge" [class.on]="cats().includes(c.id)" [style.--c]="'var(--mf-category-' + c.color + ')'" (click)="toggleCat(c.id)">
              <ion-icon [name]="c.icon"></ion-icon>{{ c.name }}
            </button>
          }
        </div>

        <p class="mf-label">Conta</p>
        <button class="mf-row account" type="button" (click)="pickAccount()">
          <span class="lead" [style.--lead]="accountColor()"><ion-icon name="wallet-outline"></ion-icon></span>
          <span class="label grow">{{ accountName() }}</span>
          <span class="value" style="flex:0 0 auto">{{ accountSub() }}</span>
          <ion-icon class="chev" name="chevron-forward"></ion-icon>
        </button>

        <ion-button expand="block" class="cta" (click)="apply()">
          {{ count() === 0 ? 'Nenhuma transação' : 'Mostrar ' + count() + (count() === 1 ? ' transação' : ' transações') }}
        </ion-button>
      </div>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 14px; }
    ion-content { --background: var(--ion-background-color); }
    .body { padding: 8px 16px 32px; display: flex; flex-direction: column; gap: 12px; }
    .mf-label { margin-top: 4px; }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; }
    .chip {
      height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--ion-border-color); background: var(--ion-card-background);
      font: inherit; font-size: 15px; font-weight: 600; letter-spacing: -0.15px; color: var(--ion-text-color); cursor: pointer;
    }
    .chip.on { background: var(--ion-text-color); color: var(--ion-card-background); border-color: var(--ion-text-color); }
    .badge {
      display: inline-flex; align-items: center; gap: 4px; height: 30px; padding: 0 10px 0 8px; border-radius: 999px; cursor: pointer;
      font: inherit; font-size: 13px; font-weight: 500; color: var(--c); border: 1px solid transparent;
      background: color-mix(in srgb, var(--c) 14%, var(--ion-card-background));
    }
    .badge ion-icon { font-size: 14px; }
    .badge.on { border-color: var(--c); }
    .account { border-radius: 12px; background: var(--ion-color-step-50); }
    .range { display: flex; flex-direction: column; border-radius: 12px; overflow: hidden; }
    .range input { color-scheme: light dark; }
    .cta { margin-top: 8px; }
  `,
})
export class FiltersModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);

  readonly periods: { id: PeriodChip; label: string }[] = [
    { id: 'this', label: 'Este mês' },
    { id: 'last', label: 'Mês passado' },
    { id: 'last3', label: 'Últimos 3 meses' },
    { id: 'year', label: 'Este ano' },
    { id: 'custom', label: 'Personalizado' },
  ];

  readonly period = signal<PeriodChip>('this');
  readonly from = signal('');
  readonly to = signal('');
  readonly type = signal<TxFilters['type']>('all');
  readonly cats = signal<string[]>([]);
  readonly accountId = signal<string | null>(null);
  private customMonth: string | null = null;

  readonly categories = computed(() => {
    const t = this.type();
    const all = this.store.categories();
    return t === 'all' ? [...all.filter((c) => c.type === 'expense'), ...all.filter((c) => c.type === 'income')] : all.filter((c) => c.type === t);
  });
  readonly accountName = computed(() => this.store.account(this.accountId() ?? undefined)?.name ?? 'Todas as contas');
  readonly accountSub = computed(() => (this.accountId() ? '' : `${this.store.activeAccounts().length} contas`));
  readonly accountColor = computed(() => {
    const a = this.store.account(this.accountId() ?? undefined);
    return a ? `var(--mf-category-${a.color})` : 'var(--ion-color-primary)';
  });

  readonly result = computed<TxFilters>(() => {
    const cur = this.store.filters();
    const now = monthKey(new Date());
    const base: TxFilters = { ...cur, type: this.type(), categoryIds: this.cats(), accountId: this.accountId() };
    switch (this.period()) {
      case 'this': return { ...base, period: 'month', month: this.customMonth ?? now };
      case 'last': return { ...base, period: 'month', month: addMonths(now, -1) };
      case 'last3': return { ...base, period: 'last3' };
      case 'year': return { ...base, period: 'year' };
      case 'custom': return { ...base, period: 'custom', from: this.from() || undefined, to: this.to() || undefined };
    }
  });
  readonly count = computed(() => this.store.filterTransactions(this.result()).length);

  ngOnInit(): void {
    const f = this.store.filters();
    const now = monthKey(new Date());
    if (f.period === 'month') {
      if (f.month === addMonths(now, -1)) this.period.set('last');
      else {
        this.period.set('this');
        if (f.month !== now) this.customMonth = f.month;
      }
    } else if (f.period === 'last3') this.period.set('last3');
    else if (f.period === 'year') this.period.set('year');
    else if (f.period === 'custom') this.period.set('custom');
    this.from.set(f.from ?? toDateInput(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()));
    this.to.set(f.to ?? toDateInput(new Date().toISOString()));
    this.type.set(f.type);
    this.cats.set([...f.categoryIds]);
    this.accountId.set(f.accountId);
  }

  toggleCat(id: string): void {
    this.cats.update((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  }

  async pickAccount(): Promise<void> {
    const id = await openPicker(this.modalCtrl, {
      title: 'Conta',
      selected: this.accountId() ?? '__all__',
      options: [
        { id: '__all__', label: 'Todas as contas', icon: 'wallet-outline', color: 'salario' },
        ...this.store.accounts().map((a) => ({ id: a.id, label: a.name, icon: a.icon, color: a.color, subtitle: a.active ? undefined : 'Desativada' })),
      ],
    });
    if (id) this.accountId.set(id === '__all__' ? null : id);
  }

  clear(): void {
    this.customMonth = null;
    this.period.set('this');
    this.type.set('all');
    this.cats.set([]);
    this.accountId.set(null);
  }

  apply(): void {
    const r = this.result();
    this.store.filters.set({ ...r, search: this.store.filters().search });
    void this.modalCtrl.dismiss(r, 'apply');
  }
}
