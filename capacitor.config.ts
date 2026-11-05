import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.meufinanceiro.app',
  appName: 'MeuFinanceiro',
  webDir: 'www',
  ios: {
    contentInset: 'never',
    backgroundColor: '#10b981',
  },
  plugins: {
    // Figma · 02 App Icon & Splash: launchShowDuration 1200 ms, fade 300 ms
    SplashScreen: {
      launchShowDuration: 1200,
      launchFadeOutDuration: 300,
      backgroundColor: '#10b981',
      showSpinner: false,
      launchAutoHide: false,
    },
    StatusBar: {
      overlaysWebView: true,
    },
    LocalNotifications: {
      iconColor: '#10b981',
    },
  },
};

export default config;
