import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { IonButton, IonContent, IonIcon, NavController } from '@ionic/angular/standalone';
import { StoreService } from '../../core/services/store.service';
import { UiService } from '../../core/services/ui.service';
import { DonutComponent, DonutSegment } from '../../shared/components/donut.component';

interface Slide {
  title: string;
  body: string;
}

/** [B][C][D] Onboarding — 3 páginas com swipe, indicador de página, Pular / Continuar / Começar */
@Component({
  selector: 'mf-onboarding',
  imports: [IonContent, IonButton, IonIcon, DonutComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './onboarding.page.html',
  styleUrl: './onboarding.page.scss',
})
export class OnboardingPage {
  private readonly nav = inject(NavController);
  private readonly store = inject(StoreService);
  private readonly ui = inject(UiService);
  private readonly track = viewChild.required<ElementRef<HTMLDivElement>>('track');

  readonly index = signal(0);
  readonly slides: Slide[] = [
    { title: 'Organize suas finanças', body: 'Registre receitas e despesas em segundos e acompanhe o saldo de todas as suas contas em um só lugar.' },
    { title: 'Entenda seus gastos', body: 'Gráficos e categorias mostram para onde vai cada real — e onde dá para economizar.' },
    { title: 'Conquiste seus objetivos', body: 'Planeje orçamentos mensais, crie metas e acompanhe o progresso até realizar cada sonho.' },
  ];

  /** fatias da ilustração 2 (proporções do Figma) */
  readonly donut: DonutSegment[] = [
    { value: 2.139, color: 'moradia' },
    { value: 1.511, color: 'compras' },
    { value: 0.568, color: 'alimentacao' },
    { value: 0.505, color: 'educacao' },
    { value: 0.38, color: 'transporte' },
    { value: 0.82, color: 'outros' },
  ];

  onScroll(): void {
    const el = this.track().nativeElement;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== this.index()) this.index.set(i);
  }

  goTo(i: number): void {
    const el = this.track().nativeElement;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
    this.index.set(i);
  }

  next(): void {
    this.ui.tap();
    if (this.index() < this.slides.length - 1) this.goTo(this.index() + 1);
    else this.finish();
  }

  finish(): void {
    this.store.updateSettings({ onboarded: true });
    void this.nav.navigateRoot('/login', { animationDirection: 'forward' });
  }
}
