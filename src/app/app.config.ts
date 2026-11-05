import { ApplicationConfig, LOCALE_ID, inject, provideAppInitializer, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { PreloadAllModules, RouteReuseStrategy, provideRouter, withPreloading } from '@angular/router';
import { IonicRouteStrategy, provideIonicAngular } from '@ionic/angular/standalone';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { routes } from './app.routes';
import { StoreService } from './core/services/store.service';
import { ThemeService } from './core/services/theme.service';
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
    provideRouter(routes, withPreloading(PreloadAllModules)),
    provideAppInitializer(async () => {
      await inject(StoreService).load();
      inject(ThemeService);
    }),
  ],
};
