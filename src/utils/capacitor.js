/**
 * Capacitor utilities — rilevamento piattaforma e accesso ai plugin nativi.
 * Importabile ovunque. Tutti i valori sono falsy su web, quindi il codice
 * condizionale funziona senza guard aggiuntive.
 */

let _isNative = false;
let _platform  = 'web';

try {
  // @capacitor/core è sempre presente ma getPlatform() restituisce 'web' nel browser
  const { Capacitor } = await import('@capacitor/core');
  _isNative = Capacitor.isNativePlatform();
  _platform  = Capacitor.getPlatform(); // 'web' | 'ios' | 'android'
} catch {
  // fallback silenzioso: rimane web
}

/** true solo quando si gira dentro Capacitor (iOS o Android) */
export const isNative   = _isNative;

/** 'web' | 'ios' | 'android' */
export const platform   = _platform;

export const isIOS      = _platform === 'ios';
export const isAndroid  = _platform === 'android';

// ── Plugin helpers ────────────────────────────────────────────────────────────
// Lazy-carica i plugin nativi solo su piattaforma nativa per evitare bundle bloat.

/** Nasconde lo splash screen (chiamare quando l'app è pronta) */
export async function hideSplashScreen() {
  if (!_isNative) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch {}
}

/** Imposta lo stile della status bar */
export async function setStatusBarDark() {
  if (!_isNative) return;
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    if (isAndroid) {
      await StatusBar.setBackgroundColor({ color: '#0f172a' });
    }
  } catch {}
}

/** Feedback aptico leggero (tap) */
export async function hapticLight() {
  if (!_isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Light });
  } catch {}
}

/** Feedback aptico medio (azione importante) */
export async function hapticMedium() {
  if (!_isNative) return;
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ style: ImpactStyle.Medium });
  } catch {}
}

/** Registra listener sul tasto Back di Android */
export async function onAndroidBack(handler) {
  if (!isAndroid) return () => {};
  try {
    const { App } = await import('@capacitor/app');
    const listener = await App.addListener('backButton', handler);
    return () => listener.remove();
  } catch {
    return () => {};
  }
}
