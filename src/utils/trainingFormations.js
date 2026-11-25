import { normalizeRoleToGroup } from "./helpers.js";

const roles = {
  P: ["Portiere"], DS: ["Terzino Sinistro", "Terzino"], DC: ["Difensore Centrale"],
  DD: ["Terzino Destro", "Terzino"], ES: ["Esterno Sinistro", "Esterno", "Ala Sinistra", "Ala"],
  ED: ["Esterno Destro", "Esterno", "Ala Destra", "Ala"],
  CS: ["Mezzala"], CD: ["Mezzala"], C: ["Mezzala"], M: ["Mediano", "Regista"],
  T: ["Trequartista"], AS: ["Ala Sinistra", "Ala"], AD: ["Ala Destra", "Ala"],
  SP: ["Seconda Punta", "Centravanti", "Prima Punta"], A: ["Centravanti", "Prima Punta"],
};
const groups = {
  P:"P", DS:"D", DC:"D", DD:"D", ES:"C", ED:"C", CS:"C", CD:"C",
  C:"C", M:"C", T:"C", AS:"A", AD:"A", SP:"A", A:"A",
};
const generic = {
  p:"P", portieri:"P", d:"D", difensore:"D", difensori:"D",
  c:"C", centrocampista:"C", centrocampisti:"C", a:"A", attaccante:"A", attaccanti:"A",
};
const groupTags = { Portieri:"P", Difensori:"D", Centrocampisti:"C", Attaccanti:"A" };
const aliases = { por:"portiere", dc:"difensore centrale", td:"terzino destro", ts:"terzino sinistro",
  cc:"centrocampista", trq:"trequartista", ad:"ala destra", as:"ala sinistra", sp:"seconda punta" };
function normalized(role) {
  const value = String(role ?? "").trim().toLowerCase();
  return Object.hasOwn(aliases, value) ? aliases[value] : value;
}
const exact = new Map(Object.entries(roles).flatMap(([code, names]) =>
  names.map((name) => [normalized(name), groups[code]])
));

export function getTrainingRoleTag(role) {
  const name = normalized(role);
  return Object.hasOwn(generic, name) ? generic[name] : exact.get(name) || groupTags[normalizeRoleToGroup(name)] || null;
}

function allowsRole(role, slot) {
  const name = normalized(role);
  if (!name) return false;
  if (Object.hasOwn(generic, name)) return generic[name] === slot.role;
  if (exact.has(name)) return slot.positions.some((value) => normalized(value) === name);
  return getTrainingRoleTag(name) === slot.role;
}

export function trainingPositionFit(player, slot) {
  if (!player || !slot) return -1;
  if (allowsRole(player.role, slot)) return 0;
  return (Array.isArray(player.altRoles) ? player.altRoles : []).some((role) => allowsRole(role, slot)) ? 1 : -1;
}

function formation(...rows) {
  const lines = [88, ...({2:[25],3:[67,25],4:[67,45,20],5:[68,53,34,16]}[rows.length] || [])];
  return rows.flatMap((line, row) => {
    const positions = line.split(" ");
    return positions.map((code, index) => ({
      role: groups[code],
      positions: roles[code],
      x: 100 * (index + 1) / (positions.length + 1),
      y: lines[row],
    }));
  });
}

