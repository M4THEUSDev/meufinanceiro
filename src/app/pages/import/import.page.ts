import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import {
  IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonSpinner, IonTitle, IonToolbar, ModalController, NavController,
} from '@ionic/angular/standalone';
import { Transaction } from '../../core/models/models';
import { StoreService, defaultFilters } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { HIDDEN_MASK, money, round2, shortDate } from '../../core/utils/format';
import {
  BANKS, ParsedStatement, decodeStatement, guessCategory, isLikelyTransfer, learnKey, parseStatement, tidyDescription,
} from '../../core/utils/statement';
import { CategoryIconComponent } from '../../shared/components/category-icon.component';
import { openPicker } from '../../shared/components/picker.modal';

interface Row {
  importId: string;
  date: string;
  description: string;
  amount: number;
  categoryId: string | null;
  selected: boolean;
  duplicate: boolean;
  transfer: boolean;
}

/** Importar extrato (OFX / CSV) — tudo processado no próprio aparelho */
@Component({
  selector: 'mf-import',
  imports: [IonHeader, IonToolbar, IonTitle, IonButtons, IonBackButton, IonButton, IonContent, IonIcon, IonSpinner, CategoryIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './import.page.html',
  styleUrl: './import.page.scss',
})
export class ImportPage {
  protected readonly store = inject(StoreService);
  private readonly ui = inject(UiService);
  private readonly modal = inject(ModalController);
  private readonly nav = inject(NavController);
  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('file');

  readonly fileName = signal('');
  readonly parsed = signal<ParsedStatement | null>(null);
  readonly rows = signal<Row[]>([]);
  /** destino: "acc:<id>" ou "card:<id>" */
  readonly target = signal<string | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');

  readonly targetLabel = computed(() => {
    const t = this.target();
    if (!t) return 'Selecionar';
    const [kind, id] = t.split(':');
    return kind === 'card' ? (this.store.card(id)?.name ?? 'Cartão') : (this.store.account(id)?.name ?? 'Conta');
  });
  readonly isCardTarget = computed(() => this.target()?.startsWith('card:') ?? false);
  readonly selected = computed(() => this.rows().filter((r) => r.selected && !r.duplicate));
  readonly totals = computed(() => {
    let inc = 0;
    let exp = 0;
    for (const r of this.selected()) r.amount > 0 ? (inc += r.amount) : (exp += -r.amount);
    return { inc: round2(inc), exp: round2(exp) };
  });
  readonly period = computed(() => {
    const ds = this.rows().map((r) => r.date).sort();
    return ds.length ? `${shortDate(ds[0])} a ${shortDate(ds.at(-1)!)}` : '';
  });
  readonly dupCount = computed(() => this.rows().filter((r) => r.duplicate).length);
  readonly uncategorized = computed(() => this.selected().filter((r) => !r.categoryId).length);

  pick(): void {
    this.fileInput()?.nativeElement.click();
  }

  async onFile(ev: Event): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const text = decodeStatement(await file.arrayBuffer());
      const p = parseStatement(text, file.name);
      if (!p.lines.length) {
        this.error.set('Não encontramos lançamentos neste arquivo. Use o extrato em OFX ou o CSV exportado pelo banco.');
        this.parsed.set(null);
        this.rows.set([]);
        return;
      }
      this.fileName.set(file.name);
      this.parsed.set(p);
      this.target.set(this.guessTarget(p));
      this.buildRows(p);
    } catch {
      this.error.set('Não foi possível ler o arquivo. Verifique se é um extrato OFX ou CSV.');
    } finally {
      this.busy.set(false);
    }
  }

  private guessTarget(p: ParsedStatement): string | null {
    const name = (p.bankName ?? '').toLowerCase();
    const match = (n: string) => !!name && (n.toLowerCase().includes(name) || name.includes(n.toLowerCase()));
    if (p.isCard) {
      const c = this.store.cards().find((x) => match(x.bank) || match(x.name));
      if (c) return `card:${c.id}`;
    }
    const a = this.store.activeAccounts().find((x) => match(x.name));
    if (a) return `acc:${a.id}`;
    return null;
  }

  private buildRows(p: ParsedStatement): void {
    // aprende com o histórico: mesma descrição → mesma categoria
    const learned = new Map<string, string>();
    for (const t of [...this.store.transactions()].reverse()) learned.set(`${t.type === 'expense' ? 'e' : 'i'}:${learnKey(t.description)}`, t.categoryId);
    const valid = new Set(this.store.categories().map((c) => c.id));
    this.rows.set(
      p.lines.map((l) => {
        const duplicate = this.store.hasImportId(l.importId);
        const transfer = isLikelyTransfer(l.description) || (p.isCard && l.amount > 0);
        const fallback = l.amount < 0 ? (valid.has('c_outros_d') ? 'c_outros_d' : null) : (valid.has('c_outros_r') ? 'c_outros_r' : null);
        return {
          ...l,
          description: tidyDescription(l.description),
          categoryId: guessCategory(l.description, l.amount, valid, learned) ?? fallback,
          duplicate,
          transfer,
          selected: !duplicate && !transfer,
        };
      }),
    );
  }

  toggle(r: Row): void {
    if (r.duplicate) return;
    this.rows.update((list) => list.map((x) => (x.importId === r.importId ? { ...x, selected: !x.selected } : x)));
  }

  toggleAll(on: boolean): void {
    this.rows.update((list) => list.map((x) => (x.duplicate ? x : { ...x, selected: on ? x.selected || !x.transfer : false })));
  }

  async pickCategory(r: Row, ev: Event): Promise<void> {
    ev.stopPropagation();
    const type = r.amount < 0 ? 'expense' : 'income';
    const id = await openPicker(this.modal, {
      title: 'Categoria',
      selected: r.categoryId,
      searchable: true,
      options: this.store.categoriesOf(type).map((c) => ({ id: c.id, label: c.name, icon: c.icon, color: c.color })),
    });
    if (!id) return;
    // aplica a mesma categoria às linhas com descrição parecida ainda não alteradas
    const key = learnKey(r.description);
    this.rows.update((list) =>
      list.map((x) => (x.importId === r.importId || (learnKey(x.description) === key && Math.sign(x.amount) === Math.sign(r.amount)) ? { ...x, categoryId: id } : x)),
    );
  }

  async pickTarget(): Promise<void> {
    const p = this.parsed();
    const opts = [
      ...this.store.activeAccounts().map((a) => ({ id: `acc:${a.id}`, label: a.name, icon: a.icon, color: a.color, group: 'Contas' })),
      ...this.store.cards().map((c) => ({ id: `card:${c.id}`, label: c.name, icon: 'card-outline', color: 'outros' as const, group: 'Cartões de crédito' })),
      { id: '__new__', label: `Criar conta ${p?.bankName ?? ''}`.trim(), icon: 'add', color: 'salario' as const, group: 'Nova' },
    ];
    const id = await openPicker(this.modal, { title: 'Lançar em', selected: this.target(), options: opts });
    if (!id) return;
    if (id === '__new__') {
      const name = p?.bankName && Object.values(BANKS).includes(p.bankName) ? p.bankName : 'Nova conta';
      const acc = this.store.addAccount({
        name, kind: 'corrente', icon: 'business-outline', color: 'transporte', initialBalance: 0, active: true, includeInTotal: true,
      });
      this.target.set(`acc:${acc.id}`);
      await this.ui.toast({ title: 'Conta criada', message: `${name} · ajuste o saldo depois em Minhas contas`, tone: 'info' });
    } else this.target.set(id);
  }

  fmt(v: number): string {
    return this.store.hidden() ? HIDDEN_MASK : money(v, { sign: true });
  }
  plain(v: number): string {
    return this.store.hidden() ? HIDDEN_MASK : money(v);
  }
  date(iso: string): string {
    return shortDate(iso).slice(0, 5);
  }
  cat(id: string | null) {
    return this.store.category(id ?? undefined);
  }

  async import(): Promise<void> {
    const t = this.target();
    if (!t) {
      await this.pickTarget();
      if (!this.target()) return;
    }
    const [kind, id] = this.target()!.split(':');
    const card = kind === 'card' ? this.store.card(id) : undefined;
    const accountId = card ? card.accountId : id;
    const list: Omit<Transaction, 'id' | 'createdAt'>[] = this.selected().map((r) => ({
      type: r.amount < 0 ? 'expense' : 'income',
      description: r.description,
      amount: Math.abs(r.amount),
      categoryId: r.categoryId ?? (r.amount < 0 ? 'c_outros_d' : 'c_outros_r'),
      accountId,
      cardId: card && r.amount < 0 ? card.id : undefined,
      date: r.date,
      paid: true,
      importId: r.importId,
      notes: `Importado de ${this.fileName()}`,
    }));
    const n = this.store.importTransactions(list);
    await this.ui.toast({
      title: n ? 'Extrato importado' : 'Nada novo para importar',
      message: n ? `${n} ${n === 1 ? 'lançamento adicionado' : 'lançamentos adicionados'} em ${this.targetLabel()}` : 'Todos os lançamentos já estavam no app.',
      tone: n ? 'success' : 'info',
    });
    if (n) {
      const dates = list.map((x) => x.date.slice(0, 10)).sort();
      this.store.filters.set({ ...defaultFilters(), period: 'custom', from: dates[0], to: dates.at(-1) });
      void this.nav.navigateRoot('/tabs/transacoes');
    }
  }

  reset(): void {
    this.parsed.set(null);
    this.rows.set([]);
    this.fileName.set('');
    this.error.set('');
  }
}
