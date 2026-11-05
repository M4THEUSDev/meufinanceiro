import { ChangeDetectionStrategy, Component, computed, input, model } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';

const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * CurrencyInput — campo de valor em destaque com máscara BRL.
 * Digitar números preenche da direita para a esquerda (centavos), como em apps bancários.
 */
@Component({
  selector: 'mf-currency-input',
  imports: [IonIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'tone()' },
  template: `
    <label class="t-footnote-sb c-secondary" [attr.for]="id">{{ label() }}</label>
    <div class="amount">
      <span class="t-amount-medium cur">R$</span>
      <input [id]="id" class="t-amount-display" type="text" inputmode="decimal" autocomplete="off"
        [value]="display()" [style.width.ch]="width()" (input)="onInput($event)" (focus)="select($event)" [attr.aria-label]="label()" />
    </div>
    <div class="hint"><ion-icon name="cash-outline"></ion-icon><span class="t-caption1 c-tertiary">{{ hint() }}</span></div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 20px 16px; border-radius: var(--mf-radius-lg); }
    :host(.expense) { background: var(--mf-expense-subtle); --amt: var(--ion-color-danger); }
    :host(.income) { background: var(--mf-income-subtle); --amt: var(--ion-color-success); }
    :host(.neutral) { background: var(--ion-color-primary-tint); --amt: var(--ion-color-primary-shade); }
    .amount { display: flex; align-items: center; gap: 6px; color: var(--amt); max-width: 100%; }
    input {
      border: 0; outline: 0; background: transparent; color: inherit; padding: 0; min-width: 2ch; text-align: left;
      font-family: inherit; caret-color: var(--amt); font-variant-numeric: tabular-nums;
    }
    .hint { display: flex; align-items: center; gap: 4px; color: var(--mf-text-tertiary); }
    .hint ion-icon { font-size: 14px; }
  `,
})
export class CurrencyInputComponent {
  private static seq = 0;
  readonly id = `mf-cur-${++CurrencyInputComponent.seq}`;
  readonly value = model(0);
  readonly label = input('Valor');
  readonly hint = input('Teclado numérico decimal');
  readonly tone = input<'expense' | 'income' | 'neutral'>('neutral');
  readonly display = computed(() => fmt.format(this.value() || 0));
  readonly width = computed(() => Math.max(4, this.display().length + 0.5));

  onInput(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    const digits = el.value.replace(/\D/g, '').slice(0, 13);
    const v = Number(digits || '0') / 100;
    this.value.set(v);
    el.value = fmt.format(v);
  }

  select(ev: Event): void {
    const el = ev.target as HTMLInputElement;
    setTimeout(() => el.setSelectionRange(el.value.length, el.value.length));
  }
}
