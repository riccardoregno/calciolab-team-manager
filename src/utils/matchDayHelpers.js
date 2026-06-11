export function getOpponentScouting(match) {
  return {
    formation: match?.opponentScouting?.formation || "",
    lineup: (match?.opponentScouting?.lineup || []).map((player) => ({
      ...player,
      birthYear: player.birthYear || "",
    })),
    keyPlayers: match?.opponentScouting?.keyPlayers || "",
    strengths: match?.opponentScouting?.strengths || "",
    weaknesses: match?.opponentScouting?.weaknesses || "",
    setPiecesFor: match?.opponentScouting?.setPiecesFor || "",
    setPiecesAgainst: match?.opponentScouting?.setPiecesAgainst || "",
    returnLegNotes: match?.opponentScouting?.returnLegNotes || "",
    attachment: match?.opponentScouting?.attachment || null,
  };
}

export function getPreMatchChecklist(match) {
  const checklist = match?.preMatchChecklist || {};
  return {
    items: checklist.items || {},
    staffArrivalTime: checklist.staffArrivalTime || "",
    staffResponsible: checklist.staffResponsible || "",
    refereeInfo: checklist.refereeInfo || "",
    logisticsNotes: checklist.logisticsNotes || "",
  };
}

export function getChecklistItems({ match, venue, t }) {
  const details = match?.convocazione?.details || {};
  return [
    {
      key: "documents",
      label: t("pages.matchDay.checklistDocumentsLabel"),
      detail: t("pages.matchDay.checklistDocumentsDetail"),
    },
    {
      key: "kits",
      label: t("pages.matchDay.checklistKitsLabel"),
      detail: details.kit || t("pages.matchDay.checklistKitsDefault"),
    },
    {
      key: "water",
      label: t("pages.matchDay.checklistWaterLabel"),
      detail: t("pages.matchDay.checklistWaterDetail"),
    },
    {
      key: "medical",
      label: t("pages.matchDay.checklistMedicalLabel"),
      detail: t("pages.matchDay.checklistMedicalDetail"),
    },
    {
      key: "field",
      label: t("pages.matchDay.checklistFieldLabel"),
      detail: venue || details.meetingPlace || t("pages.matchDay.checklistFieldDefault"),
    },
    {
      key: "referee",
      label: t("pages.matchDay.checklistRefereeLabel2"),
      detail: t("pages.matchDay.checklistRefereeDetail"),
    },
    {
      key: "opponentLineup",
      label: t("pages.matchDay.checklistOpponentLabel"),
      detail: match?.opponentScouting?.attachment ? t("pages.matchDay.checklistOpponentDone") : t("pages.matchDay.checklistOpponentTodo"),
    },
    {
      key: "warmup",
      label: t("pages.matchDay.checklistWarmupLabel"),
      detail: t("pages.matchDay.checklistWarmupDetail"),
    },
  ];
}

export function hasText(value) {
  return String(value || "").trim().length > 0;
}

export function getHomeVenue(profile = {}) {
  return [profile.homeFieldName, profile.homeFieldAddress, profile.homeFieldSurface]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" - ");
}

export function getMatchVenue(match = {}, profile = {}) {
  const importedVenue = [match.venueName, match.venueAddress]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" - ");

  if (importedVenue) return importedVenue;
  if (match.location === "Casa") return getHomeVenue(profile);
  return match.location || "";
}

export function buildMatchPlanPrefill({ match, venue, convocationCount, t }) {
  return [
    t("pages.matchDay.prefillOpponent", { value: match.opponent || t("pages.matchDay.checklistToBeDefined") }),
    match.competition ? t("pages.matchDay.prefillCompetition", { value: match.competition }) : "",
    match.matchday ? t("pages.matchDay.prefillMatchday", { value: match.matchday }) : "",
    venue ? t("pages.matchDay.prefillField", { value: venue }) : "",
    match.time ? t("pages.matchDay.prefillTime", { value: match.time }) : "",
    convocationCount ? t("pages.matchDay.prefillCalled", { value: convocationCount }) : "",
    "",
    t("pages.matchDay.prefillGamePlanHeader"),
    t("pages.matchDay.prefillPossesso"),
    t("pages.matchDay.prefillNonPossesso"),
    t("pages.matchDay.prefillTransizioni"),
    t("pages.matchDay.prefillPalleInattive"),
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildStaffNotesPrefill({ match, venue, details, t }) {
  return [
    details.meetingTime || details.meetingPlace
      ? t("pages.matchDay.prefillRaduno", { value: [details.meetingTime, details.meetingPlace].filter(Boolean).join(" - ") })
      : "",
    details.lockerRoom ? t("pages.matchDay.prefillSpogliatoio", { value: details.lockerRoom }) : "",
    details.kit ? t("pages.matchDay.prefillKit", { value: details.kit }) : "",
    details.staffContact ? t("pages.matchDay.prefillStaffContact", { value: details.staffContact }) : "",
    details.message ? t("pages.matchDay.prefillMessage", { value: details.message }) : "",
    match.convocazione?.notes ? t("pages.matchDay.prefillConvoNotes", { value: match.convocazione.notes }) : "",
    venue ? t("pages.matchDay.prefillVerifica", { value: venue }) : "",
  ]
    .filter(Boolean)
    .join("\n");
}