// Keep the slot order of formations saved by earlier versions.
export const TRAINING_FORMATIONS = {
  "4-3-3": formation("P","DS DC DC DD","CS M CD","AS A AD"),
  "4-4-2": formation("P","DS DC DC DD","ES CS CD ED","SP A"),
  "4-3-1-2": formation("P","DS DC DC DD","CS M CD","T","SP A"),
  "4-2-3-1": formation("P","DS DC DC DD","M M","AS T AD","A"),
  "3-5-2": formation("P","DC DC DC","ES CS M CD ED","SP A"),
  "3-4-3": formation("P","DC DC DC","ES CS CD ED","AS A AD"),
  "3-4-1-2": formation("P","DC DC DC","ES CS CD ED","T","SP A"),
  "5-3-2": formation("P","DS DC DC DC DD","CS M CD","SP A"),
  "Solo portiere": formation("P"),
  "1": formation("P","A"),
  "1-1": formation("P","DC","A"),
  "2-1": formation("P","DC DC","A"),
  "1-1-1": formation("P","DC","C","A"),
  "2-2": formation("P","DC DC","SP A"),
  "2-1-1": formation("P","DC DC","C","A"),
  "1-2-1": formation("P","DC","CS CD","A"),
  "2-2-1": formation("P","DC DC","CS CD","A"),
  "2-1-2": formation("P","DC DC","M","SP A"),
  "3-1-1": formation("P","DS DC DD","M","A"),
  "1-1-3": formation("P","DC","M","AS A AD"),
  "2-3-1": formation("P","DC DC","ES M ED","A"),
  "3-2-1": formation("P","DS DC DD","CS CD","A"),
  "2-2-2": formation("P","DC DC","CS CD","SP A"),
  "2-1-3": formation("P","DC DC","M","AS A AD"),
  "3-3-1": formation("P","DS DC DD","CS M CD","A"),
  "2-3-2": formation("P","DC DC","ES M ED","SP A"),
  "3-2-2": formation("P","DS DC DD","CS CD","SP A"),
  "2-2-3": formation("P","DC DC","CS CD","AS A AD"),
  "3-3-2": formation("P","DS DC DD","CS M CD","SP A"),
  "3-4-1": formation("P","DS DC DD","ES CS CD ED","A"),
  "4-3-1": formation("P","DS DC DC DD","CS M CD","A"),
  "3-2-3": formation("P","DS DC DD","CS CD","AS A AD"),
  "4-3-2": formation("P","DS DC DC DD","CS M CD","SP A"),
  "3-4-2": formation("P","DC DC DC","ES CS CD ED","SP A"),
  "3-3-3": formation("P","DC DC DC","CS M CD","AS A AD"),
};

export const clampTrainingSideSize = (size) => Math.min(11, Math.max(1, Math.floor(Number(size) || 11)));
export const TRAINING_BENCH_BASE = 100;
export const trainingBenchKey = (teamIndex) => TRAINING_BENCH_BASE + teamIndex;
export function getTrainingModuleOptions(size) {
  return Object.keys(TRAINING_FORMATIONS).filter((key) => TRAINING_FORMATIONS[key].length === clampTrainingSideSize(size));
}

function matchPlayers(players, candidateSlots, numTeams) {
  // Shortest augmenting paths maximize the number of eligible players first,
  // then keep sides balanced and prefer saved positions and primary roles.
  const firstSlot = players.length + 1;
  const firstTeam = firstSlot + candidateSlots.length;
  const sink = firstTeam + numTeams;
  const edges = Array.from({ length: sink + 1 }, () => []);
  function connect(from, to, cost) {
    const forward = { to, cost, open: true, reverse: edges[to].length };
    const backward = { to: from, cost: -cost, open: false, reverse: edges[from].length };
    edges[from].push(forward);
    edges[to].push(backward);
    return forward;
  }

  const assignments = [];
  players.forEach(({ player }, index) => {
    connect(0, index + 1, 0);
    candidateSlots.forEach(({ slot, anchor }, slotIndex) => {
      const fit = trainingPositionFit(player, slot);
      if (fit < 0) return;
      const preserved = anchor != null && String(anchor) === String(player.id);
      const junior = player._juniores || player.gruppo === "juniores";
      const cost = 12 + fit * 4 + (junior && numTeams > 1 ? 5 : 0) - (preserved ? 10 : 0);
      const edge = connect(index + 1, firstSlot + slotIndex, cost);
      assignments.push({ edge, player, slotIndex, fit, preserved });
    });
  });
  const capacity = Array(numTeams).fill(0);
  candidateSlots.forEach(({ teamIndex }, index) => {
    connect(firstSlot + index, firstTeam + teamIndex, 0);
    capacity[teamIndex]++;
  });
  capacity.forEach((count, i) => {
    for (let rank = 0; rank < count; rank++) connect(firstTeam + i, sink, rank * 8);
  });

  while (true) {
    const costs = Array(edges.length).fill(Infinity);
    const previous = Array(edges.length);
    const inQueue = Array(edges.length).fill(false);
    const queue = [0];
    costs[0] = 0;
    inQueue[0] = true;
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const from = queue[cursor];
      inQueue[from] = false;
      if (from === sink) continue;
      edges[from].forEach((edge, index) => {
        if (!edge.open || costs[from] + edge.cost >= costs[edge.to]) return;
        costs[edge.to] = costs[from] + edge.cost;
        previous[edge.to] = [from,index];
        if (!inQueue[edge.to]) {
          inQueue[edge.to] = true;
          queue.push(edge.to);
        }
      });
    }
    if (!previous[sink]) break;
    for (let to = sink; to !== 0;) {
      const [from,index] = previous[to];
      const edge = edges[from][index];
      edge.open = false;
      edges[to][edge.reverse].open = true;
      to = from;
    }
  }
  return assignments.filter(({ edge }) => !edge.open);
}

