import { ApplicationConfig, LOCALE_ID, isDevMode, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { PreloadAllModules, RouteReuseStrategy, provideRouter, withComponentInputBinding, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { StoreService } from './core/services/store.service';
import { ThemeService } from './core/services/theme.service';
import { NotificationService } from './core/services/notification.service';
import { registerIcons } from './core/icons';

registerLocaleData(localePt);
registerIcons();

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideIonicAngular({ mode: 'ios', backButtonText: 'Voltar', swipeBackEnabled: true }),
    // PWA: funciona offline e atualiza sozinho (somente na build de produção)
    provideServiceWorker('ngsw-worker.js', { enabled: !isDevMode(), registrationStrategy: 'registerWhenStable:30000' }),
    provideRouter(routes, withPreloading(PreloadAllModules), withComponentInputBinding()),
    provideAppInitializer(() => {
      const store = inject(StoreService);
      inject(ThemeService);
      inject(NotificationService);
      return store.load();
    }),
  ],
};
