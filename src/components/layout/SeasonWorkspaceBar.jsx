import { useEffect, useRef, useState } from "react";
import { useTranslation } from "../../i18n";
import { supabase } from "../../lib/supabaseClient";
import { normalizeSeason } from "../../utils/matchScope";
import { auditSeasonData, canonicalSeasonDate } from "../../utils/seasons";
import Modal from "../ui/Modal";
import Button from "../ui/Button";

const dayAfter = value => { const date=new Date(value+"T12:00:00Z");date.setUTCDate(date.getUTCDate()+1);return date.toISOString().slice(0,10); };
const initialDraft = (teamId,source,players) => {
  try { const draft=JSON.parse(localStorage.getItem("calciolab:season-draft:"+teamId));if(draft?.requestId) return draft; } catch { /* Optional draft. */ }
  const year=new Date().getFullYear();
  const start=source?dayAfter(source.end_date):year+"-07-01";
  const endYear=Number(start.slice(0,4))+1;
  return {requestId:crypto.randomUUID(),sourceId:source?.id||null,name:source?(/^\d{4}\/\d{2}$/.test(source.name) ? (Number(source.name.slice(0,4))+1)+"/"+String(Number(source.name.slice(0,4))+2).slice(-2) : (source.name+" · nuova").slice(0,60)):year+"/"+String(year+1).slice(-2),start,end:endYear+"-06-30",playerIds:players.map(player=>String(player.id)),submitted:false};
};

export default function SeasonWorkspaceBar({ model, role, allPlayers, allSessions, allMatches, memberships, onCreated }) {
  const {t}=useTranslation();
  const text=(key,params)=>t("seasons."+key,params);
  const [open,setOpen]=useState(false);
  if(!model.enabled || !model.teamId) return null;
  const mayCreate=["owner","headCoach"].includes(role);
  const errorKey=model.mutationError || (model.catalogError ? "SEASON_SCHEMA" : "");
  return <>
    <section className="season-workspace-bar" aria-label={text("current")}>
      <label><span>{text("current")}</span><select value={model.season?.id||"legacy"} disabled={!model.seasons.length || !model.synchronized} onChange={event=>model.choose(event.target.value)}>
        {model.seasons.map(season=><option key={season.id} value={season.id}>{season.name}</option>)}
        {(!model.seasons.length || model.audit.length>0) && <option value="legacy">{text("unassigned")}</option>}
      </select></label>
      <div className="season-period">{model.season ? <><strong>{model.season.start_date} – {model.season.end_date}</strong>{model.readOnlyRoster && <span>{text("historicalRoster")}</span>}</> : <span>{text("legacyHint")}</span>}</div>
      {mayCreate && <Button variant="ghost" onClick={()=>setOpen(true)} disabled={!model.synchronized || model.catalogLoading || Boolean(model.catalogError)}>{text(model.seasons.length ? "new" : "register")}</Button>}
    </section>
    {model.audit.length>0 && <details className="season-audit"><summary>{text("auditCount",{count:model.audit.length})}</summary><p>{text("auditHint")}</p><ul>{model.audit.map(item=><li key={item.id}>{item.title} · {item.date||text("noDate")} · {text("reasons."+item.reason)}</li>)}</ul></details>}
    {errorKey && <div role="alert" className="season-error">{text("errors."+errorKey)}<Button variant="ghost" onClick={model.catalogError ? model.refresh : model.clearError}>{text(model.catalogError ? "retry" : "dismiss")}</Button></div>}
    {open && <SeasonCreation key={model.teamId} {...{model,allPlayers,allSessions,allMatches,memberships,onCreated}} onClose={()=>setOpen(false)} />}
  </>;
}

