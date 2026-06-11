import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutriguard.app',
  appName: 'NutriGuard AI',
  webDir: 'public',
  server: {
    url: 'https://nutriguard-mobile-app.vercel.app',
    cleartext: true
  }
};

export default config;