function scoreLayout(players, modules, anchors = []) {
  const candidates = modules.flatMap((key, teamIndex) =>
    TRAINING_FORMATIONS[key].map((slot, index) => ({ slot, index, teamIndex, anchor: anchors[teamIndex]?.[index] }))
  );
  const matches = matchPlayers(players, candidates, modules.length);
  const sides = modules.map((formation) => ({ formation, slots: {} }));
  let primary = 0;
  let preserved = 0;
  let juniors = 0;
  matches.forEach(({ player, fit, slotIndex, preserved: retained }) => {
    const { teamIndex, index } = candidates[slotIndex];
    sides[teamIndex].slots[index] = player;
    primary += fit === 0 ? 1 : 0;
    preserved += retained ? 1 : 0;
    juniors += player._juniores || player.gruppo === "juniores" ? 1 : 0;
  });
  const counts = sides.map((side) => Object.keys(side.slots).length);
  return { sides, score: [matches.length, -(Math.max(...counts)-Math.min(...counts)), -juniors, primary, preserved] };
}

function isBetter(left, right) {
  if (!right) return true;
  const firstDifference = left.findIndex((value, index) => value !== right[index]);
  return firstDifference >= 0 && left[firstDifference] > right[firstDifference];
}

export function resolveTrainingFormation(players, size, saved = {}) {
  saved = saved || {};
  const automatic = !Object.hasOwn(TRAINING_FORMATIONS, saved.formation) || saved.automatic === true;
  const options = automatic ? getTrainingModuleOptions(size) : [saved.formation];
  let best;
  for (const formation of options) {
    const candidate = scoreLayout(players.map((player) => ({ player })), [formation], formation === saved.formation ? [saved.slots] : []);
    if (isBetter(candidate.score, best?.score)) best = candidate;
  }
  return { ...best.sides[0], automatic };
}

export function generateTrainingSides(players, numTeams, size) {
  const options = getTrainingModuleOptions(size);
  // With two sides, compare all combinations. Three and four sides use
  // common modules to keep the larger training format predictable.
  const combinations = numTeams === 2
    ? options.flatMap((a) => options.map((b) => [a,b]))
    : options.map((key) => Array(numTeams).fill(key));
  const unique = [...new Map(players.map((player) => [String(player.id), player])).values()];
  const entries = unique.map((player) => ({ player }));
  let best;
  for (const modules of combinations) {
    const candidate = scoreLayout(entries, modules);
    if (isBetter(candidate.score, best?.score)) best = candidate;
  }
  const assigned = new Set(best.sides.flatMap(({ slots }) => Object.values(slots).map(({ id }) => String(id))));
  return {
    sides: best.sides.map((side) => ({ ...side, automatic: true })),
    remaining: unique.filter(({ id }) => !assigned.has(String(id))),
  };
}

export function serializeTrainingFormation({ formation, slots, automatic }) {
  return {
    formation, automatic,
    slots: Object.fromEntries(Object.entries(slots).filter(([, player]) => player).map(([slot, player]) => [slot, String(player.id)])),
  };
}

export function buildTrainingTeamPlan(players, numTeams, maxPlayers = 11) {
  const teamSize = clampTrainingSideSize(Math.min(maxPlayers, Math.max(1, Math.ceil(players.length / numTeams))));
  const { sides, remaining } = generateTrainingSides(players, numTeams, teamSize);
  const benches = Array.from({ length: numTeams }, () => []);
  const assignments = {};
  const formations = {};
  const teams = sides.map((side, teamIndex) => {
    const members = Object.values(side.slots);
    members.forEach(({ id }) => { assignments[String(id)] = teamIndex; });
    formations[teamIndex] = serializeTrainingFormation(side);
    return members;
  });
  remaining.forEach((player, index) => {
    const teamIndex = index % numTeams;
    assignments[String(player.id)] = trainingBenchKey(teamIndex);
    benches[teamIndex].push(player);
  });
  return { teams, benches, assignments, formations, teamSize };
}
