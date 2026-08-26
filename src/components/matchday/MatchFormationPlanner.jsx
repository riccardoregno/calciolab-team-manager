import { useMemo, useState } from "react";

import AppCard from "../ui/AppCard";
import Button from "../ui/Button";

const FORMATIONS_DEF = {
  "4-3-3": [
    { role: "P", x: 50, y: 90 },
    { role: "D", x: 18, y: 72 }, { role: "D", x: 38, y: 76 }, { role: "D", x: 62, y: 76 }, { role: "D", x: 82, y: 72 },
    { role: "C", x: 30, y: 52 }, { role: "C", x: 50, y: 56 }, { role: "C", x: 70, y: 52 },
    { role: "A", x: 22, y: 26 }, { role: "A", x: 50, y: 20 }, { role: "A", x: 78, y: 26 },
  ],
  "4-2-3-1": [
    { role: "P", x: 50, y: 90 },
    { role: "D", x: 18, y: 72 }, { role: "D", x: 38, y: 76 }, { role: "D", x: 62, y: 76 }, { role: "D", x: 82, y: 72 },
    { role: "C", x: 38, y: 57 }, { role: "C", x: 62, y: 57 },
    { role: "A", x: 24, y: 38 }, { role: "C", x: 50, y: 36 }, { role: "A", x: 76, y: 38 },
    { role: "A", x: 50, y: 18 },
  ],
  "4-3-2-1": [
    { role: "P", x: 50, y: 90 },
    { role: "D", x: 18, y: 72 }, { role: "D", x: 38, y: 76 }, { role: "D", x: 62, y: 76 }, { role: "D", x: 82, y: 72 },
    { role: "C", x: 28, y: 55 }, { role: "C", x: 50, y: 58 }, { role: "C", x: 72, y: 55 },
    { role: "A", x: 38, y: 36 }, { role: "A", x: 62, y: 36 },
    { role: "A", x: 50, y: 18 },
  ],
  "3-5-2": [
    { role: "P", x: 50, y: 90 },
    { role: "D", x: 28, y: 74 }, { role: "D", x: 50, y: 78 }, { role: "D", x: 72, y: 74 },
    { role: "C", x: 14, y: 52 }, { role: "C", x: 34, y: 56 }, { role: "C", x: 50, y: 58 }, { role: "C", x: 66, y: 56 }, { role: "C", x: 86, y: 52 },
    { role: "A", x: 38, y: 22 }, { role: "A", x: 62, y: 22 },
  ],
  "3-4-3": [
    { role: "P", x: 50, y: 90 },
    { role: "D", x: 28, y: 74 }, { role: "D", x: 50, y: 78 }, { role: "D", x: 72, y: 74 },
    { role: "C", x: 18, y: 53 }, { role: "C", x: 40, y: 57 }, { role: "C", x: 60, y: 57 }, { role: "C", x: 82, y: 53 },
    { role: "A", x: 24, y: 25 }, { role: "A", x: 50, y: 18 }, { role: "A", x: 76, y: 25 },
  ],
  "4-4-2": [
    { role: "P", x: 50, y: 90 },
    { role: "D", x: 18, y: 72 }, { role: "D", x: 38, y: 76 }, { role: "D", x: 62, y: 76 }, { role: "D", x: 82, y: 72 },
    { role: "C", x: 18, y: 52 }, { role: "C", x: 40, y: 56 }, { role: "C", x: 60, y: 56 }, { role: "C", x: 82, y: 52 },
    { role: "A", x: 38, y: 22 }, { role: "A", x: 62, y: 22 },
  ],
  "4-3-1-2": [
    { role: "P", x: 50, y: 90 },
    { role: "D", x: 18, y: 72 }, { role: "D", x: 38, y: 76 }, { role: "D", x: 62, y: 76 }, { role: "D", x: 82, y: 72 },
    { role: "C", x: 28, y: 54 }, { role: "C", x: 50, y: 58 }, { role: "C", x: 72, y: 54 },
    { role: "C", x: 50, y: 38 },
    { role: "A", x: 38, y: 20 }, { role: "A", x: 62, y: 20 },
  ],
};

