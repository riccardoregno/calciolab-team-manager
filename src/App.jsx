import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { styles } from "./styles/index.js";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import MobileBottomNav from "./components/layout/MobileBottomNav";
import FeatureGate from "./components/premium/FeatureGate";
import RoleGate from "./components/auth/RoleGate";
import Badge from "./components/ui/Badge";
import AppCard from "./components/ui/AppCard";

import { useTeamData } from "./hooks/useTeamData";
import { useAuth } from "./hooks/useAuth";
import { supabase } from "./lib/supabaseClient";
import { updateTeamSubscription } from "./services/subscription";

import Auth from "./pages/Auth";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Players = lazy(() => import("./pages/Players"));
const PlayerDetail = lazy(() => import("./pages/PlayerDetail"));
const Exercises = lazy(() => import("./pages/Exercises"));
const Trainings = lazy(() => import("./pages/Trainings"));
const Sessions = lazy(() => import("./pages/Sessions"));
const Matches = lazy(() => import("./pages/Matches"));
const MatchDay = lazy(() => import("./pages/MatchDay"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Statistics = lazy(() => import("./pages/Statistics"));
const TacticalBoard = lazy(() => import("./pages/TacticalBoard"));
const Settings = lazy(() => import("./pages/Settings"));
const WeekPlan = lazy(() => import("./pages/WeekPlan"));
const Availability = lazy(() => import("./pages/Availability"));
const PhysicalTests = lazy(() => import("./pages/PhysicalTests"));
const CoachSettings = lazy(() => import("./pages/CoachSettings"));
const PhysicalWorkouts = lazy(() => import("./pages/PhysicalWorkouts"));
const Opponents = lazy(() => import("./pages/Opponents"));
const PostMatch = lazy(() => import("./pages/PostMatch"));
const SessionGenerator = lazy(() => import("./pages/SessionGenerator"));
const ExportCenter = lazy(() => import("./pages/ExportCenter"));
const Premium = lazy(() => import("./pages/Premium"));
const PlayerPortal = lazy(() => import("./pages/PlayerPortal"));
const Sponsors = lazy(() => import("./pages/Sponsors"));
const ExerciseLibrary = lazy(() => import("./pages/ExerciseLibrary"));
const AiSessionBuilder = lazy(() => import("./pages/AiSessionBuilder"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const ClubSettings = lazy(() => import("./pages/ClubSettings"));

const developmentPreviewStorageKey = "calciolab_plan_preview";
const developmentPreviewPlans = ["free", "premium", "club"];
const developmentRolePreviewStorageKey = "calciolab_role_preview";
const developmentRolePreviewRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"];
const allRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director", "player", "sponsor"];
const coachRoles = ["owner", "headCoach", "assistantCoach", "athleticTrainer", "director"];
const technicalRoles = ["owner", "headCoach", "assistantCoach"];
const physicalRoles = ["owner", "headCoach", "athleticTrainer"];
const managementRoles = ["owner", "headCoach", "director"];
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

function App() {
  const auth = useAuth();
  const [profile, setProfile] = useState(null);
  const [developmentPlanPreview, setDevelopmentPlanPreview] = useState(getInitialDevelopmentPlanPreview);
  const [developmentRolePreview, setDevelopmentRolePreview] = useState(getInitialDevelopmentRolePreview);
  const [remoteSubscription, setRemoteSubscription] = useState(null);

  useEffect(() => {
    if (!auth.team) return;
    setRemoteSubscription({
      subscription_plan:  auth.team.subscription_plan  ?? "free",
      billing_status:     auth.team.billing_status     ?? "free",
      trial_plan:         auth.team.trial_plan         ?? "",
      trial_started_at:   auth.team.trial_started_at   ?? "",
      trial_ends_at:      auth.team.trial_ends_at      ?? "",
      trial_used:         auth.team.trial_used         ?? false,
    });
  }, [auth.team]);

  const {
    state,
    loading,
    storageSource,
    storageError,
    setPlayers,
    setExercises,
    setSessions,
    setMatches,
    setPhysicalTests,
    setAppSettings,
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
    } : {};

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

  useEffect(() => {
    async function loadProfile() {
      if (!auth.user) {
        setProfile(null);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", auth.user.id)
        .single();

      if (error) {
        console.error("Errore caricamento profilo:", error);
        return;
      }

      setProfile(data);
    }

    loadProfile();
  }, [auth.user]);

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
        Caricamento...
      </div>
    );
  }

  if (!auth.user) {
    return <Auth />;
  }

  const players = state.players || [];
  const exercises = state.exercises || [];
  const sessions = state.sessions || [];
  const matches = state.matches || [];
  const physicalTests = state.physicalTests || [];

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

  async function setSubscription(dbFields) {
    console.log("[App] setSubscription chiamato");
    console.log("[App] auth.team?.id:", auth.team?.id);
    console.log("[App] dbFields:", dbFields);
    const { error } = await updateTeamSubscription(auth.team?.id, dbFields);
    if (error) {
      console.error("[App] setSubscription fallito:", error.message);
    } else {
      console.log("[App] setSubscription completato senza errori");
    }
    setRemoteSubscription((prev) => ({ ...(prev || {}), ...dbFields }));
  }

  function updateEventAttendance(eventId, eventType, attendance) {
    if (eventType === "Partita") {
      setMatches(
        matches.map((match) =>
          match.id === eventId ? { ...match, attendance } : match
        )
      );
    } else {
      setSessions(
        sessions.map((session) =>
          session.id === eventId ? { ...session, attendance } : session
        )
      );
    }
  }

  function gate(allowedRoles, children) {
    return (
      <RoleGate allowedRoles={allowedRoles} appSettings={previewAppSettings}>
        {children}
      </RoleGate>
    );
  }

  return (
    <BrowserRouter>
      <div className="app-shell" style={styles.appShell}>
        <div className="desktop-sidebar">
          <Sidebar appSettings={previewAppSettings} />
        </div>

        <main className="app-content" style={styles.content}>
          <Topbar
            players={players}
            exercises={exercises}
            sessions={sessions}
            matches={matches}
            profile={profile}
            developmentPlanPreview={developmentPlanPreview}
            onDevelopmentPlanPreviewChange={updateDevelopmentPlanPreview}
            developmentRolePreview={developmentRolePreview}
            onDevelopmentRolePreviewChange={updateDevelopmentRolePreview}
          />

          <div style={styles.storageStatus}>
            <Badge tone={storageSource === "supabase" ? "green" : "orange"}>
              {loading || auth.authLoading
                ? "Caricamento dati"
                : storageSource === "supabase"
                ? `Sync ${auth.team?.name || "Supabase"}`
                : "Salvataggio locale"}
            </Badge>

            {storageError && (
              <span style={styles.storageStatusText}>
                Supabase non disponibile: fallback locale attivo
              </span>
            )}
          </div>

          <Suspense
            fallback={
              <AppCard>
                <p style={{ color: "#94a3b8", margin: 0 }}>
                  Caricamento vista...
                </p>
              </AppCard>
            }
          >
            <Routes>
              <Route
                path="/"
                element={
                  gate(allRoles, <Dashboard
                    players={players}
                    exercises={exercises}
                    sessions={sessions}
                    matches={matches}
                    physicalTests={physicalTests}
                    appSettings={previewAppSettings}
                    setAppSettings={setAppSettings}
                  />)
                }
              />

              <Route path="/sessions" element={gate(technicalRoles, <Sessions />)} />

              <Route
                path="/settings"
                element={gate(allRoles, <Settings {...auth} storageSource={storageSource} />)}
              />

              <Route
                path="/coach-settings"
                element={
                  gate(physicalRoles, <CoachSettings
                    appSettings={previewAppSettings}
                    setAppSettings={setAppSettings}
                  />)
                }
              />

              <Route
                path="/physical-workouts"
                element={
                  gate(physicalRoles, <FeatureGate featureKey="physicalWorkouts" appSettings={previewAppSettings}>
                    <PhysicalWorkouts
                      players={players}
                      physicalTests={physicalTests}
                      appSettings={previewAppSettings}
                    />
                  </FeatureGate>)
                }
              />

              <Route
                path="/opponents"
                element={
                  gate(technicalRoles, <FeatureGate featureKey="opponents" appSettings={previewAppSettings}>
                    <Opponents matches={matches} />
                  </FeatureGate>)
                }
              />

              <Route
                path="/post-match"
                element={
                  gate(technicalRoles, <FeatureGate featureKey="postMatch" appSettings={previewAppSettings}>
                    <PostMatch matches={matches} setMatches={setMatches} />
                  </FeatureGate>)
                }
              />

              <Route
                path="/session-generator"
                element={
                  gate(technicalRoles, <FeatureGate featureKey="sessionGenerator" appSettings={previewAppSettings}>
                    <SessionGenerator
                      exercises={exercises}
                      sessions={sessions}
                      setSessions={setSessions}
                      players={players}
                      matches={matches}
                    />
                  </FeatureGate>)
                }
              />

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
                      appSettings={previewAppSettings}
                    />
                  </FeatureGate>)
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
                  />)
                }
              />

              <Route
                path="/onboarding"
                element={
                  gate(managementRoles, <Onboarding
                    appSettings={previewAppSettings}
                    setAppSettings={setAppSettings}
                  />)
                }
              />

              <Route
                path="/club-settings"
                element={
                  gate(managementRoles, <ClubSettings
                    appSettings={previewAppSettings}
                    setAppSettings={setAppSettings}
                    players={players}
                    exercises={exercises}
                    sessions={sessions}
                    matches={matches}
                  />)
                }
              />

              <Route
                path="/exercise-library"
                element={
                  gate(technicalRoles, <ExerciseLibrary
                    exercises={exercises}
                    appSettings={previewAppSettings}
                  />)
                }
              />

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
                  </FeatureGate>)
                }
              />

              <Route
                path="/player-portal"
                element={
                  gate(["owner", "headCoach", "director", "player"], <FeatureGate featureKey="playerPortal" appSettings={previewAppSettings}>
                    <PlayerPortal
                      players={players}
                      sessions={sessions}
                      matches={matches}
                      physicalTests={physicalTests}
                      appSettings={previewAppSettings}
                      setAppSettings={setAppSettings}
                    />
                  </FeatureGate>)
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
                  </FeatureGate>)
                }
              />

              <Route
                path="/week-plan"
                element={
                  gate(coachRoles, <WeekPlan
                    sessions={sessions}
                    matches={matches}
                    players={players}
                  />)
                }
              />

              <Route
                path="/availability"
                element={gate(["owner", "headCoach", "assistantCoach", "athleticTrainer", "player"], <Availability players={players} setPlayers={setPlayers} />)}
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
                  </FeatureGate>)
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
                    />
                  </FeatureGate>)
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
                    />
                  </FeatureGate>)
                }
              />

              <Route path="/tactical-board" element={gate(technicalRoles, <TacticalBoard players={players} />)} />

              <Route
                path="/statistics"
                element={
                  gate(coachRoles, <Statistics events={[...sessions, ...matches]} players={players} />)
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
                  />)
                }
              />

              <Route
                path="/calendar"
                element={
                  gate(playerCalendarRoles, <Calendar
                    events={[...sessions, ...matches]}
                    players={players}
                    updateEventAttendance={updateEventAttendance}
                  />)
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
                  />)
                }
              />

              <Route
                path="/exercises"
                element={gate(technicalRoles, <Exercises exercises={exercises} setExercises={setExercises} />)}
              />

              <Route
                path="/trainings"
                element={
                  gate(technicalRoles, <Trainings
                    exercises={exercises}
                    sessions={sessions}
                    setSessions={setSessions}
                    players={players}
                  />)
                }
              />

              <Route
                path="/matches"
                element={
                  gate(coachRoles, <Matches
                    matches={matches}
                    setMatches={setMatches}
                    players={players}
                  />)
                }
              />
            </Routes>
          </Suspense>
        </main>
      </div>

      <MobileBottomNav />
    </BrowserRouter>
  );
}

export default App;
