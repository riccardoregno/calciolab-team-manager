#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# build-release.sh — CalcioLab Release Build Script
# Uso: bash scripts/build-release.sh [android|ios|both]
# ──────────────────────────────────────────────────────────────────────────────

set -e
TARGET="${1:-both}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo ""
echo "⚡ CalcioLab — Release Build"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. Controlli prerequisiti ────────────────────────────────────────────────
if ! command -v node &>/dev/null; then echo "❌ Node.js non trovato"; exit 1; fi
if ! command -v npx  &>/dev/null; then echo "❌ npx non trovato"; exit 1; fi

if [[ "$TARGET" == "android" || "$TARGET" == "both" ]]; then
  if [[ ! -f "$ROOT/android/keystore.properties" ]]; then
    echo ""
    echo "❌ android/keystore.properties non trovato."
    echo "   Copia android/keystore.properties.example → android/keystore.properties"
    echo "   e compila i valori del keystore."
    echo ""
    echo "   Per generare il keystore (una volta sola):"
    echo "   keytool -genkey -v \\"
    echo "     -keystore android/calciolab-release.jks \\"
    echo "     -alias calciolab \\"
    echo "     -keyalg RSA -keysize 2048 -validity 10000"
    echo ""
    exit 1
  fi
fi

# ── 2. Web build ──────────────────────────────────────────────────────────────
echo ""
echo "🔨 [1/3] Build web assets..."
cd "$ROOT"
npm run build:mobile
echo "   ✓ Web build completato (dist/)"

# ── 3. Capacitor sync ─────────────────────────────────────────────────────────
echo ""
echo "🔄 [2/3] Capacitor sync..."
if [[ "$TARGET" == "android" ]]; then npx cap sync android
elif [[ "$TARGET" == "ios" ]];     then npx cap sync ios
else                                     npx cap sync
fi
echo "   ✓ Sync completato"

# ── 4. Release build ──────────────────────────────────────────────────────────
echo ""
echo "📦 [3/3] Build release..."

if [[ "$TARGET" == "android" || "$TARGET" == "both" ]]; then
  echo "   → Android AAB (Play Store)..."
  cd "$ROOT/android"
  ./gradlew bundleRelease --quiet
  AAB_PATH="$ROOT/android/app/build/outputs/bundle/release/app-release.aab"
  echo "   ✓ AAB: $AAB_PATH"

  echo "   → Android APK (sideload/test)..."
  ./gradlew assembleRelease --quiet
  APK_PATH="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
  echo "   ✓ APK: $APK_PATH"
  cd "$ROOT"
fi

if [[ "$TARGET" == "ios" || "$TARGET" == "both" ]]; then
  if ! command -v xcodebuild &>/dev/null; then
    echo "   ⚠️  xcodebuild non trovato (macOS + Xcode richiesto per iOS)"
  else
    echo "   → iOS Archive (TestFlight / App Store)..."
    WORKSPACE="$ROOT/ios/App/App.xcworkspace"
    ARCHIVE="$ROOT/ios/App/CalcioLab.xcarchive"
    xcodebuild \
      -workspace "$WORKSPACE" \
      -scheme App \
      -configuration Release \
      -archivePath "$ARCHIVE" \
      archive \
      -quiet
    echo "   ✓ Archive: $ARCHIVE"
    echo "   → Apri Xcode Organizer per caricare su TestFlight:"
    echo "      open $ARCHIVE"
  fi
fi

# ── 5. Riepilogo ──────────────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Build completata!"
echo ""
if [[ "$TARGET" == "android" || "$TARGET" == "both" ]]; then
  echo "Android:"
  echo "  AAB → carica su Google Play Console → Production"
  echo "  APK → installa su dispositivo per test"
fi
if [[ "$TARGET" == "ios" || "$TARGET" == "both" ]]; then
  echo "iOS:"
  echo "  Apri l'archive in Xcode Organizer → Distribute App → TestFlight"
fi
echo ""
