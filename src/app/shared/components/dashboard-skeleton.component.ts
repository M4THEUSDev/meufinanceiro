import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Estado · Dashboard carregando (skeleton) */
@Component({
  selector: 'mf-dashboard-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-busy': 'true', 'aria-label': 'Carregando' },
  template: `
    <div class="row head"><i class="c40"></i><div class="col"><i class="l w90"></i><i class="l w120 h14"></i></div><i class="c40 ml"></i><i class="c40"></i></div>
    <div class="row center"><i class="l w160 h14"></i></div>
    <div class="card brand"><i class="l w90"></i><i class="l w220 h36"></i><i class="l w140 h18"></i></div>
    <div class="row two"><div class="card"><i class="l w110"></i><i class="l full h22"></i><i class="l full"></i></div><div class="card"><i class="l w110"></i><i class="l full h22"></i><i class="l full"></i></div></div>
    <div class="card"><i class="l w140"></i><div class="bars">@for (h of bars; track $index) { <i [style.height.px]="h"></i> }</div></div>
    <div class="card">@for (r of [1, 2]; track r) { <div class="row item"><i class="c32"></i><div class="col grow"><i class="l w140"></i><i class="l w90"></i></div><i class="l w60"></i></div> }</div>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 20px; padding: 0 16px; }
    i { display: block; background: var(--ion-color-step-50); border-radius: 999px; animation: pulse 1.2s ease-in-out infinite; }
    .row { display: flex; align-items: center; gap: 12px; }
    .col { display: flex; flex-direction: column; gap: 6px; }
    .grow { flex: 1; }
    .center { justify-content: center; }
    .ml { margin-left: auto; }
    .c40 { width: 40px; height: 40px; }
    .c32 { width: 36px; height: 36px; }
    .l { height: 10px; }
    .h14 { height: 14px; } .h18 { height: 18px; } .h22 { height: 22px; } .h36 { height: 36px; border-radius: 10px; }
    .w60 { width: 60px; } .w90 { width: 90px; } .w110 { width: 110px; } .w120 { width: 120px; } .w140 { width: 140px; } .w160 { width: 160px; } .w220 { width: 220px; }
    .full { width: 100%; }
    .card { background: var(--ion-card-background); border-radius: var(--mf-radius-xl); padding: 16px; display: flex; flex-direction: column; gap: 12px; }
    .card.brand { background: color-mix(in srgb, var(--ion-color-primary) 40%, var(--ion-background-color)); i { background: color-mix(in srgb, #fff 55%, transparent); } }
    .two > .card { flex: 1; }
    .bars { display: flex; align-items: flex-end; gap: 14px; height: 100px; i { flex: 1; border-radius: 6px; } }
    .item { padding: 4px 0; }
    @keyframes pulse { 50% { opacity: 0.55; } }
    @media (prefers-reduced-motion: reduce) { i { animation: none; } }
  `,
})
export class DashboardSkeletonComponent {
  readonly bars = [48, 72, 56, 88, 64, 96];
}