function SeasonCreation({model,allPlayers,allSessions,allMatches,memberships,onCreated,onClose}) {
  const {t}=useTranslation();
  const text=(key,params)=>t("seasons."+key,params);
  const latest=model.seasons[0];
  const initialPlayers=latest ? memberships.filter(row=>row.seasonId===latest.id).map(row=>({...row.profile,id:row.playerId})) : allPlayers;
  const [draft,setDraft]=useState(()=>initialDraft(model.teamId,latest,initialPlayers));
  const source=model.seasons.find(item=>item.id===draft.sourceId);
  const sourcePlayers=source ? memberships.filter(row=>row.seasonId===source.id).map(row=>({...row.profile,id:row.playerId})) : allPlayers;
  const [review,setReview]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const lock=useRef(false);
  const draftKey="calciolab:season-draft:"+model.teamId;
  useEffect(()=>{try{localStorage.setItem(draftKey,JSON.stringify(draft));}catch{/* Same nonce remains in memory. */}},[draft,draftKey]);
  const selected=sourcePlayers.filter(player=>draft.playerIds.includes(String(player.id)));
  const proposed={id:"proposed",name:normalizeSeason(draft.name),start_date:draft.start,end_date:draft.end};
  const initialAudit=!source ? auditSeasonData({players:allPlayers,sessions:allSessions,matches:allMatches,seasons:[proposed]}) : [];
  const blockingAudit=initialAudit.filter(item=>item.reason!=="outside" && (!canonicalSeasonDate(item.date) || (item.date>=draft.start && item.date<=draft.end)));
  const valid=Boolean(draft.name.trim() && canonicalSeasonDate(draft.start) && canonicalSeasonDate(draft.end) && draft.start<=draft.end && (!source || draft.start>source.end_date));
  const update=patch=>{setDraft(previous=>({...previous,...patch}));setError("");};
  async function save() {
    if(lock.current || !valid || !model.synchronized || blockingAudit.length) return;
    lock.current=true;setBusy(true);setError("");setDraft(previous=>({...previous,submitted:true}));
    try {
      const payload={p_team_id:model.teamId,p_request_id:draft.requestId,p_name:normalizeSeason(draft.name),p_start_date:draft.start,p_end_date:draft.end,p_source_season_id:draft.sourceId,p_player_ids:draft.playerIds};
      // Persist the nonce and exact request before sending it, including a lost response.
      try {localStorage.setItem(draftKey,JSON.stringify({...draft,submitted:true}));}catch{/* Memory retry still uses the same nonce. */}
      const {data,error:requestError}=await supabase.rpc("create_team_season",payload);
      if(requestError) throw requestError;
      await onCreated(data);
      try{localStorage.removeItem(draftKey);}catch{/* No credentials in the draft. */}
      onClose();
    } catch(failure) {
      const known=["SEASON_FORBIDDEN","SEASON_OVERLAP","SEASON_REQUEST_CONFLICT","SEASON_INVALID","SEASON_SOURCE_REQUIRED","SEASON_SOURCE_INVALID","SEASON_PLAYER_INVALID","SEASON_BOOTSTRAP_ROSTER"];
      setError(known.find(code=>failure.message?.includes(code))||"SEASON_RETRY");
    } finally {lock.current=false;setBusy(false);}
  }
  return <Modal title={text(source?"new":"register")} onClose={busy?()=>{}:onClose}>
    <div className="season-create-form">
      {!review && !draft.submitted ? <>
        <p>{text(source?"newHint":"registerHint")}</p>
        <label>{text("name")}<input value={draft.name} maxLength={60} onChange={event=>update({name:event.target.value})} /></label>
        <div className="season-dates"><label>{text("start")}<input type="date" value={draft.start} onChange={event=>update({start:event.target.value})} /></label><label>{text("end")}<input type="date" value={draft.end} min={draft.start} onChange={event=>update({end:event.target.value})} /></label></div>
        {source ? <><p>{text("choosePlayers",{season:source.name})}</p><p>{text("resetHint")}</p><div className="season-player-choices">{sourcePlayers.map(player=><label key={player.id}><input type="checkbox" checked={draft.playerIds.includes(String(player.id))} onChange={event=>update({playerIds:event.target.checked?[...draft.playerIds,String(player.id)]:draft.playerIds.filter(id=>id!==String(player.id))})} /><span>{player.name}</span></label>)}</div></> : <p>{text("initialRoster",{count:sourcePlayers.length})}</p>}
        {!valid && <p role="status">{text("invalidDates")}</p>}
        {blockingAudit.length>0 && <div role="alert"><strong>{text("auditCount",{count:blockingAudit.length})}</strong><ul>{blockingAudit.map(item=><li key={item.id}>{item.title} · {text("reasons."+item.reason)}</li>)}</ul><p>{text("blockingHint")}</p></div>}
        <Button onClick={()=>setReview(true)} disabled={!valid||blockingAudit.length>0}>{text("review")}</Button>
      </> : <>
        <h3>{text("summary")}</h3><p><strong>{draft.name}</strong> · {draft.start} – {draft.end}</p><p>{text("selectedCount",{count:selected.length,total:sourcePlayers.length})}</p>
        <ul>{selected.map(player=><li key={player.id}>{player.name}</li>)}</ul>
        {source && <p>{text("excludedCount",{count:sourcePlayers.length-selected.length})}</p>}
        <p>{text("historyHint")}</p>
        {draft.submitted && <p>{text("sameRequestHint")}</p>}
        <div className="season-create-actions"><Button variant="ghost" disabled={busy} onClick={()=>{setDraft(previous=>({...previous,requestId:crypto.randomUUID(),submitted:false}));setReview(false);setError("");}}>{text("edit")}</Button><Button disabled={busy||!model.synchronized} onClick={save}>{text(busy?"saving":draft.submitted?"retrySave":"create")}</Button></div>
      </>}
      {error && <p role="alert" className="season-error">{text("errors."+error)}</p>}
    </div>
  </Modal>;
}
