import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { styles } from "./styles/index.js";
import Sidebar from "./components/layout/Sidebar";
import Topbar from "./components/layout/Topbar";
import MobileBottomNav from "./components/layout/MobileBottomNav";
import Badge from "./components/ui/Badge";
import AppCard from "./components/ui/AppCard";

import { useTeamData } from "./hooks/useTeamData";
import { useAuth } from "./hooks/useAuth";
import { supabase } from "./lib/supabaseClient";

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

function App() {
  const auth = useAuth();
  const [profile, setProfile] = useState(null);

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
  const appSettings = state.appSettings || {};

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

  return (
    <BrowserRouter>
      <div className="app-shell" style={styles.appShell}>
        <div className="desktop-sidebar">
          <Sidebar />
        </div>

        <main className="app-content" style={styles.content}>
          <Topbar
            players={players}
            exercises={exercises}
            sessions={sessions}
            matches={matches}
            profile={profile}
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
                  <Dashboard
                    players={players}
                    exercises={exercises}
                    sessions={sessions}
                    matches={matches}
                    physicalTests={physicalTests}
                    appSettings={appSettings}
                    setAppSettings={setAppSettings}
                  />
                }
              />

              <Route path="/sessions" element={<Sessions />} />

              <Route
                path="/settings"
                element={<Settings {...auth} storageSource={storageSource} />}
              />

              <Route
                path="/coach-settings"
                element={
                  <CoachSettings
                    appSettings={appSettings}
                    setAppSettings={setAppSettings}
                  />
                }
              />

              <Route
                path="/physical-workouts"
                element={
                  <PhysicalWorkouts
                    players={players}
                    physicalTests={physicalTests}
                    appSettings={appSettings}
                  />
                }
              />

              <Route path="/opponents" element={<Opponents matches={matches} />} />

              <Route
                path="/post-match"
                element={<PostMatch matches={matches} setMatches={setMatches} />}
              />

              <Route
                path="/session-generator"
                element={
                  <SessionGenerator
                    exercises={exercises}
                    sessions={sessions}
                    setSessions={setSessions}
                    players={players}
                    matches={matches}
                  />
                }
              />

              <Route
                path="/exports"
                element={
                  <ExportCenter
                    players={players}
                    exercises={exercises}
                    sessions={sessions}
                    matches={matches}
                    physicalTests={physicalTests}
                    appSettings={appSettings}
                  />
                }
              />

              <Route
                path="/week-plan"
                element={
                  <WeekPlan
                    sessions={sessions}
                    matches={matches}
                    players={players}
                  />
                }
              />

              <Route
                path="/availability"
                element={<Availability players={players} setPlayers={setPlayers} />}
              />

              <Route
                path="/physical-tests"
                element={
                  <PhysicalTests
                    players={players}
                    physicalTests={physicalTests}
                    setPhysicalTests={setPhysicalTests}
                    appSettings={appSettings}
                  />
                }
              />

              <Route
                path="/match-day"
                element={
                  <MatchDay
                    matches={matches}
                    setMatches={setMatches}
                    players={players}
                  />
                }
              />

              <Route
                path="/match-day/:id"
                element={
                  <MatchDay
                    matches={matches}
                    setMatches={setMatches}
                    players={players}
                  />
                }
              />

              <Route path="/tactical-board" element={<TacticalBoard players={players} />} />

              <Route
                path="/statistics"
                element={
                  <Statistics events={[...sessions, ...matches]} players={players} />
                }
              />

              <Route
                path="/players"
                element={
                  <Players
                    players={players}
                    setPlayers={setPlayers}
                    sessions={sessions}
                    matches={matches}
                  />
                }
              />

              <Route
                path="/calendar"
                element={
                  <Calendar
                    events={[...sessions, ...matches]}
                    players={players}
                    updateEventAttendance={updateEventAttendance}
                  />
                }
              />

              <Route
                path="/players/:id"
                element={
                  <PlayerDetail
                    players={players}
                    setPlayers={setPlayers}
                    sessions={sessions}
                    matches={matches}
                    physicalTests={physicalTests}
                  />
                }
              />

              <Route
                path="/exercises"
                element={<Exercises exercises={exercises} setExercises={setExercises} />}
              />

              <Route
                path="/trainings"
                element={
                  <Trainings
                    exercises={exercises}
                    sessions={sessions}
                    setSessions={setSessions}
                    players={players}
                  />
                }
              />

              <Route
                path="/matches"
                element={
                  <Matches
                    matches={matches}
                    setMatches={setMatches}
                    players={players}
                  />
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