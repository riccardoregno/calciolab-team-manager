import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { auditSeasonData, getSeasonPlayers, resolveEventSeason } from "../utils/seasons.js";
import { normalizePlayer } from "../utils/helpers.js";

const preferenceKey = team => "calciolab:season:" + team;

export function useSeasonWorkspace({ teamId, role, state, actions, synchronized }) {
  const [catalog,setCatalog] = useState({teamId:null,seasons:[],error:null});
  const [choice,setChoice] = useState({teamId:null,id:null});
  const [revision,setRevision] = useState(0);
  const [mutationError,setMutationError] = useState("");
  const refresh = useCallback(() => setRevision(value=>value+1),[]);
  useEffect(()=>{
    if (!teamId || !supabase) return;
    let active=true;
    supabase.from("team_seasons").select("id,name,start_date,end_date,source_season_id,request_id").eq("team_id",teamId).order("start_date",{ascending:false}).then(({data,error})=>{
      if(active) setCatalog(previous => {
        if (!error && previous.teamId===teamId && !previous.error && JSON.stringify(previous.seasons)===JSON.stringify(data||[])) return previous;
        return {teamId,seasons:error && previous.teamId===teamId ? previous.seasons : data||[],error};
      });
    });
    return ()=>{active=false;};
  },[teamId,revision]);
  useEffect(()=>{
    if(!teamId) return;
    const visibleRefresh=()=>{ if(document.visibilityState==="visible") refresh(); };
    window.addEventListener("focus",visibleRefresh);
    document.addEventListener("visibilitychange",visibleRefresh);
    const interval=window.setInterval(visibleRefresh,60000);
    return ()=>{ window.removeEventListener("focus",visibleRefresh); document.removeEventListener("visibilitychange",visibleRefresh);window.clearInterval(interval); };
  },[teamId,refresh]);
  const seasons = useMemo(()=>catalog.teamId===teamId ? catalog.seasons : [],[catalog,teamId]);
  let preferred = choice.teamId===teamId ? choice.id : null;
  if(!preferred && teamId) { try { preferred=localStorage.getItem(preferenceKey(teamId)); } catch { /* preference is optional */ } }
  const season = seasons.find(item=>item.id===preferred) || (preferred==="legacy" ? null : seasons[0]) || null;
  const enabled = role!=="player";
  const writeBlocked = enabled && Boolean(teamId) && (catalog.teamId!==teamId || Boolean(catalog.error));
  const registered = enabled && seasons.length>0;
  const legacyView = registered && !season;
  const audit = useMemo(()=>registered ? auditSeasonData({players:state.players,sessions:state.sessions,matches:state.matches,seasons}) : [],[registered,state.players,state.sessions,state.matches,seasons]);
  const projectEvents = useCallback(list => !registered ? list : list.filter(event=>{
    const resolved=resolveEventSeason(event,seasons);
    return legacyView ? !resolved.season : resolved.season?.id===season.id;
  }).map(event=>legacyView ? event : {...event,seasonId:season.id,season:season.name}), [registered,legacyView,seasons,season]);
  const players = useMemo(() => !registered || legacyView ? state.players : getSeasonPlayers(state.players,state.seasonPlayers||[],season.id).map(normalizePlayer),[registered,legacyView,state.players,state.seasonPlayers,season]);
  const sessions = useMemo(()=>projectEvents(state.sessions||[]),[projectEvents,state.sessions]);
  const matches = useMemo(()=>projectEvents(state.matches||[]),[projectEvents,state.matches]);
  const readOnlyRoster = writeBlocked || (registered && (legacyView || season.id!==seasons[0]?.id));
  const choose = id => {
    if (!synchronized) { setMutationError("SEASON_SYNC_REQUIRED"); return; }
    if(id!=="legacy" && !seasons.some(item=>item.id===id)) return;
    try { localStorage.setItem(preferenceKey(teamId),id); } catch { /* Current session can still change season. */ }
    setChoice({teamId,id});setMutationError("");
  };
  const eventSetter = (key,legacySetter) => update => {
    setMutationError("");
    if(writeBlocked) {setMutationError("SEASON_SCHEMA");return;}
    if(!registered) { legacySetter(update);return; }
    if(legacyView) {setMutationError("SEASON_UNASSIGNED_READ_ONLY");return;}
    actions.setSeasonEvents(key,season,seasons,update,setMutationError);
  };
  return {
    enabled,teamId,seasons,season,registered,legacyView,readOnlyRoster,writeBlocked,audit,
    completeCreation: async id => {
      const {data,error}=await supabase.from("team_seasons").select("id,name,start_date,end_date,source_season_id,request_id").eq("team_id",teamId).order("start_date",{ascending:false});
      if(error) throw error;
      setCatalog({teamId,seasons:data||[],error:null});
      try {localStorage.setItem(preferenceKey(teamId),id);} catch { /* Selection still works in memory. */ }
      setChoice({teamId,id});
      refresh();
    },
    catalogLoading:Boolean(teamId && catalog.teamId!==teamId),catalogError:catalog.teamId===teamId?catalog.error:null,
    synchronized,choose,refresh,mutationError,clearError:()=>setMutationError(""),
    players,sessions,matches,
    setPlayers:update=>{
      setMutationError("");
      if(writeBlocked) {setMutationError("SEASON_SCHEMA");return;}
      if(!registered) { actions.setPlayers(update);return; }
      if(readOnlyRoster) {setMutationError("SEASON_ROSTER_READ_ONLY");return;}
      actions.setSeasonRoster(season.id,update);
    },
    setSessions:eventSetter("sessions",actions.setSessions),setMatches:eventSetter("matches",actions.setMatches),
  };
}
