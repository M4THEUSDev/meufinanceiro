import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { StoreService } from './services/store.service';

/** exige onboarding concluído + sessão ativa */
export const authGuard: CanActivateFn = () => {
  const store = inject(StoreService);
  const router = inject(Router);
  const s = store.settings();
  if (!s.onboarded) return router.parseUrl('/onboarding');
  if (!s.loggedIn) return router.parseUrl('/login');
  return true;
};

/** evita voltar ao login quando já autenticado */
export const guestGuard: CanActivateFn = () => {
  const store = inject(StoreService);
  const router = inject(Router);
  return store.settings().loggedIn ? router.parseUrl('/tabs/inicio') : true;
};