const HALF_META = {
  firstHalf: { label: "1° tempo", short: "1T" },
  secondHalf: { label: "2° tempo", short: "2T" },
};

const ROLE_ORDER = { P: 0, D: 1, C: 2, A: 3 };
const ROLE_COLORS = { P: "#f59e0b", D: "#2563eb", C: "#16a34a", A: "#dc2626" };

function getRoleTag(role = "") {
  const value = String(role || "").toLowerCase();
  if (value.includes("port")) return "P";
  if (value.includes("dif") || value.includes("terzin") || value.includes("liber")) return "D";
  if (value.includes("cen") || value.includes("med") || value.includes("mez") || value.includes("trequart")) return "C";
  if (value.includes("att") || value.includes("punta") || value.includes("ala")) return "A";
  return "";
}

function playerName(player = {}) {
  return [player.firstName, player.lastName].filter(Boolean).join(" ") || player.name || "-";
}

function shortName(player = {}) {
  const label = player.lastName || player.name || player.firstName || "-";
  return String(label);
}

function nameLabelMetrics(label = "", baseWidth = 56) {
  const length = String(label || "").length;
  return {
    width: Math.max(baseWidth, Math.min(78, length * 6.1 + 12)),
    fontSize: length > 11 ? 6.8 : length > 9 ? 7.1 : 7.5,
  };
}

function playerInitials(player = {}) {
  const name = playerName(player);
  const parts = name.split(" ").filter(Boolean);
  const initials = parts.length > 1
    ? `${parts[0][0] || ""}${parts.at(-1)?.[0] || ""}`
    : String(name).slice(0, 2);
  return initials.toUpperCase();
}

function getShirtNumber(player = {}, lineup = {}) {
  const matchNumber = lineup.shirtNumbers?.[String(player.id)];
  return String(matchNumber || player.shirtNumber || player.number || "").trim();
}

