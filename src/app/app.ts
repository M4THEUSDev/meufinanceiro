import { Component, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { LockService } from './core/services/lock.service';
import { LockScreenComponent } from './shared/components/lock-screen.component';
import { OfflineBannerComponent } from './shared/components/offline-banner.component';

@Component({
  selector: 'mf-root',
  imports: [IonApp, IonRouterOutlet, LockScreenComponent, OfflineBannerComponent],
  template: `<ion-app><ion-router-outlet></ion-router-outlet></ion-app><mf-offline-banner></mf-offline-banner>@if (lock.locked()) { <mf-lock-screen></mf-lock-screen> }`,
})
export class App {
  protected readonly lock = inject(LockService);
  constructor() {
    this.lock.init();
  }
}
