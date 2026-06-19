import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";

import { styles } from "./styles/index.js";
import { useTranslation } from "./i18n";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import MobileBottomNav from "./components/layout/MobileBottomNav";
import FeatureGate from "./components/premium/FeatureGate";
import RoleGate from "./components/auth/RoleGate";
import Badge from "./components/ui/Badge";
import AppCard from "./components/ui/AppCard";
import Button from "./components/ui/Button";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import PWAInstallBanner from "./components/ui/PWAInstallBanner";
import PushBanner from "./components/ui/PushBanner";
import BillingBanner from "./components/ui/BillingBanner";
import DeepLinkHandler from "./components/utils/DeepLinkHandler";

import { useTeamData } from "./hooks/useTeamData";
import { useAuth } from "./hooks/useAuth";
import { useEventReminders } from "./hooks/useNotifications";
import { useStaffChat } from "./hooks/useStaffChat";
import { supabase } from "./lib/supabaseClient";
import { isNative, hideSplashScreen, setStatusBarDark, onAndroidBack } from "./utils/capacitor";
import { updateTeamSubscription } from "./services/subscription";
import { usePushNotifications } from "./hooks/usePushNotifications";

// Wrapper che vive DENTRO <BrowserRouter> così useNavigate funziona correttamente
function PushNotificationHandler({ userId, teamId, enabled }) {
  usePushNotifications({ userId, teamId, enabled });
  return null;
}

