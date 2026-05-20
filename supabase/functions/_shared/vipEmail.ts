export async function sendVipRewardEmail({ teamId, level, reward }) {
  // TODO: integrare provider email transazionale (es. Resend, SendGrid, Postmark).
  // Questa funzione resta server-side: non esporre mai token provider nel frontend.
  return {
    queued: false,
    teamId,
    level,
    reward,
  };
}

export async function sendLevelUpgradeEmail({ teamId, previousLevel, newLevel, reward }) {
  // TODO: integrare template email per upgrade livello VIP.
  // Futuro payload minimo: destinatario owner/team admin, livello precedente, nuovo livello, codice reward.
  return {
    queued: false,
    teamId,
    previousLevel,
    newLevel,
    reward,
  };
}
