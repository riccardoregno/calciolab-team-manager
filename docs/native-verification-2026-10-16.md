# Verifica nativa e prossimo collaudo — 16 ottobre 2026

## Evidenze disponibili

- Commit delle migliorie UI: `f695909`, già pubblicato su main.
- Test JavaScript, lint e build web/mobile superati durante il precedente intervento.
- Dashboard provata nel browser a 320, 390, 768, 1024 e 1440 px con dati sintetici.
- Android SDK e Java di Android Studio disponibili su Windows.
- `adb devices -l`: nessun dispositivo collegato.
- `emulator -list-avds`: nessun dispositivo virtuale configurato; immagini Android non presenti nell’SDK locale.
- `capacitor sync android`: riuscito, sei plugin riconosciuti e nessuna modifica ai file Android versionati.
- Primo tentativo offline: compilazione dei test fermata per JUnit 4.13.2 non presente nella cache, non per un errore applicativo.
- Nuovo tentativo con risoluzione delle dipendenze: BUILD SUCCESSFUL. `:app:assembleDebug`, `:app:testDebugUnitTest` e `:app:assembleDebugAndroidTest` completati.
- Test unitario locale: 1 test dimostrativo, 0 errori; nessuna copertura funzionale dell’app.
- Test strumentale corretto: compilato ma non eseguito, in assenza di dispositivo.
- APK locale: `android/app/build/outputs/apk/debug/app-debug.apk`, circa 8,4 MB. Generato dalla copia di lavoro locale, comprese le modifiche preesistenti.
- APK dei test: `android/app/build/outputs/apk/androidTest/debug/app-debug-androidTest.apk`.

## Copertura dei test Android

Il test unitario preesistente è il controllo dimostrativo `2 + 2 = 4`: il suo esito non dimostra il funzionamento dell’app. Il test strumentale è stato corretto: controllava ancora `com.getcapacitor.app`; ora verifica l’identità CalcioLab, il permesso Internet e l’attività di avvio. Per eseguirlo serve un dispositivo o un emulatore.

## Collaudo funzionale ancora da eseguire su dispositivo

| Area | Verifica | Stato |
|---|---|---|
| Avvio | Apertura a freddo, splash e ripresa dal background | Da verificare |
| Layout | Barre di sistema, ritagli dello schermo, rotazione, testo ingrandito | Da verificare |
| Navigazione | Tab, menu, indietro Android e ritorno al punto corretto | Da verificare |
| Accesso | Login, ripristino sessione e logout con account di prova | Da verificare |
| Dashboard | Seduta/gara prioritaria, avvisi e dettagli espandibili | Browser superato; nativo da verificare |
| Sedute | Apertura, modifica, salvataggio e conservazione dei metadati | Browser superato; nativo da verificare |
| Form | Tastiera aperta, campo attivo e pulsanti di salvataggio visibili | Da verificare |
| Flussi | Rosa, calendario, convocazione, partita, statistiche e multe | Da verificare sul dispositivo |
| Rete | Perdita connessione, ripresa e assenza di duplicati in sincronizzazione | Da verificare |
| PDF | Esportazione, apertura e condivisione di un documento | Da verificare |
| Integrazioni | Notifiche e apertura di link su ambiente configurato | Da verificare |

## Prossimo passo

Collegare un Android con debug USB autorizzato oppure configurare un AVD. Installare l’APK di debug e completare la matrice con dati di prova. Per iOS eseguire build e collaudo tramite un Mac con Xcode e un simulatore o iPhone. Compilare un APK non equivale a collaudare l’app sul dispositivo.

## Comandi ripetibili (PowerShell, dalla cartella android)

```powershell
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
.\gradlew.bat :app:assembleDebug :app:testDebugUnitTest :app:assembleDebugAndroidTest --console=plain
# Richiede un dispositivo o emulatore disponibile:
.\gradlew.bat :app:connectedDebugAndroidTest --console=plain
```
