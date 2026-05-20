export const VIP_LEVELS = [
  { name: "bronze", min: 0, label: "Bronze" },
  { name: "silver", min: 100, label: "Silver" },
  { name: "gold", min: 300, label: "Gold" },
  { name: "elite", min: 700, label: "Elite" },
];

export const VIP_REWARDS = {
  bronze: null,
  silver: {
    promotionCode: "COACH20",
    label: "Sconto coach",
    description: "Codice reward per upgrade o rinnovo Premium.",
  },
  gold: {
    promotionCode: "FREE30",
    label: "Free month reward",
    description: "Codice reward riservato ai team Gold.",
  },
  elite: {
    promotionCode: "VIP30",
    label: "Elite club reward",
    description: "Codice reward massimo per club ad alta attività.",
  },
};

export function getVipLevel(points = 0) {
  const safePoints = Number(points || 0);
  return [...VIP_LEVELS].reverse().find((level) => safePoints >= level.min) || VIP_LEVELS[0];
}

export function getNextVipLevel(points = 0) {
  const safePoints = Number(points || 0);
  return VIP_LEVELS.find((level) => level.min > safePoints) || null;
}

export function getVipProgress(points = 0) {
  const safePoints = Number(points || 0);
  const current = getVipLevel(safePoints);
  const next = getNextVipLevel(safePoints);

  if (!next) {
    return {
      current,
      next: null,
      points: safePoints,
      percent: 100,
      pointsToNext: 0,
    };
  }

  const range = next.min - current.min;
  const completed = safePoints - current.min;

  return {
    current,
    next,
    points: safePoints,
    percent: Math.max(0, Math.min(100, Math.round((completed / range) * 100))),
    pointsToNext: Math.max(0, next.min - safePoints),
  };
}

export function getVipReward(levelName) {
  return VIP_REWARDS[levelName] || null;
}

export function getUnlockedVipRewards(points = 0) {
  const current = getVipLevel(points);
  return VIP_LEVELS
    .filter((level) => level.min <= current.min)
    .map((level) => ({
      level: level.name,
      levelLabel: level.label,
      reward: getVipReward(level.name),
    }))
    .filter((item) => Boolean(item.reward));
}
