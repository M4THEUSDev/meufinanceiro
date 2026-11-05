import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { IonButton, IonContent, IonDatetime, IonIcon, IonModal, ModalController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { catColor } from '../../core/icons';
import { HIDDEN_MASK, daysBetween, fromDateInput, money, shortDate, toDateInput } from '../../core/utils/format';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';
import { openPicker } from '../../shared/components/picker.modal';

/** [X] Metas · Adicionar contribuição (bottom sheet) */
@Component({
  selector: 'mf-contribution',
  imports: [IonContent, IonIcon, IonButton, IonModal, IonDatetime, CategoryIconComponent, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-content>
      @if (goal(); as g) {
        <div class="body">
          <div class="head">
            <mf-category-icon [icon]="g.icon" [color]="g.color" [size]="40"></mf-category-icon>
            <div class="grow"><p class="t-footnote c-secondary">Contribuir para</p><p class="t-headline">{{ g.name }}</p></div>
            <button class="mf-reset close" type="button" aria-label="Fechar" (click)="close()"><ion-icon name="close"></ion-icon></button>
          </div>
          <mf-currency-input [(value)]="amount" tone="income" label="Valor da contribuição"></mf-currency-input>
          <div class="quick">
            @for (q of [100, 250, 500]; track q) {
              <button type="button" class="chip" [class.on]="lastQuick() === q" (click)="add(q)">+ R$ {{ q }}</button>
            }
          </div>
          <div class="mf-group">
            <button class="mf-row" type="button" (click)="pickAccount()">
              <span class="lead" [style.--lead]="accColor()"><ion-icon name="wallet-outline"></ion-icon></span>
              <span class="label">Debitar de</span><span class="value">{{ accName() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
            </button>
            <button class="mf-row" type="button" (click)="dateOpen.set(true)">
              <span class="lead" style="--lead: var(--mf-category-transporte)"><ion-icon name="calendar-outline"></ion-icon></span>
              <span class="label">Data</span><span class="value">{{ dateLabel() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
            </button>
          </div>
          @if (amount() > 0) {
            <p class="after t-footnote c-secondary"><ion-icon name="trending-up"></ion-icon>Após esta contribuição: {{ afterLabel() }}</p>
          }
          @if (submitted() && amount() <= 0) { <p class="err">Informe um valor maior que zero.</p> }
          <ion-button expand="block" (click)="save()">Adicionar contribuição</ion-button>
        </div>
      }
      <ion-modal [isOpen]="dateOpen()" (didDismiss)="dateOpen.set(false)" [breakpoints]="[0, 0.62]" [initialBreakpoint]="0.62" class="mf-sheet">
        <ng-template>
          <div class="sheet">
            <div class="mf-modal-toolbar"><span></span><span class="title">Data</span><button type="button" class="strong" (click)="dateOpen.set(false)">OK</button></div>
            <ion-datetime presentation="date" locale="pt-BR" [value]="date()" [max]="today" (ionChange)="onDate($any($event).detail.value)"></ion-datetime>
          </div>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    ion-content { --background: var(--ion-background-color); }
    .body { padding: 20px 16px 32px; display: flex; flex-direction: column; gap: 16px; }
    .head { display: flex; align-items: center; gap: 12px; }
    .head p { margin: 0; }
    .grow { flex: 1; min-width: 0; }
    .close { width: 30px; height: 30px; border-radius: 999px; background: var(--ion-color-step-50); display: grid; place-items: center; color: var(--mf-text-secondary); font-size: 18px; }
    .quick { display: flex; gap: 8px; }
    .chip { height: 34px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--ion-border-color); background: var(--ion-card-background); font: inherit; font-size: 15px; font-weight: 600; color: var(--ion-text-color); cursor: pointer; }
    .chip.on { background: var(--ion-text-color); color: var(--ion-card-background); border-color: var(--ion-text-color); }
    .after { display: flex; align-items: center; gap: 6px; margin: 0; }
    .after ion-icon { color: var(--ion-color-success); font-size: 16px; }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: 0; }
    .sheet { padding: 8px 0 24px; background: var(--ion-background-color); }
    ion-datetime { margin: 0 auto; --background: var(--ion-background-color); }
  `,
})
export class ContributionModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  goalId!: string;
  readonly today = toDateInput(new Date().toISOString());
  readonly amount = signal(0);
  readonly accountId = signal<string | null>(null);
  readonly date = signal(new Date().toISOString());
  readonly lastQuick = signal<number | null>(null);
  readonly dateOpen = signal(false);
  readonly submitted = signal(false);

  readonly goal = computed(() => this.store.goal(this.goalId));
  readonly accName = computed(() => this.store.account(this.accountId() ?? undefined)?.name ?? 'Não debitar');
  readonly accColor = computed(() => catColor(this.store.account(this.accountId() ?? undefined)?.color ?? 'outros'));
  readonly dateLabel = computed(() => `${daysBetween(new Date(this.date()), new Date()) === 0 ? 'Hoje, ' : ''}${shortDate(this.date())}`);
  readonly afterLabel = computed(() => {
    const g = this.goal();
    if (!g) return '';
    const total = this.store.goalSaved(g) + this.amount();
    const pct = Math.round((total / g.target) * 100);
    return `${this.store.hidden() ? HIDDEN_MASK : money(total)} (${pct}%)`;
  });

  ngOnInit(): void {
    const acc = this.store.activeAccounts().find((a) => a.kind === 'digital' || a.kind === 'corrente') ?? this.store.activeAccounts()[0];
    this.accountId.set(acc?.id ?? null);
  }

  add(v: number): void {
    this.amount.update((a) => Math.round((a + v) * 100) / 100);
    this.lastQuick.set(v);
    this.ui.tap();
  }

  async pickAccount(): Promise<void> {
    const id = await openPicker(this.modalCtrl, {
      title: 'Debitar de',
      selected: this.accountId() ?? '__none__',
      options: [
        { id: '__none__', label: 'Não debitar', subtitle: 'Registrar sem movimentar contas' },
        ...this.store.activeAccounts().map((a) => ({ id: a.id, label: a.name, icon: a.icon, color: a.color, subtitle: this.store.hidden() ? undefined : money(this.store.balanceOf(a.id)) })),
      ],
    });
    if (id) this.accountId.set(id === '__none__' ? null : id);
  }

  onDate(v: string | string[] | null | undefined): void {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) this.date.set(fromDateInput(s.slice(0, 10), this.date()));
  }

  close(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    const g = this.goal();
    if (!g || this.amount() <= 0) return;
    const wasDone = !!g.completedAt;
    this.store.addContribution(g.id, { amount: this.amount(), date: this.date(), accountId: this.accountId() ?? undefined });
    const now = this.store.goal(g.id);
    const v = this.store.hidden() ? HIDDEN_MASK : money(this.amount(), { sign: true });
    if (!wasDone && now?.completedAt) {
      await this.ui.toast({ title: 'Meta concluída! 🎉', message: `Você alcançou ${g.name}.` });
    } else {
      await this.ui.toast({ title: 'Contribuição adicionada', message: `${v} em ${g.name}` });
    }
    void this.modalCtrl.dismiss(true, 'save');
  }
}

export async function openContribution(modal: ModalController, goalId: string): Promise<boolean> {
  const m = await modal.create({ component: ContributionModal, componentProps: { goalId }, breakpoints: [0, 0.66, 1], initialBreakpoint: 0.66, cssClass: 'mf-sheet', handle: true });
  await m.present();
  const { role } = await m.onWillDismiss();
  return role === 'save';
}
