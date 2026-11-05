import { ChangeDetectionStrategy, Component, computed, inject, input, output } from '@angular/core';
import { IonIcon } from '@ionic/angular/standalone';
import { MoneyPipe } from '../pipes/money.pipe';
import { StoreService } from '../../core/services/store.service';
import { pct } from '../../core/utils/format';

/** FinancialBalanceCard — saldo consolidado com gradiente primário; olho alterna "ocultar valores" (persistido). */
@Component({
  selector: 'mf-balance-card',
  imports: [IonIcon, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="decor d1"></div>
    <div class="decor d2"></div>
    <div class="top">
      <div class="label"><ion-icon name="wallet-outline"></ion-icon><span class="t-subhead-sb">Saldo total</span></div>
      <button class="mf-reset eye" type="button" (click)="store.toggleHidden()" [attr.aria-label]="store.hidden() ? 'Mostrar valores' : 'Ocultar valores'">
        <ion-icon [name]="store.hidden() ? 'eye-off-outline' : 'eye-outline'"></ion-icon>
      </button>
    </div>
    <p class="t-amount-display amount">{{ amount() | money }}</p>
    <div class="bottom">
      <span class="delta">
        <ion-icon [name]="deltaUp() ? 'trending-up' : 'trending-down'"></ion-icon>
        <span class="t-caption1-md">{{ deltaLabel() }}</span>
      </span>
      <button class="mf-reset accounts t-footnote" type="button" (click)="accountsClick.emit()">
        {{ accountsCount() }} {{ accountsCount() === 1 ? 'conta' : 'contas' }}
        <ion-icon name="chevron-forward"></ion-icon>
      </button>
    </div>
  `,
  styles: `
    :host {
      position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 12px;
      padding: 20px; border-radius: var(--mf-radius-xl); color: #fff;
      background: var(--mf-gradient-brand); box-shadow: var(--mf-elevation-brand);
    }
    .decor { position: absolute; border-radius: 50%; background: #fff; pointer-events: none; }
    .d1 { width: 180px; height: 180px; left: 230px; top: -60px; opacity: 0.08; }
    .d2 { width: 140px; height: 140px; left: 280px; top: 70px; opacity: 0.06; }
    .top, .bottom { position: relative; display: flex; align-items: center; justify-content: space-between; }
    .label { display: flex; align-items: center; gap: 6px; }
    .label ion-icon { font-size: 18px; }
    .eye { width: 36px; height: 36px; border-radius: 999px; background: var(--mf-overlay-white-12); display: grid; place-items: center; color: #fff; }
    .eye ion-icon { font-size: 20px; }
    .amount { margin: 0; position: relative; white-space: nowrap; }
    .delta { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px 4px 8px; border-radius: 999px; background: var(--mf-overlay-white-12); }
    .delta ion-icon { font-size: 14px; }
    .accounts { display: inline-flex; align-items: center; gap: 4px; opacity: 0.85; color: #fff; min-height: 32px; }
    .accounts ion-icon { font-size: 14px; }
  `,
})
export class BalanceCardComponent {
  protected readonly store = inject(StoreService);
  readonly amount = input(0);
  /** variação percentual vs. mês anterior */
  readonly delta = input(0);
  readonly previousMonthLabel = input('mês anterior');
  readonly accountsCount = input(0);
  readonly accountsClick = output<void>();

  readonly deltaUp = computed(() => this.delta() >= 0);
  readonly deltaLabel = computed(() => `${this.delta() >= 0 ? '+' : '−'} ${pct(Math.abs(this.delta()), 1)} vs. ${this.previousMonthLabel()}`);
}
