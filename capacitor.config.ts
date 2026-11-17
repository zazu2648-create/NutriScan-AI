import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nutriscanai.app',
  appName: 'NutriScan AI',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // For local physical-device testing against your backend server, configure:
    // url: 'http://YOUR_LOCAL_LAN_IP:3000',
    // cleartext: true,
  },
  android: {
    allowMixedContent: false,
    backgroundColor: '#14532D',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#14532D',
      showSpinner: false,
    },
    LocalNotifications: {
      smallIcon: 'ic_launcher',
      iconColor: '#15803D',
    },
  },
};

export default config;
