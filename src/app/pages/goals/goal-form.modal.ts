import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonButton, IonContent, IonDatetime, IonHeader, IonIcon, IonModal, ModalController } from '@ionic/angular/standalone';
import { CategoryColor } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, MONTHS, addMonths, cap, money, monthKey, parseMonthKey, round2 } from '../../core/utils/format';
import { CurrencyInputComponent } from '../../shared/components/currency-input.component';
import { openPicker } from '../../shared/components/picker.modal';
import { GOAL_PRESETS } from './goal-presets';

/** [W] Metas · Nova meta (também edita) */
@Component({
  selector: 'mf-goal-form',
  imports: [FormsModule, IonHeader, IonContent, IonIcon, IonButton, IonModal, IonDatetime, CurrencyInputComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ion-header class="ion-no-border">
      <div class="mf-modal-toolbar">
        <button type="button" (click)="cancel()">Cancelar</button>
        <span class="title">{{ goalId ? 'Editar meta' : 'Nova meta' }}</span>
        <button type="button" class="strong" (click)="save()">Salvar</button>
      </div>
    </ion-header>
    <ion-content>
      <div class="mf-modal-body">
        <div class="icons" role="radiogroup" aria-label="Ícone da meta">
          @for (p of presets; track p.icon) {
            <button type="button" class="ic" role="radio" [attr.aria-checked]="icon() === p.icon" [class.on]="icon() === p.icon"
              [style.--c]="'var(--mf-category-' + p.color + ')'" (click)="icon.set(p.icon); color.set(p.color)">
              <ion-icon [name]="p.icon"></ion-icon>
            </button>
          }
        </div>

        <div class="pad">
          <label class="t-footnote-sb c-secondary" for="goal-name">Nome da meta</label>
          <span class="field" [class.invalid]="submitted() && !name().trim()">
            <ion-icon name="flag-outline"></ion-icon>
            <input id="goal-name" type="text" maxlength="40" placeholder="Ex.: Viagem ao Japão" [ngModel]="name()" (ngModelChange)="name.set($event)" />
          </span>
          @if (submitted() && !name().trim()) { <p class="err">Dê um nome para a meta.</p> }
        </div>

        <div class="pad">
          <mf-currency-input [(value)]="target" tone="income" label="Valor desejado"></mf-currency-input>
          @if (submitted() && target() <= 0) { <p class="err">Informe o valor desejado.</p> }
        </div>

        <div class="pad">
          <div class="mf-group">
            @if (!goalId) {
              <button class="mf-row" type="button" (click)="initialOpen.set(true)">
                <span class="lead" style="--lead: var(--mf-category-salario)"><ion-icon name="cash-outline"></ion-icon></span>
                <span class="label">Valor inicial</span><span class="value">{{ fmt(initial()) }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
              </button>
            }
            <button class="mf-row" type="button" (click)="dateOpen.set(true)">
              <span class="lead" style="--lead: var(--mf-category-transporte)"><ion-icon name="calendar-outline"></ion-icon></span>
              <span class="label">Data prevista</span><span class="value">{{ deadlineLabel() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
            </button>
            <button class="mf-row" type="button" (click)="pickAccount()">
              <span class="lead" style="--lead: var(--mf-category-extra)"><ion-icon name="wallet-outline"></ion-icon></span>
              <span class="label">Guardar em</span><span class="value">{{ accountName() }}</span><ion-icon class="chev" name="chevron-forward"></ion-icon>
            </button>
          </div>
        </div>

        @if (plan(); as p) {
          <div class="pad">
            <div class="plan">
              <ion-icon name="sparkles-outline"></ion-icon>
              <div><p class="t-subhead-sb c-primary-shade">Guarde {{ p.perMonth }} por mês</p><p class="t-footnote c-secondary">{{ p.text }}</p></div>
            </div>
          </div>
        }

        <div class="pad">
          <ion-button expand="block" (click)="save()">{{ goalId ? 'Salvar meta' : 'Criar meta' }}</ion-button>
          @if (goalId) {
            <ion-button expand="block" class="tonal-danger" (click)="remove()"><ion-icon slot="start" name="trash-outline"></ion-icon>Excluir meta</ion-button>
          }
        </div>
      </div>

      <ion-modal [isOpen]="dateOpen()" (didDismiss)="dateOpen.set(false)" [breakpoints]="[0, 0.45]" [initialBreakpoint]="0.45" class="mf-sheet">
        <ng-template>
          <div class="sheet">
            <div class="mf-modal-toolbar"><span></span><span class="title">Data prevista</span><button type="button" class="strong" (click)="dateOpen.set(false)">OK</button></div>
            <ion-datetime presentation="month-year" locale="pt-BR" [min]="minMonth + '-01'" [max]="'2050-12-31'" [value]="deadline() + '-01'" (ionChange)="onDeadline($any($event).detail.value)"></ion-datetime>
          </div>
        </ng-template>
      </ion-modal>

      <ion-modal [isOpen]="initialOpen()" (didDismiss)="initialOpen.set(false)" [breakpoints]="[0, 0.42]" [initialBreakpoint]="0.42" class="mf-sheet">
        <ng-template>
          <div class="sheet">
            <div class="mf-modal-toolbar"><span></span><span class="title">Valor inicial</span><button type="button" class="strong" (click)="initialOpen.set(false)">OK</button></div>
            <div style="padding: 0 16px"><mf-currency-input [(value)]="initial" tone="neutral" label="Quanto você já tem guardado?"></mf-currency-input></div>
          </div>
        </ng-template>
      </ion-modal>
    </ion-content>
  `,
  styles: `
    ion-header { background: var(--ion-background-color); padding-top: 6px; }
    ion-content { --background: var(--ion-background-color); }
    .icons { display: flex; gap: 10px; padding: 0 16px; overflow-x: auto; scrollbar-width: none; }
    .ic { position: relative; isolation: isolate; flex: 0 0 auto; width: 48px; height: 48px; border-radius: 12px; border: 0; background: none; color: var(--c); display: grid; place-items: center; font-size: 22px; cursor: pointer; }
    .ic::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--c); opacity: 0.14; z-index: -1; }
    .ic.on { box-shadow: inset 0 0 0 2px var(--c); }
    .field { height: 50px; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-radius: 12px; background: var(--ion-card-background); border: 1px solid var(--ion-border-color); }
    .field.invalid { border: 2px solid var(--ion-color-danger); padding: 0 15px; }
    .field ion-icon { font-size: 20px; color: var(--mf-text-secondary); }
    .field input { flex: 1; min-width: 0; border: 0; outline: 0; background: transparent; font: inherit; font-size: 17px; color: var(--ion-text-color); }
    .plan { position: relative; isolation: isolate; display: flex; gap: 12px; align-items: center; padding: 14px 16px; border-radius: var(--mf-radius-lg); }
    .plan::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: var(--ion-color-primary); opacity: 0.12; z-index: -1; }
    .plan ion-icon { font-size: 20px; color: var(--ion-color-primary-shade); flex: 0 0 auto; }
    .plan p { margin: 0; }
    .err { color: var(--ion-color-danger); font-size: 13px; margin: 0; }
    .sheet { padding: 8px 0 24px; background: var(--ion-background-color); }
    ion-datetime { margin: 0 auto; --background: var(--ion-background-color); }
  `,
})
export class GoalFormModal implements OnInit {
  private readonly store = inject(StoreService);
  private readonly modalCtrl = inject(ModalController);
  private readonly ui = inject(UiService);

  goalId?: string;

  readonly presets = GOAL_PRESETS;
  readonly minMonth = monthKey(new Date());
  readonly icon = signal(GOAL_PRESETS[0].icon);
  readonly color = signal<CategoryColor>(GOAL_PRESETS[0].color);
  readonly name = signal('');
  readonly target = signal(0);
  readonly initial = signal(0);
  readonly deadline = signal(addMonths(monthKey(new Date()), 12));
  readonly accountId = signal<string | null>(null);
  readonly submitted = signal(false);
  readonly dateOpen = signal(false);
  readonly initialOpen = signal(false);

  readonly deadlineLabel = computed(() => {
    const d = parseMonthKey(this.deadline());
    return `${cap(MONTHS[d.getMonth()])} de ${d.getFullYear()}`;
  });
  readonly accountName = computed(() => this.store.account(this.accountId() ?? undefined)?.name ?? 'Nenhuma');
  readonly months = computed(() => {
    const now = parseMonthKey(monthKey(new Date()));
    const d = parseMonthKey(this.deadline());
    return Math.max(1, (d.getFullYear() - now.getFullYear()) * 12 + d.getMonth() - now.getMonth());
  });
  readonly plan = computed(() => {
    const saved = this.goalId ? this.store.goalSaved(this.store.goal(this.goalId)!) : this.initial();
    const rest = round2(this.target() - saved);
    if (this.target() <= 0 || rest <= 0) return null;
    const per = rest / this.months();
    const d = parseMonthKey(this.deadline());
    return {
      perMonth: this.fmt(Math.ceil(per * 100) / 100),
      text: `para chegar a ${this.fmt(this.target())} em ${MONTHS[d.getMonth()]} de ${d.getFullYear()} (${this.months()} ${this.months() === 1 ? 'mês' : 'meses'}).`,
    };
  });

  ngOnInit(): void {
    const g = this.goalId ? this.store.goal(this.goalId) : undefined;
    if (g) {
      this.icon.set(g.icon);
      this.color.set(g.color);
      this.name.set(g.name);
      this.target.set(g.target);
      this.deadline.set(g.deadline);
      this.accountId.set(g.accountId ?? null);
    } else {
      const poup = this.store.activeAccounts().find((a) => a.kind === 'poupanca' || a.kind === 'investimento');
      this.accountId.set(poup?.id ?? null);
    }
  }

  fmt(v: number): string {
    return this.store.hidden() ? HIDDEN_MASK : money(v);
  }

  onDeadline(v: string | string[] | null | undefined): void {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) this.deadline.set(s.slice(0, 7));
  }

  async pickAccount(): Promise<void> {
    const id = await openPicker(this.modalCtrl, {
      title: 'Guardar em',
      selected: this.accountId() ?? '__none__',
      options: [
        { id: '__none__', label: 'Nenhuma conta', subtitle: 'Apenas acompanhar o progresso' },
        ...this.store.activeAccounts().map((a) => ({ id: a.id, label: a.name, icon: a.icon, color: a.color })),
      ],
    });
    if (id) this.accountId.set(id === '__none__' ? null : id);
  }

  cancel(): void {
    void this.modalCtrl.dismiss(null, 'cancel');
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    if (!this.name().trim() || this.target() <= 0) return;
    const data = { name: this.name().trim(), icon: this.icon(), color: this.color(), target: round2(this.target()), deadline: this.deadline(), accountId: this.accountId() ?? undefined };
    if (this.goalId) {
      const g = this.store.goal(this.goalId)!;
      const saved = this.store.goalSaved(g);
      this.store.updateGoal(this.goalId, { ...data, completedAt: saved >= data.target ? (g.completedAt ?? new Date().toISOString()) : undefined });
      await this.ui.toast({ title: 'Meta atualizada', message: data.name });
      void this.modalCtrl.dismiss(this.goalId, 'save');
    } else {
      const g = this.store.addGoal({ ...data, initial: this.initial() });
      await this.ui.toast({ title: 'Meta criada', message: `${g.name} · objetivo ${this.fmt(g.target)}` });
      void this.modalCtrl.dismiss(g.id, 'save');
    }
  }

  async remove(): Promise<void> {
    const g = this.goalId ? this.store.goal(this.goalId) : undefined;
    if (!g) return;
    const ok = await this.ui.confirm({ header: 'Excluir meta?', message: `“${g.name}” e todas as contribuições serão removidas.`, confirmText: 'Excluir', destructive: true });
    if (!ok) return;
    this.store.deleteGoal(g.id);
    await this.ui.toast({ title: 'Meta excluída', message: g.name, tone: 'danger' });
    void this.modalCtrl.dismiss(null, 'delete');
  }
}
