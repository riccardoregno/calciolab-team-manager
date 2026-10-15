import { useState, useMemo, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { Activity, ChevronDown, ChevronUp, ClipboardList, LogOut, Menu, Search, Settings, Trophy, Users } from "lucide-react";
import { useTranslation } from "../../i18n";
import { isRoleAllowed } from "../../utils/helpers";
import { PRIMARY, CORE_SECONDARY, ADVANCED_SECONDARY, juniorNavigationItems } from "../../constants/navigation";
import { useIsMobile } from "../../hooks/useIsMobile";
import { useDialogFocus } from "../../hooks/useDialogFocus";
import { supabase } from "../../lib/supabaseClient";

const CATEGORIES = [
  { id: "squadra", label: "Squadra", icon: Users },
  { id: "campo",   label: "Campo", icon: ClipboardList },
  { id: "gara",    label: "Gara", icon: Trophy },
  { id: "analisi", label: "Analisi", icon: Activity },
  { id: "gestione",label: "Gestione", icon: Settings },
];

export default function MobileBottomNav({ currentRole = "headCoach", storageSource = null, chatUnread = 0, onboardingCompleted = false, appSettings = {} }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const isCompact = useIsMobile(1025);
  const drawerOpen = open && isCompact;
  const drawerRef = useRef(null);
  const drawerId = "mobile-navigation-sheet";
  useDialogFocus(drawerRef, closeDrawer, drawerOpen);
  const [search, setSearch] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const navigate = useNavigate();
  const effectiveRole = currentRole || "headCoach";
  const primaryItems = PRIMARY.filter((item) => isRoleAllowed(effectiveRole, item.roles));
  const coreItems = useMemo(
    () => CORE_SECONDARY.filter((item) => isRoleAllowed(effectiveRole, item.roles)),
    [effectiveRole],
  );
  const advancedItems = useMemo(
    () => [...ADVANCED_SECONDARY, ...juniorNavigationItems(appSettings)].filter((item) => isRoleAllowed(effectiveRole, item.roles) && !(item.to === "/onboarding" && onboardingCompleted)),
    [effectiveRole, onboardingCompleted, appSettings],
  );
  const showSyncDot = Boolean(storageSource && storageSource !== "supabase");
  const syncDotColor = storageSource === "partial" || storageSource === "pending-upload" ? "#fb923c" : "#f87171";
  const showAltroDot = showSyncDot || chatUnread > 0;
  const altroDotColor = chatUnread > 0 ? "#3b82f6" : syncDotColor;

  const q = search.trim().toLowerCase();
  const filteredItems = useMemo(() => {
    const visibleItems = showAdvanced ? [...coreItems, ...advancedItems] : coreItems;
    const allItems = [...coreItems, ...advancedItems];

    return q
      ? allItems.filter((item) => t(item.labelKey).toLowerCase().includes(q))
      : visibleItems;
  }, [advancedItems, coreItems, q, showAdvanced, t]);

  function goTo(path) {
    navigate(path);
    setOpen(false);
    setSearch("");
    setShowAdvanced(false);
  }

  function closeDrawer() {
    setOpen(false);
    setSearch("");
    setShowAdvanced(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate("/");
    closeDrawer();
  }

  function renderItem(item) {
    const Icon = item.icon;
    return (
      <button
        key={item.to}
        onClick={() => goTo(item.to)}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "12px 8px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          color: "#cbd5e1",
          cursor: "pointer",
          minHeight: 72,
          justifyContent: "center",
        }}
      >
        <span style={{ position: "relative", width: 22, height: 22, display: "grid", placeItems: "center" }}>
          <Icon size={21} strokeWidth={2} aria-hidden="true" />
          {item.badge === "chat" && chatUnread > 0 && (
            <span style={{
              position: "absolute", top: -4, right: -8,
              minWidth: 16, height: 16, borderRadius: 8,
              background: "#3b82f6", color: "white",
              fontSize: 9, fontWeight: 900,
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 3px", boxShadow: "0 0 0 2px #0f172a",
            }}>
              {chatUnread > 9 ? "9+" : chatUnread}
            </span>
          )}
          {showSyncDot && item.to === "/settings" && (
            <span style={{
              position: "absolute", top: -2, right: -5,
              width: 6, height: 6, borderRadius: "50%",
              background: syncDotColor, boxShadow: "0 0 0 2px #0f172a",
            }} />
          )}
        </span>
        <span style={{ fontSize: 11, fontWeight: 500, textAlign: "center", lineHeight: 1.2 }}>
          {t(item.labelKey)}
        </span>
      </button>
    );
  }

  return (
    <>
      {/* ── Drawer "Altro" ─────────────────────────────────────── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={closeDrawer}
            style={{
              position: "fixed", inset: 0,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(3px)",
              zIndex: 9997,
            }}
          />

          {/* Sheet */}
          <div ref={drawerRef} id={drawerId} role="dialog" aria-modal="true" aria-label={t("navigation.mobile.more")} tabIndex={-1} className="mobile-nav-sheet" style={{
            position: "fixed",
            left: 0, right: 0, bottom: 0,
            zIndex: 9998,
            background: "#0f172a",
            borderTop: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "12px 12px 0 0",
            padding: "16px 16px calc(76px + env(safe-area-inset-bottom, 0px)) 16px",
            boxShadow: "0 -8px 40px rgba(0,0,0,0.5)",
            maxHeight: "75vh",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}>
            {/* Handle */}
            <div style={{
              width: 36, height: 4, borderRadius: 99,
              background: "rgba(255,255,255,0.2)",
              margin: "0 auto 14px",
            }} />

            {/* Search */}
            <div style={{ position: "relative", marginBottom: 14 }}>
              <span style={{
                position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)",
                fontSize: 14, pointerEvents: "none", opacity: 0.4,
              }}><Search size={15} /></span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca sezione…"
                style={{
                  width: "100%", boxSizing: "border-box",
                  padding: "9px 12px 9px 32px",
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10,
                  color: "#e2e8f0", fontSize: 16,
                  outline: "none",
                }}
              />
            </div>

            {q ? (
              /* ── risultati ricerca ── */
              filteredItems.length === 0 ? (
                <p style={{ textAlign: "center", color: "#475569", fontSize: 13, margin: "24px 0" }}>
                  Nessun risultato
                </p>
              ) : (
                <div className="no-mobile-override" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                  {filteredItems.map(renderItem)}
                </div>
              )
            ) : (
              /* ── vista per categorie ── */
              <>
                {CATEGORIES.map((cat) => {
                  const CategoryIcon = cat.icon;
                  const items = filteredItems.filter((i) => i.cat === cat.id);
                  if (items.length === 0) return null;
                  return (
                    <div key={cat.id} style={{ marginBottom: 16 }}>
                      <p style={{
                        margin: "0 0 8px",
                        fontSize: 11, fontWeight: 700,
                        color: "#64748b", textTransform: "uppercase", letterSpacing: 0.6,
                      }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                          <CategoryIcon size={13} /> {cat.label}
                        </span>
                      </p>
                      <div className="no-mobile-override" style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }}>
                        {items.map(renderItem)}
                      </div>
                    </div>
                  );
                })}

                {advancedItems.length > 0 && (
                  <button
                    onClick={() => setShowAdvanced((value) => !value)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      margin: "2px 0 12px",
                      padding: "12px 14px",
                      borderRadius: 12,
                      background: "rgba(59,130,246,0.08)",
                      border: "1px solid rgba(96,165,250,0.18)",
                      color: "#bfdbfe",
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    <span>{showAdvanced ? "Nascondi strumenti avanzati" : "Mostra strumenti avanzati"}</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                      {!showAdvanced && advancedItems.length}
                      {showAdvanced ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </button>
                )}
              </>
            )}

            {/* Logout — solo per giocatori */}
            {effectiveRole === "player" && (
              <button
                onClick={handleLogout}
                style={{
                  marginTop: 6, width: "100%",
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "13px 16px", borderRadius: 12,
                  background: "rgba(248,113,113,0.08)",
                  border: "1px solid rgba(248,113,113,0.2)",
                  color: "#f87171", fontSize: 14, fontWeight: 700,
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <LogOut size={19} />
                Esci dall'account
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Bottom nav bar ─────────────────────────────────────── */}
      <nav className="mobile-bottom-nav no-mobile-override" aria-label="Navigazione principale" style={{ gridTemplateColumns: `repeat(${primaryItems.length + 1}, minmax(0, 1fr))` }}>
        {primaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                isActive ? "mobile-nav-item active" : "mobile-nav-item"
              }
            >
              <Icon size={19} strokeWidth={2.1} aria-hidden="true" />
              <small>{t(item.labelKey)}</small>
            </NavLink>
          );
        })}

        {/* Pulsante Altro */}
        <button
          type="button"
          aria-expanded={drawerOpen}
          aria-controls={drawerOpen ? drawerId : undefined}
          onClick={() => setOpen((v) => !v)}
          className={drawerOpen ? "mobile-nav-item active" : "mobile-nav-item"}
          style={{ background: drawerOpen ? "#2563eb" : "none", border: "none", cursor: "pointer", padding: 0 }}
        >
          <span style={{ position: "relative", lineHeight: 1 }}>
            <Menu size={19} strokeWidth={2.1} aria-hidden="true" />
            {showAltroDot && (
              <span style={{
                position: "absolute",
                top: -2,
                right: -7,
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: altroDotColor,
                boxShadow: "0 0 0 2px #0f172a",
              }} />
            )}
          </span>
          <small>{t("navigation.mobile.more")}</small>
        </button>
      </nav>
    </>
  );
}
