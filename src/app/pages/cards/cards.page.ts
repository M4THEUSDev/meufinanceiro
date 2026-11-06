import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, ModalController } from '@ionic/angular/standalone';
import { StoreService, defaultFilters } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { MONTHS, parseMoney, startOfDay } from '../../core/utils/format';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { SectionHeaderComponent } from '../../shared/components/section-header.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { openTransactionForm } from '../transactions/transaction-form.modal';
import { CardFormModal } from './card-form.modal';
import { CardVisualComponent } from './card-visual.component';
import { InvoiceModal } from './invoice.modal';

/** [Z2] Cartões · Visão geral */
@Component({
  selector: 'mf-cards',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, CardVisualComponent, CategoryIconComponent, SectionHeaderComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cards.page.html',
  styleUrl: './cards.page.scss',
})
export class CardsPage {
  protected readonly store = inject(StoreService);
  private readonly modal = inject(ModalController);
  private readonly ui = inject(UiService);
  private readonly router = inject(Router);
  private readonly alert = inject(AlertController);
  private readonly track = viewChild<ElementRef<HTMLDivElement>>('track');

  readonly index = signal(0);
  readonly cards = this.store.cards;
  readonly card = computed(() => this.cards()[Math.min(this.index(), this.cards().length - 1)]);
  readonly open = computed(() => (this.card() ? this.store.cardOpenAmount(this.card()!.id) : 0));
  readonly future = computed(() => (this.card() ? this.store.cardFutureAmount(this.card()!.id) : 0));
  readonly available = computed(() => (this.card()?.limit ?? 0) - this.open() - this.future());
  readonly openPct = computed(() => Math.min(100, (this.open() / (this.card()?.limit || 1)) * 100));
  readonly futurePct = computed(() => Math.min(100 - this.openPct(), (this.future() / (this.card()?.limit || 1)) * 100));
  readonly due = computed(() => (this.card() ? this.store.nextDueDate(this.card()!) : new Date()));
  readonly closing = computed(() => {
    const c = this.card();
    if (!c) return new Date();
    const due = this.due();
    const d = new Date(due.getFullYear(), due.getMonth(), c.closingDay);
    if (d > due) d.setMonth(d.getMonth() - 1);
    return d;
  });
  readonly status = computed(() => {
    const today = startOfDay(new Date());
    if (this.open() <= 0) return { label: 'Paga', cls: 'ok' };
    if (today >= this.closing()) return { label: 'Fechada', cls: 'closed' };
    return { label: 'Aberta', cls: 'ok' };
  });
  readonly invoiceMonth = computed(() => MONTHS[this.due().getMonth()]);
  readonly recent = computed(() => {
    const now = Date.now();
    return this.store.transactions().filter((t) => t.cardId === this.card()?.id && new Date(t.date).getTime() <= now && !t.installment).slice(0, 3);
  });
  readonly plans = computed(() => (this.card() ? this.store.installmentPlans(this.card()!.id) : []));

  dm(d: Date): string {
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  short(iso: string): string {
    return this.dm(new Date(iso));
  }
  catName(id: string): string {
    return this.store.category(id)?.name ?? '';
  }

  onScroll(): void {
    const el = this.track()?.nativeElement;
    if (!el) return;
    const w = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 12 : el.clientWidth;
    const i = Math.round(el.scrollLeft / w);
    if (i !== this.index()) this.index.set(i);
  }

  goTo(i: number): void {
    const el = this.track()?.nativeElement;
    const child = el?.children[i] as HTMLElement | undefined;
    if (el && child) el.scrollTo({ left: child.offsetLeft - 16, behavior: 'smooth' });
    this.index.set(i);
  }

  async add(): Promise<void> {
    const m = await this.modal.create({ component: CardFormModal, cssClass: 'mf-card-modal', presentingElement: document.querySelector('ion-tabs') as HTMLElement });
    await m.present();
    const { role } = await m.onWillDismiss();
    if (role === 'save') setTimeout(() => this.goTo(this.cards().length - 1), 100);
  }

  async edit(): Promise<void> {
    if (!this.card()) return;
    const m = await this.modal.create({ component: CardFormModal, componentProps: { cardId: this.card()!.id }, cssClass: 'mf-card-modal' });
    await m.present();
    const { role } = await m.onWillDismiss();
    if (role === 'delete') this.index.set(0);
  }

  /** para quem não lança compra por compra: informa só o total da fatura */
  async informInvoice(): Promise<void> {
    const c = this.card();
    if (!c) return;
    const a = await this.alert.create({
      header: `Fatura ${c.name}`,
      message: `Valor total da fatura que vence em ${this.dm(this.due())}. Compras já lançadas neste cartão são consideradas.`,
      inputs: [{ name: 'v', type: 'text', placeholder: '0,00', value: this.open() ? this.open().toFixed(2).replace('.', ',') : '', attributes: { inputmode: 'decimal' } }],
      buttons: [{ text: 'Cancelar', role: 'cancel' }, { text: 'Salvar', role: 'confirm' }],
    });
    await a.present();
    const { role, data } = await a.onDidDismiss();
    if (role !== 'confirm') return;
    const v = parseMoney(data?.values?.v ?? '');
    if (!(v > 0)) return;
    this.store.setInvoiceAmount(c.id, v);
    await this.ui.toast({ title: 'Fatura atualizada', message: `${c.name} · ${this.store.hidden() ? 'R$ •••••' : 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` });
  }

  async invoice(): Promise<void> {
    if (!this.card()) return;
    const m = await this.modal.create({ component: InvoiceModal, componentProps: { cardId: this.card()!.id }, cssClass: 'mf-card-modal' });
    await m.present();
  }

  async newPurchase(): Promise<void> {
    if (this.card()) await openTransactionForm(this.modal, this.ui, this.store, { presetType: 'expense', presetCardId: this.card()!.id });
  }

  seeAll(): void {
    this.store.filters.set({ ...defaultFilters(), period: 'last3' });
    void this.router.navigateByUrl('/tabs/transacoes');
  }

  openTx(id: string): void {
    void this.router.navigateByUrl(`/tabs/transacoes/${id}`);
  }
}