import Auth from "./pages/Auth";
const Landing = lazy(() => import("./pages/Landing"));

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Players = lazy(() => import("./pages/Players"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const MatchStats = lazy(() => import("./pages/MatchStats"));
const SessionAttendance = lazy(() => import("./pages/SessionAttendance"));
const AttendanceRegister = lazy(() => import("./pages/AttendanceRegister"));
const MatchConvocation  = lazy(() => import("./pages/MatchConvocation"));
const Exercises = lazy(() => import("./pages/Exercises"));
const Trainings = lazy(() => import("./pages/Trainings"));
const Sessions = lazy(() => import("./pages/Sessions"));
const Matches = lazy(() => import("./pages/Matches"));
const MatchDay = lazy(() => import("./pages/MatchDay"));
const MatchLive = lazy(() => import("./pages/MatchLive"));
const Microcycle = lazy(() => import("./pages/Microcycle"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Statistics = lazy(() => import("./pages/Statistics"));
const TacticalBoard = lazy(() => import("./pages/TacticalBoard"));
const Settings = lazy(() => import("./pages/Settings"));
const Availability = lazy(() => import("./pages/Availability"));
const PhysicalTests = lazy(() => import("./pages/PhysicalTests"));
const PhysicalWorkouts = lazy(() => import("./pages/PhysicalWorkouts"));
const GpsLoad = lazy(() => import("./pages/GpsLoad"));
const Opponents = lazy(() => import("./pages/Opponents"));
const PostMatch = lazy(() => import("./pages/PostMatch"));
const ExportCenter = lazy(() => import("./pages/ExportCenter"));
const StaffTasks = lazy(() => import("./pages/StaffTasks"));
const Premium = lazy(() => import("./pages/Premium"));
const PlayerPortal = lazy(() => import("./pages/PlayerPortal"));
const Sponsors = lazy(() => import("./pages/Sponsors"));
// const ExerciseLibrary = lazy(() => import("./pages/ExerciseLibrary")); // temporaneamente disabilitato
const AiSessionBuilder = lazy(() => import("./pages/AiSessionBuilder"));
const Onboarding  = lazy(() => import("./pages/Onboarding"));
const StaffChat        = lazy(() => import("./pages/StaffChat"));
const PlayerComparison = lazy(() => import("./pages/PlayerComparison"));
const SeasonGoals      = lazy(() => import("./pages/SeasonGoals"));

function LegacyPlayerRedirect() {
  const { id } = useParams();
  return <Navigate to={`/players/${id}`} replace />;
}
const JoinTeam = lazy(() => import("./pages/JoinTeam"));
const Rsvp = lazy(() => import("./pages/Rsvp"));
const SetPlays = lazy(() => import("./pages/SetPlays"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Terms = lazy(() => import("./pages/Terms"));
const Privacy = lazy(() => import("./pages/Privacy"));
const NotFound = lazy(() => import("./pages/NotFound"));

const developmentPreviewStorageKey = "calciolab_plan_preview";
const developmentPreviewPlans = ["free", "premium", "club"];
const developmentRolePreviewStorageKey = "calciolab_role_preview";
const developmentRolePreviewRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"];
const allRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"];
const coachRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"];
const technicalRoles = ["owner", "headCoach", "assistantCoach"];
const physicalRoles = ["owner", "headCoach", "athleticTrainer"];
const managementRoles = ["owner", "headCoach", "director"];
const onboardingRoles = ["owner", "headCoach"];
const playerCalendarRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player"];

function getInitialDevelopmentPlanPreview() {
  if (!import.meta.env.DEV || typeof window === "undefined") return "";

  const storedPlan = window.localStorage.getItem(developmentPreviewStorageKey);
  if (developmentPreviewPlans.includes(storedPlan)) return storedPlan;

  return import.meta.env.VITE_UNLOCK_PREMIUM === "true" ? "club" : "free";
}

function getInitialDevelopmentRolePreview() {
  if (!import.meta.env.DEV || typeof window === "undefined") return "";

  const storedRole = window.localStorage.getItem(developmentRolePreviewStorageKey);
  if (developmentRolePreviewRoles.includes(storedRole)) return storedRole;

  return "headCoach";
}

function extractRemoteSubscription(team) {
  if (!team) return null;
  return {
    subscription_plan:  team.subscription_plan  ?? "free",
    billing_status:     team.billing_status     ?? "free",
    trial_plan:         team.trial_plan         ?? "",
    trial_started_at:   team.trial_started_at   ?? "",
    trial_ends_at:      team.trial_ends_at      ?? "",
    trial_used:         team.trial_used         ?? false,
    stripe_customer_id: team.stripe_customer_id ?? "",
    stripe_subscription_id: team.stripe_subscription_id ?? "",
  };
}

function formatSyncAge(iso, t) {
  if (!iso) return "";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 10) return t("common.syncJustNow");
  if (seconds < 60) return t("common.syncSecondsAgo", { count: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("common.syncMinutesAgo", { count: minutes });
  return t("common.syncAt", {
    time: new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
  });
}

function App() {
  const { t } = useTranslation();
  const auth = useAuth();
  const [profile, setProfile] = useState(null);
  const [developmentPlanPreview, setDevelopmentPlanPreview] = useState(getInitialDevelopmentPlanPreview);
  const [developmentRolePreview, setDevelopmentRolePreview] = useState(getInitialDevelopmentRolePreview);
  const [remoteSubscription, setRemoteSubscription] = useState(() => extractRemoteSubscription(auth.team));

  // ── Capacitor lifecycle (solo su iOS/Android) ──────────────────────────────
  useEffect(() => {
    if (!isNative) return;
    // Imposta status bar scura e nascondi splash quando l'app è montata
    setStatusBarDark();
    hideSplashScreen();

    // Back button Android: vai indietro nella history oppure minimizza l'app
    const cleanup = onAndroidBack(async ({ canGoBack }) => {
      if (canGoBack) {
        window.history.back();
      } else {
        // Minimizza l'app invece di chiuderla
        try {
          const { App: CapApp } = await import('@capacitor/app');
          CapApp.minimizeApp();
        } catch { /* no-op — minimizeApp not available on all platforms */ }
      }
    });

    return () => { cleanup.then?.((fn) => fn?.()); };
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!auth.team) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRemoteSubscription(extractRemoteSubscription(auth.team));
  }, [auth.team]);

  const {
    state,
    loading,
    refreshing,
    storageSource,
    storageError,
    lastSyncedAt,
    refreshTeamData,
    setPlayers,
    setExercises,
    setSessions,
    setMatches,
    setPhysicalTests,
    setGpsSessions,
    setStaffTasks,
    setAppSettings,
    setSetPlays,
  } = useTeamData({ teamId: auth.team?.id });

  const previewAppSettings = useMemo(() => {
    const current = state.appSettings || {};

    // Merge subscription da Supabase come fonte di verità.
    // Se remoteSubscription è null (Supabase non configurato o non ancora caricato)
    // l'override è vuoto e appSettings locale rimane il fallback.
    const subscriptionOverride = remoteSubscription ? {
      plan:           remoteSubscription.subscription_plan,
      billingStatus:  remoteSubscription.billing_status,
      trialPlan:      remoteSubscription.trial_plan,
      trialStartedAt: remoteSubscription.trial_started_at,
      trialEndsAt:    remoteSubscription.trial_ends_at,
      customerId:     remoteSubscription.stripe_customer_id,
      subscriptionId: remoteSubscription.stripe_subscription_id,
    } : {};

    // FIX: i codici promo sono ora gestiti interamente lato server
    // (Edge Function redeem-promo-code aggiorna direttamente
    // subscription_plan/billing_status su Supabase). Prima un "promoOverride"
    // letto da appSettings locale (JSON scrivibile dall'owner) vinceva sui
    // dati Stripe reali — un owner poteva crearsi un codice permanente nella
    // UI e ottenere un piano "club" gratuito per sempre. Ora Supabase è
    // l'unica fonte di verità per il piano, promo incluse.
    const merged = {
      ...current,
      subscription: { ...current.subscription, ...subscriptionOverride },
    };

    if (!import.meta.env.DEV || !developmentPreviewPlans.includes(developmentPlanPreview)) {
      return merged;
    }

    return {
      ...merged,
      developmentPreviewPlan: developmentPlanPreview,
      developmentPreviewRole: developmentRolePreview,
    };
  }, [state.appSettings, remoteSubscription, developmentPlanPreview, developmentRolePreview]);

  // FIX #9: active flag previene setState su componente smontato (memory leak)
  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!auth.user) {
        if (active) setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", auth.user.id)
        .single();

      if (!active) return;

      if (error) {
        if (import.meta.env.DEV) console.error("Errore caricamento profilo:", error);
        return;
      }

      setProfile(data);
    }

    loadProfile();
    return () => { active = false; };
  }, [auth.user]);

  // Wire automatic event reminders (fires on load + every hour when notifications are enabled)
  useEventReminders({
    sessions: state.sessions || [],
    matches:  state.matches  || [],
    players:  state.players  || [],
    enabled:  Boolean(previewAppSettings?.notifications?.enabled),
  });

  // Push notifications — il hook usa useNavigate, quindi viene montato DENTRO BrowserRouter
  // tramite il componente PushNotificationHandler (vedi in fondo al return).

  // Staff chat badge — delayed 4s after login to avoid blocking initial render.
  const [chatBadgeReady, setChatBadgeReady] = useState(false);
  useEffect(() => {
    if (!auth.user?.id) return;
    const t = window.setTimeout(() => setChatBadgeReady(true), 4000);
    return () => window.clearTimeout(t);
  }, [auth.user?.id]);
  const { unreadCount: chatUnread } = useStaffChat({
    teamId:     chatBadgeReady ? auth.team?.id : undefined,
    userId:     chatBadgeReady ? auth.user?.id : undefined,
    authorName: profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Coach",
    authorRole: auth.team?.role || previewAppSettings?.currentUserRole || "headCoach",
    instanceId: "badge",
  });

  // Prefetch chunk core dopo login: scarica in background i bundle JS più visitati
  // così il primo clic sulla sidebar è istantaneo invece di mostrare il fallback Suspense.
  // Deve stare PRIMA dei return condizionali per rispettare le Rules of Hooks.
  useEffect(() => {
    if (!auth.user?.id) return;
    const timer = window.setTimeout(() => {
      import("./pages/Dashboard").catch(() => {});
      import("./pages/Players").catch(() => {});
      import("./pages/Trainings").catch(() => {});
      import("./pages/Matches").catch(() => {});
      import("./pages/Calendar").catch(() => {});
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [auth.user?.id]);

  // Pagine pubbliche — accessibili senza autenticazione
  const _path = typeof window !== "undefined" ? window.location.pathname : "";
  const _authParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const authRequested = _authParams.has("invite_mode") || _authParams.has("mode") || _authParams.has("token");
  if (_path === "/terms")                  return <BrowserRouter><Suspense fallback={null}><Terms /></Suspense></BrowserRouter>;
  if (_path === "/privacy")                return <BrowserRouter><Suspense fallback={null}><Privacy /></Suspense></BrowserRouter>;
  if (_path.startsWith("/join"))           return <Suspense fallback={null}><JoinTeam /></Suspense>;
  if (_path.startsWith("/rsvp"))           return <Suspense fallback={null}><Rsvp /></Suspense>;
  if (_path.startsWith("/reset-password")) return <Suspense fallback={null}><ResetPassword /></Suspense>;

  if (auth.authLoading) {
    return (
      <div
        style={{
          color: "white",
          background: "#0f1115",
          minHeight: "100vh",
          padding: 40,
        }}
      >
        {t("common.loadingData")}
      </div>
    );
  }

  if (authRequested) {
    return <Auth />;
  }

  if (!auth.user) {
    // Landing pubblica su "/" — Auth su "/login" o con query mode=register
    if (_path === "/" || _path === "") {
      return (
        <BrowserRouter>
          <Suspense fallback={null}>
            <Landing />
          </Suspense>
        </BrowserRouter>
      );
    }
    return <Auth />;
  }

  if (!auth.team && auth.authError) {
    return (
      <div style={{ minHeight: "100vh", background: "#0f1115", color: "white", display: "grid", placeItems: "center", padding: 24 }}>
        <AppCard style={{ maxWidth: 520 }}>
          <h2 style={{ margin: "0 0 8px" }}>{t("pages.auth.inviteNotCompleted")}</h2>
          <p style={{ color: "#94a3b8", lineHeight: 1.6, margin: "0 0 16px" }}>
            {auth.authError}
          </p>
          <Button
            onClick={() => {
              sessionStorage.removeItem("calciolab_invite_token");
              localStorage.removeItem("calciolab_invite_token");
              window.location.href = "/";
            }}
          >
            {t("pages.auth.backToAccess")}
          </Button>
        </AppCard>
      </div>
    );
  }

  // Onboarding automatico per nuovi utenti.
  // FIX (audit Codex — "onboarding dual source"): l'OR tra le due fonti
  // permetteva a un flag locale stale (es. completato su un altro device,
  // localStorage non sincronizzato) di far saltare l'onboarding anche quando
  // il team remoto non lo segnava come completato, o viceversa. Ora, se
  // esiste un team remoto, quello è l'UNICA fonte di verità
  // (auth.team.onboarding_completed); il valore locale viene usato solo
  // quando non c'è ancora un team remoto (es. utente appena registrato,
  // prima che la riga team sia disponibile). Saltare l'onboarding non
  // concede privilegi aggiuntivi — è solo configurazione.
  const onboardingDone = auth.team
    ? auth.team.onboarding_completed === true
    : previewAppSettings?.onboarding?.completed === true;
  const canManageOnboarding = !auth.team || onboardingRoles.includes(auth.team.role);
  const onboardingDeferred = typeof window !== "undefined"
    && window.localStorage.getItem("calciolab_onboarding_deferred") === "1";
  if (!auth.teamLoading && !loading && canManageOnboarding && !onboardingDone && !onboardingDeferred) {
    return (
      <BrowserRouter>
        <Suspense fallback={null}>
          <Onboarding
            appSettings={previewAppSettings}
            setAppSettings={setAppSettings}
            team={auth.team}
          />
        </Suspense>
      </BrowserRouter>
    );
  }

  const players = state.players || [];
  const exercises = state.exercises || [];
  const sessions = state.sessions || [];
  const matches = state.matches || [];
  const physicalTests = state.physicalTests || [];
  const gpsSessions   = state.gpsSessions   || [];
  const staffTasks    = state.staffTasks    || [];

  function updateDevelopmentPlanPreview(plan) {
    if (!developmentPreviewPlans.includes(plan)) return;

    setDevelopmentPlanPreview(plan);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(developmentPreviewStorageKey, plan);
    }
  }

  function updateDevelopmentRolePreview(role) {
    if (!developmentRolePreviewRoles.includes(role)) return;

    setDevelopmentRolePreview(role);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(developmentRolePreviewStorageKey, role);
    }
  }

  // FIX #8 / pre-go-live: setSubscription aggiorna lo stato locale SOLO se l'update
  // sul DB è andato a buon fine. Se il trigger billing_immutable (o un altro errore)
  // rifiuta la scrittura, ritorniamo { error } senza modificare remoteSubscription —
  // così la UI non mostra mai un piano che non è realmente attivo sul DB.
  async function setSubscription(dbFields) {
    const { error } = await updateTeamSubscription(auth.team?.id, dbFields);
    if (error) {
      if (import.meta.env.DEV) {
        console.error("[App] setSubscription fallito:", error.message);
      }
      return { error };
    }
    setRemoteSubscription((prev) => ({ ...(prev || {}), ...dbFields }));
    return { error: null };
  }

  function updateEventAttendance(eventId, eventType, attendance) {
    if (eventType === "Partita") {
      setMatches((prevMatches) =>
        prevMatches.map((match) =>
          match.id === eventId ? { ...match, attendance } : match
        )
      );
    } else {
      setSessions((prevSessions) =>
        prevSessions.map((session) =>
          session.id === eventId ? { ...session, attendance } : session
        )
      );
    }
  }

  // FIX #5: supabaseRole viene da team_members.role su Supabase — fonte di verità.
  // authConfigured è true solo quando Supabase è configurato E ha restituito un team:
  //   - team caricato → usa supabaseRole come fonte di verità (sicuro)
  //   - team null (DB in pausa / errore RLS / rete) → fallback a appSettings
  //     per non bloccare tutta l'app su problemi temporanei di Supabase.
  //
  // currentMember: voce del membro corrente in settings.members, usata da RoleGate
  // per applicare override customAreas (permessi per-area configurati nell'invito).
  const currentMember = (() => {
    const userMemberId = auth.user?.id ? `member-${auth.user.id}` : "";
    const email = auth.user?.email?.toLowerCase?.() || "";
    const members = Array.isArray(previewAppSettings?.members) ? previewAppSettings.members : [];
    return members.find((m) => (
      (userMemberId && String(m.id || "") === userMemberId) ||
      (email && String(m.email || "").trim().toLowerCase() === email)
    )) || null;
  })();

  function gate(allowedRoles, children, featureKey = null) {
    if (auth.team?.role === "player" && !allowedRoles.includes("player")) {
      return <Navigate to="/player-portal" replace />;
    }
    return (
      <RoleGate
        allowedRoles={allowedRoles}
        appSettings={previewAppSettings}
        supabaseRole={auth.team?.role || null}
        authConfigured={!!auth.authConfigured && auth.team !== null}
        member={currentMember}
        featureKey={featureKey}
      >
        {children}
      </RoleGate>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-shell" style={styles.appShell}>
        {auth.team?.role !== "player" && (
          <div className="desktop-sidebar">
            <Sidebar appSettings={previewAppSettings} currentRole={auth.team?.role || null} chatUnread={chatUnread} />
          </div>
        )}

        <main className="app-content" style={styles.content}>
          <Topbar
            players={players}
            exercises={exercises}
            sessions={sessions}
            matches={matches}
            staffTasks={staffTasks}
            chatUnread={chatUnread}
            profile={profile}
            developmentPlanPreview={developmentPlanPreview}
            onDevelopmentPlanPreviewChange={updateDevelopmentPlanPreview}
            developmentRolePreview={developmentRolePreview}
            onDevelopmentRolePreviewChange={updateDevelopmentRolePreview}
            storageSource={storageSource}
            refreshing={refreshing}
            loading={loading}
            onSyncNow={auth.team?.id ? refreshTeamData : null}
          />

          {/* Banner globale trial / billing — visibile su tutte le pagine */}
          <BillingBanner appSettings={previewAppSettings} />

          {/* Banner mobile: avvisa quando i dati non sono sincronizzati con Supabase */}
          {!loading && storageSource && storageSource !== "supabase" && (
            <div className="mobile-only" style={styles.offlineBannerMobile}>
              <span>
                {storageSource === "partial"
                  ? t("common.syncPartial")
                  : storageSource === "pending-upload"
                  ? t("common.syncPendingUpload")
                  : t("common.offlineHint")}
              </span>
              {auth.team?.id && (
                <button
                  type="button"
                  onClick={refreshTeamData}
                  disabled={refreshing}
                  style={styles.offlineBannerAction}
                >
                  {refreshing ? t("common.syncingNow") : t("common.syncNow")}
                </button>
              )}
            </div>
          )}

          <div className="mobile-hide" style={styles.storageStatus}>
            <Badge tone={storageSource === "supabase" ? "green" : storageSource === "partial" || storageSource === "pending-upload" ? "orange" : "red"}>
              {loading || auth.authLoading
                ? t("common.loadingData")
                : storageSource === "supabase"
                ? `Sync ${auth.team?.name || "Supabase"}`
                : storageSource === "partial"
                ? t("common.syncPartial")
                : storageSource === "pending-upload"
                ? t("common.syncPendingUpload")
                : `⚡ ${t("common.localSave")}`}
            </Badge>

            {lastSyncedAt && storageSource === "supabase" && (
              <span className="mobile-hide" style={styles.storageStatusText}>
                {formatSyncAge(lastSyncedAt, t)}
              </span>
            )}

            {storageError && storageSource !== "supabase" && (
              <span style={{ ...styles.storageStatusText, maxWidth: 320 }}>
                {storageSource === "partial" ? storageError : t("common.offlineHint")}
              </span>
            )}
          </div>

          <ErrorBoundary>
          <Suspense fallback={<PageSpinner />}>
            <Routes>
              <Route path="/login" element={<Navigate to="/" replace />} />

              <Route
                path="/"
                element={
                  auth.team?.role === "player" ? (
                    <Navigate to="/player-portal" replace />
                  ) : (
                    gate(allRoles, <Dashboard
                      players={players}
                      exercises={exercises}
                      sessions={sessions}
                      matches={matches}
                      physicalTests={physicalTests}
                      appSettings={previewAppSettings}
                      setAppSettings={setAppSettings}
                      teamId={auth.team?.id || null}
                      loading={loading}
                    />)
                  )
                }
              />

              <Route path="/sessions" element={gate(technicalRoles, <Sessions />, "sessions")} />

              <Route
                path="/settings"
                element={gate(allRoles, <Settings
                  {...auth}
                  storageSource={storageSource}
                  appSettings={previewAppSettings}
                  setAppSettings={setAppSettings}
                  currentUserRole={auth.team?.role || null}
                  players={players}
                  exercises={exercises}
                  sessions={sessions}
                  matches={matches}
                />, "settings")}
              />

              {/* Legacy redirects → unified settings */}
              <Route path="/coach-settings" element={<Navigate to="/settings" replace />} />
              <Route path="/club-settings"  element={<Navigate to="/settings?tab=club" replace />} />

              <Route
                path="/physical-workouts"
                element={
                  gate(physicalRoles, <FeatureGate featureKey="physicalWorkouts" appSettings={previewAppSettings}>
                    <PhysicalWorkouts
                      players={players}
                      physicalTests={physicalTests}
                      appSettings={previewAppSettings}
                    />
                  </FeatureGate>, "physical")
                }
              />

              <Route
                path="/gps-load"
                element={gate(physicalRoles, <GpsLoad
                  gpsSessions={gpsSessions}
                  setGpsSessions={setGpsSessions}
                  players={players}
                />, "physical")}
              />

              <Route
                path="/opponents"
                element={
                  gate(technicalRoles, <FeatureGate featureKey="opponents" appSettings={previewAppSettings}>
                    <Opponents matches={matches} />
                  </FeatureGate>, "matches")
                }
              />

              <Route
                path="/post-match"
                element={
                  gate(technicalRoles, <FeatureGate featureKey="postMatch" appSettings={previewAppSettings}>
                    <PostMatch
                      matches={matches}
                      setMatches={setMatches}
                      players={players}
                      sessions={sessions}
                      setStaffTasks={setStaffTasks}
                      appSettings={previewAppSettings}
                    />
                  </FeatureGate>, "matches")
                }
              />

              <Route
                path="/post-match/:id"
                element={
                  gate(technicalRoles, <FeatureGate featureKey="postMatch" appSettings={previewAppSettings}>
                    <PostMatch
                      matches={matches}
                      setMatches={setMatches}
                      players={players}
                      sessions={sessions}
                      setStaffTasks={setStaffTasks}
                      appSettings={previewAppSettings}
                    />
                  </FeatureGate>, "matches")
                }
              />

              <Route path="/session-generator" element={<Navigate to="/trainings" replace />} />

              <Route
                path="/exports"
                element={
                  gate(managementRoles, <FeatureGate featureKey="exports" appSettings={previewAppSettings}>
                    <ExportCenter
                      players={players}
                      exercises={exercises}
                      sessions={sessions}
                      matches={matches}
                      physicalTests={physicalTests}
                      gpsSessions={gpsSessions}
                      appSettings={previewAppSettings}
                    />
                  </FeatureGate>, "exports")
                }
              />

              <Route
                path="/staff-tasks"
                element={
                  gate(["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"], <StaffTasks
                    staffTasks={staffTasks}
                    setStaffTasks={setStaffTasks}
                    players={players}
                    matches={matches}
                  />, "staffTasks")
                }
              />

              <Route
                path="/staff-chat"
                element={
                  gate(["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"], <StaffChat
                    teamId={auth.team?.id}
                    userId={auth.user?.id}
                    authorName={profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : "Coach"}
                    authorRole={auth.team?.role || previewAppSettings?.currentUserRole || "headCoach"}
                    appSettings={previewAppSettings}
                  />, "staffChat")
                }
              />

              <Route
                path="/player-compare"
                element={
                  gate(coachRoles, <FeatureGate featureKey="statistics" appSettings={previewAppSettings}>
                    <PlayerComparison
                      players={players}
                      sessions={sessions}
                      matches={matches}
                      physicalTests={physicalTests}
                    />
                  </FeatureGate>, "statistics")
                }
              />

              <Route
                path="/season-goals"
                element={
                  gate(coachRoles, <SeasonGoals
                    matches={matches}
                    players={players}
                  />, "statistics")
                }
              />

              <Route
                path="/premium"
                element={
                  gate(managementRoles, <Premium
                    appSettings={previewAppSettings}
                    setAppSettings={setAppSettings}
                    setSubscription={setSubscription}
                    players={players}
                    exercises={exercises}
                    sessions={sessions}
                    matches={matches}
                    physicalTests={physicalTests}
                  />, "billing")
                }
              />

              <Route
                path="/onboarding"
                element={
                  gate(onboardingRoles, <Onboarding
                    appSettings={previewAppSettings}
                    setAppSettings={setAppSettings}
                    team={auth.team}
                  />, "settings")
                }
              />


              {/* Eserciziario FP5 temporaneamente disabilitato — redirect a /exercises */}
              <Route path="/exercise-library" element={<Navigate to="/exercises" replace />} />

              <Route
                path="/ai-session-builder"
                element={
                  gate(technicalRoles, <FeatureGate featureKey="aiSessionBuilder" appSettings={previewAppSettings}>
                    <AiSessionBuilder
                      exercises={exercises}
                      sessions={sessions}
                      setSessions={setSessions}
                      players={players}
                    />
                  </FeatureGate>, "sessions")
                }
              />

              <Route
                path="/player-portal"
                element={
                  // Mentre il team sta caricando non mostriamo nulla per evitare il
                  // flash del branch coach (auth.team=null → role≠"player" → vista coach).
                  auth.teamLoading ? null :
                  gate(["owner", "headCoach", "director", "player"],
                    // I player invitati bypassano la FeatureGate: l'accesso al portale
                    // è garantito dall'invito, indipendentemente dal piano del team.
                    // Il gate del piano è rilevante solo per i coach che gestiscono il portale.
                    auth.team?.role === "player" ? (
                      <PlayerPortal
                        players={players}
                        sessions={sessions}
                        matches={matches}
                        physicalTests={physicalTests}
                        appSettings={previewAppSettings}
                        setAppSettings={setAppSettings}
                        teamId={auth.team?.id}
                        myPlayerId={auth.team?.playerId || null}
                        supabaseRole="player"
                        playersLoading={loading}
                      />
                    ) : (
                      <FeatureGate featureKey="playerPortal" appSettings={previewAppSettings}>
                        <PlayerPortal
                          players={players}
                          sessions={sessions}
                          matches={matches}
                          physicalTests={physicalTests}
                          appSettings={previewAppSettings}
                          setAppSettings={setAppSettings}
                          teamId={auth.team?.id}
                          myPlayerId={null}
                          supabaseRole={auth.team?.role || null}
                        />
                      </FeatureGate>
                    ),
                    "playerPortal"
                  )
                }
              />

              <Route
                path="/sponsors"
                element={
                  gate(["owner", "director", "sponsor"], <FeatureGate featureKey="sponsors" appSettings={previewAppSettings}>
                    <Sponsors
                      appSettings={previewAppSettings}
                      setAppSettings={setAppSettings}
                    />
                  </FeatureGate>, "sponsors")
                }
              />

              {/* /week-plan rimosso — vista Settimana integrata in /calendar */}

              <Route
                path="/availability"
                element={gate(["owner", "headCoach", "assistantCoach", "athleticTrainer", "player"], <Availability players={players} setPlayers={setPlayers} sessions={sessions} matches={matches} loading={loading} teamId={auth.team?.id} appSettings={previewAppSettings} />, "availability")}
              />

              <Route
                path="/physical-tests"
                element={
                  gate(physicalRoles, <FeatureGate featureKey="physicalTests" appSettings={previewAppSettings}>
                    <PhysicalTests
                      players={players}
                      physicalTests={physicalTests}
                      setPhysicalTests={setPhysicalTests}
                      appSettings={previewAppSettings}
                    />
                  </FeatureGate>, "physical")
                }
              />

              <Route
                path="/match-day"
                element={
                  gate(technicalRoles, <FeatureGate featureKey="matchDay" appSettings={previewAppSettings}>
                    <MatchDay
                      matches={matches}
                      setMatches={setMatches}
                      players={players}
                      appSettings={previewAppSettings}
                    />
                  </FeatureGate>, "matches")
                }
              />

              <Route
                path="/match-day/:id"
                element={
                  gate(technicalRoles, <FeatureGate featureKey="matchDay" appSettings={previewAppSettings}>
                    <MatchDay
                      matches={matches}
                      setMatches={setMatches}
                      players={players}
                      appSettings={previewAppSettings}
                    />
                  </FeatureGate>, "matches")
                }
              />

              <Route
                path="/match-live/:id"
                element={
                  gate(technicalRoles, <MatchLive
                    matches={matches}
                    setMatches={setMatches}
                    players={players}
                    appSettings={previewAppSettings}
                  />, "matches")
                }
              />

              <Route
                path="/match-stats/:id"
                element={
                  gate(coachRoles, <MatchStats
                    players={players}
                    matches={matches}
                    appSettings={previewAppSettings}
                  />, "matches")
                }
              />

              <Route
                path="/session-attendance/:id"
                element={
                  gate(technicalRoles, <SessionAttendance
                    players={players}
                    sessions={sessions}
                    setSessions={setSessions}
                  />, "sessions")
                }
              />

              <Route
                path="/attendance-register"
                element={
                  gate(technicalRoles, <AttendanceRegister
                    players={players}
                    sessions={sessions}
                    setSessions={setSessions}
                  />, "sessions")
                }
              />

              <Route
                path="/match-convocation/:id"
                element={
                  gate(technicalRoles, <MatchConvocation
                    teamId={auth.team?.id}
                    players={players}
                    matches={matches}
                    setMatches={setMatches}
                    appSettings={previewAppSettings}
                  />, "matches")
                }
              />

              <Route path="/tactical-board" element={gate(technicalRoles, <TacticalBoard players={players} exercises={exercises} setExercises={setExercises} />, "tacticalBoard")} />

              <Route
                path="/statistics"
                element={
                  gate(coachRoles, <Statistics events={[...sessions, ...matches]} players={players} appSettings={previewAppSettings} setAppSettings={setAppSettings} />, "statistics")
                }
              />

              <Route
                path="/players"
                element={
                  gate(coachRoles, <Players
                    players={players}
                    setPlayers={setPlayers}
                    sessions={sessions}
                    matches={matches}
                    loading={loading}
                    teamId={auth.team?.id}
                  />, "players")
                }
              />

              <Route
                path="/calendar"
                element={
                  gate(playerCalendarRoles, <Calendar
                    events={[...sessions, ...matches]}
                    players={players}
                    updateEventAttendance={updateEventAttendance}
                    setSessions={setSessions}
                    setMatches={setMatches}
                    sessions={sessions}
                    matches={matches}
                  />, "calendar")
                }
              />

              <Route
                path="/players/:id"
                element={
                  gate(coachRoles, <PlayerDetail
                    players={players}
                    setPlayers={setPlayers}
                    sessions={sessions}
                    matches={matches}
                    physicalTests={physicalTests}
                    setStaffTasks={setStaffTasks}
                    appSettings={previewAppSettings}
                    setAppSettings={setAppSettings}
                    team={auth.team}
                  />, "players")
                }
              />

              <Route
                path="/player/:id"
                element={
                  gate(coachRoles, <LegacyPlayerRedirect />, "players")
                }
              />

              <Route
                path="/exercises"
                element={gate(technicalRoles, <Exercises exercises={exercises} setExercises={setExercises} />, "exercises")}
              />

              <Route
                path="/trainings"
                element={
                  gate(technicalRoles, <Trainings
                    exercises={exercises}
                    sessions={sessions}
                    setSessions={setSessions}
                    players={players}
                    matches={matches}
                    appSettings={previewAppSettings}
                    loading={loading}
                    teamId={auth.team?.id}
                  />, "sessions")
                }
              />

              <Route
                path="/microcycle"
                element={
                  gate(technicalRoles, <Microcycle
                    sessions={sessions}
                    matches={matches}
                    players={players}
                    gpsSessions={gpsSessions}
                  />, "sessions")
                }
              />

              <Route
                path="/matches"
                element={
                  gate(coachRoles, <Matches
                    matches={matches}
                    setMatches={setMatches}
                    players={players}
                    appSettings={previewAppSettings}
                    loading={loading}
                    teamId={auth.team?.id}
                  />, "matches")
                }
              />

              <Route
                path="/set-plays"
                element={
                  gate(technicalRoles, <SetPlays
                    players={players}
                    setPlays={state.setPlays || {}}
                    setSetPlays={setSetPlays}
                    appSettings={previewAppSettings}
                  />, "setPlays")
                }
              />

              {/* Catch-all → 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Deep link handler — intercetta Universal Links / App Links su iOS/Android */}
      <DeepLinkHandler />

      {auth.team?.role !== "player" && (
        <MobileBottomNav currentRole={auth.team?.role || null} storageSource={storageSource} chatUnread={chatUnread} />
      )}
      <PWAInstallBanner />
      <PushBanner />
      {/* Push notifications — dentro BrowserRouter perché il hook usa useNavigate */}
      <PushNotificationHandler
        userId={auth.user?.id || null}
        teamId={auth.team?.id || null}
        enabled={Boolean(previewAppSettings?.notifications?.push !== false)}
      />
      <style>{`
        @keyframes pushSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </BrowserRouter>
  );
}

// Fallback Suspense minimo: un piccolo spinner che non occupa spazio visivo.
// Sostituisce l'<AppCard> con testo che sembrava un reload completo della pagina.
function PageSpinner() {
  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 120, opacity: 0.4 }}>
      <div className="page-spinner" />
    </div>
  );
}

export default App;