function getPhotoTransform(player = {}) {
  const sizeValue = player.photoSize ?? 100;
  const offsetXValue = player.photoOffsetX ?? 0;
  const offsetYValue = player.photoOffsetY ?? 0;
  const size = Math.min(180, Math.max(115, Number(sizeValue)));
  const offsetX = Math.min(50, Math.max(-50, Number(offsetXValue)));
  const offsetY = Math.min(50, Math.max(-50, Number(offsetYValue)));
  return `scale(${size / 100}) translate(${offsetX}%, ${offsetY}%)`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function emptyPlan(fallbackFormation = "4-2-3-1") {
  return { formation: fallbackFormation, slots: {}, notes: "" };
}

function normalizePlan(plan, fallbackFormation) {
  return {
    formation: plan?.formation || fallbackFormation || "4-2-3-1",
    slots: plan?.slots || {},
    notes: plan?.notes || "",
  };
}

function sortPlayers(players = []) {
  return [...players].sort((a, b) => {
    const roleDiff = (ROLE_ORDER[getRoleTag(a.role)] ?? 9) - (ROLE_ORDER[getRoleTag(b.role)] ?? 9);
    if (roleDiff) return roleDiff;
    return playerName(a).localeCompare(playerName(b), "it");
  });
}

function autoAssign(players, formation) {
  const slots = FORMATIONS_DEF[formation] || [];
  const pools = { P: [], D: [], C: [], A: [], other: [] };
  sortPlayers(players).forEach((player) => {
    const tag = getRoleTag(player.role);
    if (pools[tag]) pools[tag].push(player);
    else pools.other.push(player);
  });

  const next = {};
  slots.forEach((slot, index) => {
    const picked = pools[slot.role]?.shift() || pools.other.shift();
    if (picked) next[index] = String(picked.id);
  });

  const leftover = [...pools.P, ...pools.D, ...pools.C, ...pools.A, ...pools.other];
  slots.forEach((_, index) => {
    if (!next[index] && leftover.length) next[index] = String(leftover.shift().id);
  });
  return next;
}

export default function MatchFormationPlanner({
  match,
  lineup,
  players = [],
  onChange,
  clubName = "CalcioLab",
  isMobile = false,
}) {
  const [activeHalf, setActiveHalf] = useState("firstHalf");
  const [selectedSlot, setSelectedSlot] = useState(null);
  const fallbackFormation = match?.formation || "4-2-3-1";
  const plans = {
    firstHalf: normalizePlan(lineup.formationPlans?.firstHalf, fallbackFormation),
    secondHalf: normalizePlan(lineup.formationPlans?.secondHalf, fallbackFormation),
  };
  const activePlan = plans[activeHalf];
  const slots = FORMATIONS_DEF[activePlan.formation] || FORMATIONS_DEF["4-2-3-1"];
  const playerMap = useMemo(
    () => new Map(players.map((player) => [String(player.id), player])),
    [players]
  );
  const calledIds = lineup.calledUpIds?.length
    ? lineup.calledUpIds.map(String)
    : [...(lineup.starterIds || []), ...(lineup.benchIds || [])].map(String);
  const calledPlayers = sortPlayers(calledIds.map((id) => playerMap.get(id)).filter(Boolean));
  const assignedIds = new Set(Object.values(activePlan.slots || {}).map(String).filter(Boolean));
  const availablePlayers = calledPlayers.filter((player) => !assignedIds.has(String(player.id)));

  function updatePlan(half, patch) {
    const current = plans[half] || emptyPlan(fallbackFormation);
    onChange({
      formationPlans: {
        ...(lineup.formationPlans || {}),
        [half]: {
          ...current,
          ...patch,
          slots: patch.slots || current.slots || {},
        },
      },
    });
  }

  function changeFormation(value) {
    updatePlan(activeHalf, {
      formation: value,
      slots: autoAssign(Object.values(activePlan.slots || {}).map((id) => playerMap.get(String(id))).filter(Boolean), value),
    });
    setSelectedSlot(null);
  }

  function assignPlayer(playerId) {
    if (selectedSlot == null) return;
    const nextSlots = { ...activePlan.slots };
    Object.entries(nextSlots).forEach(([slotIndex, assignedId]) => {
      if (String(assignedId) === String(playerId)) delete nextSlots[slotIndex];
    });
    nextSlots[selectedSlot] = String(playerId);
    updatePlan(activeHalf, { slots: nextSlots });
    setSelectedSlot(null);
  }

  function clearSlot(index) {
    const nextSlots = { ...activePlan.slots };
    delete nextSlots[index];
    updatePlan(activeHalf, { slots: nextSlots });
    setSelectedSlot(null);
  }

  function fillFromStarters() {
    const starterPlayers = (lineup.starterIds || []).map((id) => playerMap.get(String(id))).filter(Boolean);
    updatePlan(activeHalf, { slots: autoAssign(starterPlayers, activePlan.formation) });
  }

  function copyFirstHalf() {
    updatePlan("secondHalf", { ...plans.firstHalf, slots: { ...plans.firstHalf.slots } });
    setActiveHalf("secondHalf");
    setSelectedSlot(null);
  }

  function clearHalf() {
    updatePlan(activeHalf, { slots: {} });
  }

  function updateShirtNumber(playerId, value) {
    const cleanValue = String(value || "").replace(/\D/g, "").slice(0, 2);
    const nextNumbers = { ...(lineup.shirtNumbers || {}) };
    if (cleanValue) nextNumbers[String(playerId)] = cleanValue;
    else delete nextNumbers[String(playerId)];
    onChange({ shirtNumbers: nextNumbers });
  }

  function printPlans() {
    const W = 320;
    const H = 464;
    const title = `${clubName} vs ${match?.opponent || "Avversario"}`;
    const meta = [match?.date, match?.time, match?.competition, match?.matchday].filter(Boolean).join(" · ");
    const filledHalfKeys = ["firstHalf", "secondHalf"].filter((halfKey) =>
      Object.values(plans[halfKey]?.slots || {}).some(Boolean)
    );
    const printHalfKeys = filledHalfKeys.length ? filledHalfKeys : ["firstHalf"];
    const isSingleField = printHalfKeys.length === 1;
    const pageSize = "A4 landscape";
    const sheetClass = isSingleField ? "sheet single" : "sheet";
    const renderField = (halfKey) => {
      const plan = plans[halfKey];
      const planSlots = FORMATIONS_DEF[plan.formation] || [];
      const assigned = new Set(Object.values(plan.slots || {}).map(String).filter(Boolean));
      const bench = calledPlayers.filter((player) => !assigned.has(String(player.id)));
      const nodes = planSlots.map((slot, index) => {
        const player = playerMap.get(String(plan.slots?.[index] || ""));
        const cx = (slot.x / 100) * W;
        const cy = (slot.y / 100) * H;
        const color = ROLE_COLORS[slot.role] || "#64748b";
        const shirtNumber = player ? getShirtNumber(player, lineup) : "";
        const marker = shirtNumber || slot.role;
        const photoSize = 34;
        const photoTransform = player ? getPhotoTransform(player) : "";
        const label = player ? shortName(player) : "";
        const labelMetrics = nameLabelMetrics(label, 50);
        const photoNode = player?.photo
          ? `<foreignObject x="${cx - (photoSize / 2)}" y="${cy - (photoSize / 2)}" width="${photoSize}" height="${photoSize}">
              <div xmlns="http://www.w3.org/1999/xhtml" style="width:${photoSize}px;height:${photoSize}px;border-radius:50%;overflow:hidden">
                <img src="${escapeHtml(player.photo)}" alt="${escapeHtml(playerName(player))}" style="width:100%;height:100%;object-fit:cover;transform:${escapeHtml(photoTransform)}"/>
              </div>
            </foreignObject>`
          : `<circle cx="${cx}" cy="${cy}" r="${photoSize / 2}" fill="${player ? color : "rgba(255,255,255,0.10)"}"/>`;
        return `<g>
          <circle cx="${cx}" cy="${cy}" r="${(photoSize / 2) + 2}" fill="${player ? color : "rgba(255,255,255,0.10)"}" stroke="rgba(255,255,255,0.55)" stroke-width="1.2"/>
          ${photoNode}
          <circle cx="${cx + 14}" cy="${cy - 14}" r="7.5" fill="#0f172a" stroke="rgba(255,255,255,0.75)" stroke-width="1"/>
          <text x="${cx + 14}" y="${cy - 11.5}" text-anchor="middle" font-size="7" font-weight="900" fill="white" font-family="sans-serif">${escapeHtml(marker)}</text>
          <rect x="${cx - (labelMetrics.width / 2)}" y="${cy + 20}" width="${labelMetrics.width}" height="13" rx="6.5" fill="#0f172a" stroke="rgba(255,255,255,0.18)" stroke-width="0.7"/>
          <text x="${cx}" y="${cy + 29}" text-anchor="middle" font-size="${labelMetrics.fontSize}" font-weight="800" fill="white" font-family="sans-serif">${escapeHtml(label)}</text>
        </g>`;
      }).join("");
      const benchHtml = bench.length
        ? bench.map((player) => {
            const shirtNumber = getShirtNumber(player, lineup);
            const marker = shirtNumber ? `#${shirtNumber}` : getRoleTag(player.role) || "-";
            return `<span><b>${escapeHtml(marker)}</b> ${escapeHtml(playerName(player))}</span>`;
          }).join("")
        : "<span>Nessuno</span>";

      return `<section class="team-card">
        <h2>${HALF_META[halfKey].label} · ${escapeHtml(plan.formation)}</h2>
        <svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
          <rect width="${W}" height="${H}" fill="#15803d" rx="8"/>
          <rect x="16" y="16" width="${W - 32}" height="${H - 32}" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1.4"/>
          <line x1="16" y1="${H / 2}" x2="${W - 16}" y2="${H / 2}" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
          <circle cx="${W / 2}" cy="${H / 2}" r="34" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
          <rect x="${W / 2 - 44}" y="16" width="88" height="52" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
          <rect x="${W / 2 - 44}" y="${H - 68}" width="88" height="52" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
          ${nodes}
        </svg>
        <div class="bench"><strong>A disposizione</strong>${benchHtml}</div>
        ${plan.notes ? `<p class="notes">${escapeHtml(plan.notes)}</p>` : ""}
      </section>`;
    };

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<html><head><title>Schieramenti gara</title><style>
      @page{size:${pageSize};margin:10mm}
      *{box-sizing:border-box}
      body{margin:0;padding:18px;font-family:sans-serif;background:#f8fafc;color:#0f172a}
      h1{margin:0 0 4px;font-size:20px}
      .meta{margin:0 0 14px;color:#64748b;font-size:12px}
      .sheet{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
      .sheet.single{display:block}
      .team-card{break-inside:avoid}
      .single .team-card{display:grid;grid-template-columns:minmax(0,160mm) minmax(0,1fr);grid-template-areas:"title title" "field bench" "field notes";gap:10px 16px;align-items:start}
      h2{margin:0 0 8px;font-size:16px}
      .single h2{grid-area:title;margin-bottom:2px}
      svg{display:block;width:100%;height:auto;max-height:520px;border-radius:8px}
      .single svg{grid-area:field;max-height:165mm}
      .bench{margin-top:8px;padding:8px 10px;border:1px solid #dbe3ef;border-radius:8px;background:white;display:flex;flex-wrap:wrap;gap:6px 10px;font-size:11px;line-height:1.25}
      .single .bench{grid-area:bench;margin-top:0;display:grid;grid-template-columns:1fr;gap:5px;font-size:12px;align-content:start}
      .bench strong{width:100%;font-size:11px;text-transform:uppercase;color:#475569}
      .bench span{white-space:nowrap}
      .single .bench span{white-space:normal}
      .bench b{font-size:10px;color:#2563eb}
      .notes{margin:8px 0 0;padding:8px 10px;border:1px solid #dbe3ef;border-radius:8px;background:white;font-size:12px}
      .single .notes{grid-area:notes;margin-top:0}
      @media print{body{padding:0}button{display:none}.sheet{gap:12px}h1{font-size:18px}h2{font-size:14px}.bench{font-size:10px}.single .team-card{grid-template-columns:minmax(0,158mm) minmax(0,1fr)}.single svg{max-height:166mm}}
    </style></head>
      <body><h1>${escapeHtml(title)}</h1><p class="meta">${escapeHtml(meta)}</p><div class="${sheetClass}">${printHalfKeys.map(renderField).join("")}</div>
      <br><button onclick="window.print()">Stampa</button></body></html>`);
    win.document.close();
  }

  return (
    <AppCard>
      <div style={plannerStyles.header}>
        <div>
          <h3 style={plannerStyles.title}>Schieramento gara</h3>
          <p style={plannerStyles.muted}>Prepara campo e formazione per primo e secondo tempo.</p>
        </div>
        <div style={plannerStyles.actions}>
          <Button variant="ghost" onClick={fillFromStarters}>Auto titolari</Button>
          <Button variant="ghost" onClick={copyFirstHalf}>Copia 1T nel 2T</Button>
          <Button onClick={printPlans}>Stampa campo</Button>
        </div>
      </div>

      <div style={plannerStyles.toolbar}>
        <div style={plannerStyles.halfTabs}>
          {Object.entries(HALF_META).map(([key, meta]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setActiveHalf(key);
                setSelectedSlot(null);
              }}
              style={{
                ...plannerStyles.tab,
                ...(activeHalf === key ? plannerStyles.tabActive : {}),
              }}
            >
              {meta.short}
            </button>
          ))}
        </div>
        <select value={activePlan.formation} onChange={(event) => changeFormation(event.target.value)} style={plannerStyles.select}>
          {Object.keys(FORMATIONS_DEF).map((formation) => (
            <option key={formation} value={formation}>{formation}</option>
          ))}
        </select>
        <Button variant="ghost" onClick={clearHalf}>Svuota tempo</Button>
      </div>

      <div style={{ ...plannerStyles.grid, gridTemplateColumns: isMobile ? "1fr" : "340px 1fr" }}>
        <FormationField
          slots={slots}
          plan={activePlan}
          lineup={lineup}
          playerMap={playerMap}
          selectedSlot={selectedSlot}
          onSlotClick={setSelectedSlot}
          onClearSlot={clearSlot}
        />

        <div style={plannerStyles.side}>
          <div style={plannerStyles.panelHeader}>
            <strong>{HALF_META[activeHalf].label}</strong>
            <span>{Object.keys(activePlan.slots || {}).length}/11</span>
          </div>
          <p style={plannerStyles.hint}>
            Seleziona uno slot sul campo, poi scegli un convocato. Clic su uno slot pieno per liberarlo.
          </p>
          <div style={plannerStyles.numberGrid}>
            {calledPlayers.map((player) => (
              <label key={player.id} style={plannerStyles.numberRow}>
                <span>{playerName(player)}</span>
                <input
                  value={getShirtNumber(player, lineup)}
                  onChange={(event) => updateShirtNumber(player.id, event.target.value)}
                  placeholder="#"
                  inputMode="numeric"
                  maxLength={2}
                  style={plannerStyles.numberInput}
                />
              </label>
            ))}
          </div>
          <div style={plannerStyles.playerGrid}>
            {availablePlayers.map((player) => {
              const role = getRoleTag(player.role);
              const shirtNumber = getShirtNumber(player, lineup);
              const marker = shirtNumber ? `#${shirtNumber}` : role || "-";
              return (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => assignPlayer(player.id)}
                  disabled={selectedSlot == null}
                  style={{
                    ...plannerStyles.playerButton,
                    opacity: selectedSlot == null ? 0.55 : 1,
                  }}
                >
                  <span style={{ ...plannerStyles.roleBadge, color: ROLE_COLORS[role] || "#94a3b8" }}>{marker}</span>
                  {playerName(player)}
                </button>
              );
            })}
            {!availablePlayers.length && (
              <p style={plannerStyles.empty}>Tutti i convocati sono gia' assegnati in questo tempo.</p>
            )}
          </div>
          <textarea
            value={activePlan.notes}
            onChange={(event) => updatePlan(activeHalf, { notes: event.target.value })}
            placeholder="Note per questo tempo: consegne, cambi previsti, palle inattive..."
            style={plannerStyles.notes}
          />
        </div>
      </div>
    </AppCard>
  );
}

function FormationField({ slots, plan, lineup, playerMap, selectedSlot, onSlotClick, onClearSlot }) {
  const W = 300;
  const H = 430;
  const line = "rgba(255,255,255,0.32)";
  const pitchX = 14;
  const pitchY = 14;
  const pitchW = W - 28;
  const pitchH = H - 28;
  const penaltyW = 130;
  const penaltyH = 64;
  const goalAreaW = 66;
  const goalAreaH = 24;
  const goalW = 48;

  return (
    <div style={plannerStyles.fieldWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} style={plannerStyles.field}>
        <rect width={W} height={H} fill="#15803d" rx="8" />
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <rect key={index} x={pitchX} y={pitchY + index * (pitchH / 6)} width={pitchW} height={pitchH / 6} fill={index % 2 === 0 ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.015)"} />
        ))}
        <rect x={pitchX} y={pitchY} width={pitchW} height={pitchH} fill="none" stroke={line} strokeWidth="1.5" />
        <line x1={pitchX} y1={H / 2} x2={W - pitchX} y2={H / 2} stroke={line} strokeWidth="1" />
        <circle cx={W / 2} cy={H / 2} r="36" fill="none" stroke={line} strokeWidth="1" />
        <circle cx={W / 2} cy={H / 2} r="3" fill="rgba(255,255,255,0.45)" />

        <rect x={W / 2 - penaltyW / 2} y={pitchY} width={penaltyW} height={penaltyH} fill="none" stroke={line} strokeWidth="1" />
        <rect x={W / 2 - goalAreaW / 2} y={pitchY} width={goalAreaW} height={goalAreaH} fill="none" stroke={line} strokeWidth="1" />
        <rect x={W / 2 - goalW / 2} y={pitchY - 6} width={goalW} height="6" rx="1.5" fill="none" stroke={line} strokeWidth="1" />
        <circle cx={W / 2} cy={pitchY + 46} r="2.2" fill="rgba(255,255,255,0.48)" />
        <path d={`M ${W / 2 - 22} ${pitchY + penaltyH} A 28 28 0 0 0 ${W / 2 + 22} ${pitchY + penaltyH}`} fill="none" stroke={line} strokeWidth="1" />

        <rect x={W / 2 - penaltyW / 2} y={H - pitchY - penaltyH} width={penaltyW} height={penaltyH} fill="none" stroke={line} strokeWidth="1" />
        <rect x={W / 2 - goalAreaW / 2} y={H - pitchY - goalAreaH} width={goalAreaW} height={goalAreaH} fill="none" stroke={line} strokeWidth="1" />
        <rect x={W / 2 - goalW / 2} y={H - pitchY} width={goalW} height="6" rx="1.5" fill="none" stroke={line} strokeWidth="1" />
        <circle cx={W / 2} cy={H - pitchY - 46} r="2.2" fill="rgba(255,255,255,0.48)" />
        <path d={`M ${W / 2 - 22} ${H - pitchY - penaltyH} A 28 28 0 0 1 ${W / 2 + 22} ${H - pitchY - penaltyH}`} fill="none" stroke={line} strokeWidth="1" />

        {slots.map((slot, index) => {
          const player = playerMap.get(String(plan.slots?.[index] || ""));
          const cx = (slot.x / 100) * W;
          const cy = (slot.y / 100) * H;
          const selected = selectedSlot === index;
          const color = ROLE_COLORS[slot.role] || "#64748b";
          const shirtNumber = player ? getShirtNumber(player, lineup) : "";
          const marker = player ? shirtNumber || slot.role : slot.role;
          const photoTransform = player ? getPhotoTransform(player) : "";
          const photoSize = 38;
          const label = player ? shortName(player) : "";
          const labelMetrics = nameLabelMetrics(label);
          return (
            <g
              key={index}
              onClick={() => player ? onClearSlot(index) : onSlotClick(index)}
              style={{ cursor: "pointer" }}
            >
              <title>{player ? `${playerName(player)} - clic per rimuovere` : "Clic per selezionare lo slot"}</title>
              {player ? (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={(photoSize / 2) + 2}
                    fill={selected ? "#facc15" : color}
                    stroke={selected ? "#fef08a" : "rgba(255,255,255,0.65)"}
                    strokeWidth={selected ? 2.5 : 1.5}
                  />
                  {player.photo ? (
                    <foreignObject x={cx - (photoSize / 2)} y={cy - (photoSize / 2)} width={photoSize} height={photoSize}>
                      <div
                        xmlns="http://www.w3.org/1999/xhtml"
                        style={{ width: photoSize, height: photoSize, borderRadius: "50%", overflow: "hidden" }}
                      >
                        <img
                          src={player.photo}
                          alt={playerName(player)}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            transform: photoTransform,
                          }}
                        />
                      </div>
                    </foreignObject>
                  ) : (
                    <>
                      <circle cx={cx} cy={cy} r={photoSize / 2} fill={color} />
                      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="11" fontWeight="950" fill="white" fontFamily="sans-serif">{playerInitials(player)}</text>
                    </>
                  )}
                  <circle cx={cx + 16} cy={cy - 16} r="8.5" fill="#0f172a" stroke="rgba(255,255,255,0.75)" strokeWidth="1" />
                  <text x={cx + 16} y={cy - 13} textAnchor="middle" fontSize="8" fontWeight="950" fill="white" fontFamily="sans-serif">{marker}</text>
                  <rect x={cx - (labelMetrics.width / 2)} y={cy + 23} width={labelMetrics.width} height="15" rx="7.5" fill="rgba(15,23,42,0.88)" stroke="rgba(255,255,255,0.22)" strokeWidth="0.8" />
                  <text x={cx} y={cy + 34} textAnchor="middle" fontSize={labelMetrics.fontSize} fontWeight="850" fill="white" fontFamily="sans-serif">{label}</text>
                </>
              ) : (
                <>
                  <circle
                    cx={cx}
                    cy={cy}
                    r="18"
                    fill={selected ? "#facc15" : "rgba(255,255,255,0.08)"}
                    stroke={selected ? "#fbbf24" : color}
                    strokeWidth={selected ? 2.5 : 1.5}
                    strokeDasharray="4 3"
                  />
                  <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="900" fill="white" fontFamily="sans-serif">{slot.role}</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

const plannerStyles = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  title: {
    margin: 0,
    fontSize: 18,
    lineHeight: 1.2,
  },
  muted: {
    margin: "5px 0 0",
    color: "#94a3b8",
    fontSize: 13,
  },
  actions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  toolbar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 14,
  },
  halfTabs: {
    display: "flex",
    padding: 3,
    borderRadius: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  tab: {
    minWidth: 42,
    height: 30,
    border: "none",
    borderRadius: 8,
    background: "transparent",
    color: "#94a3b8",
    fontWeight: 900,
    cursor: "pointer",
  },
  tabActive: {
    background: "rgba(56,189,248,0.16)",
    color: "#7dd3fc",
  },
  select: {
    minHeight: 36,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.82)",
    color: "#e2e8f0",
    padding: "0 10px",
    fontWeight: 800,
  },
  grid: {
    display: "grid",
    gap: 18,
    alignItems: "start",
  },
  fieldWrap: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    minWidth: 0,
  },
  field: {
    width: "100%",
    maxWidth: 320,
    aspectRatio: "300 / 430",
    height: "auto",
    minHeight: 430,
    borderRadius: 8,
    overflow: "hidden",
    display: "block",
  },
  side: {
    display: "grid",
    gap: 10,
    minWidth: 0,
  },
  panelHeader: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: 900,
  },
  hint: {
    margin: 0,
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 1.45,
  },
  playerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
    gap: 8,
  },
  numberGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
    gap: 8,
    padding: 10,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.035)",
  },
  numberRow: {
    display: "grid",
    gridTemplateColumns: "1fr 46px",
    gap: 8,
    alignItems: "center",
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: 750,
    minWidth: 0,
  },
  numberInput: {
    width: 46,
    height: 32,
    borderRadius: 9,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15,23,42,0.9)",
    color: "#e2e8f0",
    textAlign: "center",
    fontWeight: 900,
    boxSizing: "border-box",
  },
  playerButton: {
    minHeight: 38,
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.045)",
    color: "#e2e8f0",
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    textAlign: "left",
    fontWeight: 750,
    cursor: "pointer",
  },
  roleBadge: {
    width: 26,
    fontSize: 11,
    fontWeight: 950,
    flex: "0 0 auto",
  },
  empty: {
    margin: 0,
    color: "#64748b",
    fontSize: 13,
  },
  notes: {
    width: "100%",
    minHeight: 82,
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(15,23,42,0.82)",
    color: "#e2e8f0",
    padding: 12,
    resize: "vertical",
    boxSizing: "border-box",
  },
};
