import assert from "node:assert/strict";
import { createServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: "custom" });
try {
  const { I18nProvider } = await server.ssrLoadModule("/src/i18n/I18nProvider.jsx");
  const { default: SaveStatus } = await server.ssrLoadModule("/src/components/ui/SaveStatus.jsx");
  const render = props => renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(SaveStatus, props)));
  const saving = render({ source: "pending-upload", saving: true, sticky: true });
  assert.match(saving, /Sincronizzazione in corso/);
  assert.doesNotMatch(saving, /Salvato online/);
  const failed = render({ source: "partial", error: "network failure", onRetry() {}, sticky: true });
  assert.match(failed, /Sincronizzazione non riuscita/);
  assert.match(failed, /<button[^>]*>Sincronizza ora<\/button>/);
  assert.doesNotMatch(failed, /network failure/, "Raw backend error does not leak into the visible status");
  const saved = render({ source: "supabase", lastSyncedAt: "2026-11-11T12:00:00Z", onRetry() {} });
  assert.match(saved, /Salvato online/);
  assert.doesNotMatch(saved, /Sincronizza ora/);
  console.log("Daily UI rendering: saving, online confirmation and translated retry action passed.");
} finally { await server.close(); }
