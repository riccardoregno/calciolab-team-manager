import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'it.calciolab.coach',
  appName: 'CalcioLab',
  webDir: 'dist',
  server: {
    // Usa HTTPS su Android per garantire compatibilità con Supabase e cookie
    androidScheme: 'https',
  },

  // ── Deep linking ──────────────────────────────────────────────────────────────
  // Android App Links: intent-filter in AndroidManifest.xml + assetlinks.json
  // iOS Universal Links: Associated Domains capability in Xcode
  //   1. Xcode → Signing & Capabilities → + Capability → Associated Domains
  //   2. Aggiungi: applinks:calciolab.it
  //   3. Sostituisci REPLACE_APPLE_TEAM_ID in public/.well-known/apple-app-site-association
  //   4. Per SHA-256 Android: keytool -list -v -keystore android/calciolab-release.jks
  // ─────────────────────────────────────────────────────────────────────────────

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
