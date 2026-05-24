import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.calciolab.coach',
  appName: 'CalcioLab',
  webDir: 'dist',
  server: {
    // Usa HTTPS su Android per garantire compatibilità con Supabase e cookie
    androidScheme: 'https',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1800,
      launchAutoHide: true,
      launchFadeOutDuration: 400,
      backgroundColor: '#0f172a',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'Dark',
      backgroundColor: '#0f172a',
      overlaysWebView: false,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#2563eb',
      sound: 'beep.wav',
    },
  },
};

export default config;
