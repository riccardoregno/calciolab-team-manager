import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import * as Sentry from '@sentry/react'
import './index.css'
import App from './App.jsx'
import { I18nProvider } from './i18n'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    // Only send errors — no performance tracing to stay on free plan
    tracesSampleRate: 0,
    // Ignore network errors and browser extension noise
    ignoreErrors: [
      "Failed to fetch",
      "Load failed",
      "NetworkError",
      "ChunkLoadError",
      /extension/i,
      /^chrome-extension/,
    ],
    beforeSend(event) {
      // Don't send events in dev
      if (import.meta.env.DEV) return null
      return event
    },
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
)
