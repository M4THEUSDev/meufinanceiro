import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CreditCard } from '../../core/models/models';
import { StoreService } from '../../core/services/store.service';

export const CARD_THEMES: Record<CreditCard['theme'], string> = {
  platinum: 'linear-gradient(150deg, #34d399 0%, #10b981 35%, #047857 75%, #064e3b 100%)',
  grafite: 'linear-gradient(150deg, #475569 0%, #334155 45%, #0f172a 100%)',
  roxo: 'linear-gradient(150deg, #a78bfa 0%, #7c3aed 50%, #4c1d95 100%)',
  verde: 'linear-gradient(150deg, #5eead4 0%, #14b8a6 45%, #115e59 100%)',
  xp: 'linear-gradient(150deg, #27272a 0%, #18181b 55%, #000000 100%)',
};

/** Cartão de crédito visual (carrossel) */
@Component({
  selector: 'mf-card-visual',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[style.background]': 'bg()' },
  template: `
    <i class="c1"></i><i class="c2"></i>
    <div class="top">
      <div><p class="bank">{{ card().bank }}</p><p class="tier">{{ card().tier }}</p></div>
      <span class="brand" [attr.aria-label]="card().brand"><i></i><i></i></span>
    </div>
    <span class="chip"></span>
    <p class="num">••••&nbsp;&nbsp;••••&nbsp;&nbsp;••••&nbsp;&nbsp;{{ card().last4 }}</p>
    <div class="bottom"><span>{{ holder() }}</span><span>Vence dia {{ card().dueDay }}</span></div>
  `,
  styles: `
    :host { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 14px; padding: 20px; border-radius: 20px; color: #fff; height: 200px; box-sizing: border-box; box-shadow: var(--mf-elevation-lg); }
    p { margin: 0; }
    .c1, .c2 { position: absolute; border-radius: 50%; background: rgba(255,255,255,0.08); pointer-events: none; }
    .c1 { width: 260px; height: 260px; right: -90px; top: -40px; }
    .c2 { width: 180px; height: 180px; left: -60px; bottom: -100px; }
    .top { position: relative; display: flex; justify-content: space-between; }
    .bank { font-size: 15px; font-weight: 600; letter-spacing: -0.15px; }
    .tier { font-size: 12px; opacity: 0.75; }
    .brand { display: flex; }
    .brand i { width: 26px; height: 26px; border-radius: 50%; background: rgba(255,255,255,0.45); }
    .brand i + i { margin-left: -10px; background: rgba(255,255,255,0.3); }
    .chip { position: relative; width: 40px; height: 30px; border-radius: 6px; background: linear-gradient(135deg, #fde68a, #d4a537); }
    .num { position: relative; font-size: 17px; font-weight: 600; letter-spacing: 1px; font-variant-numeric: tabular-nums; }
    .bottom { position: relative; display: flex; justify-content: space-between; font-size: 13px; font-weight: 500; margin-top: auto; }
  `,
})
export class CardVisualComponent {
  private readonly store = inject(StoreService);
  readonly card = input.required<CreditCard>();
  readonly bg = computed(() => CARD_THEMES[this.card().theme] ?? CARD_THEMES.platinum);
  readonly holder = computed(() => {
    const parts = this.store.settings().userName.trim().split(/\s+/);
    return (parts.length > 1 ? `${parts[0]} ${parts.at(-1)![0]}.` : parts[0]).toUpperCase();
  });
}
