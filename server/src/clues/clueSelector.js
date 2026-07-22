const CONFIG = require("../config");
const { getMaxPrivateClues } = require("../game/playtestSettings");

function privateClue(playerId, text, meta = {}) {
  return {
    visibility: "private",
    playerId,
    text: String(text || "").trim(),
    category: meta.category || "generic",
    placeKey: meta.placeKey || "",
    priority: Number(meta.priority ?? getPriority(meta.category || "generic")),
    eventId: meta.eventId || "",
    guaranteed: Boolean(meta.guaranteed)
  };
}

function publicClue(text, meta = {}) {
  return {
    visibility: "public",
    text: String(text || "").trim(),
    category: meta.category || "generic",
    priority: Number(meta.priority ?? getPriority(meta.category || "generic")),
    eventId: meta.eventId || "",
    guaranteed: Boolean(meta.guaranteed)
  };
}

function getPriority(category) {
  return Number(CONFIG.clues.categoryPriority[category] ?? CONFIG.clues.categoryPriority.generic ?? 10);
}

function compactPrivateCluesByPlayerId(input, room = null) {
  const result = {};

  for (const [playerId, clues] of Object.entries(input || {})) {
    result[playerId] = selectClues(clues, room).map(clue => typeof clue === "string" ? clue : clue.text).filter(Boolean);
  }

  return result;
}

function selectClues(clues, room = null) {
  const normalized = (clues || [])
    .map(clue => typeof clue === "string" ? privateClue("", clue) : clue)
    .filter(clue => clue && clue.text);

  normalized.sort((a, b) => {
    const guaranteedDiff = Number(Boolean(b.guaranteed)) - Number(Boolean(a.guaranteed));
    if (guaranteedDiff !== 0) return guaranteedDiff;

    const diff = Number(b.priority || 0) - Number(a.priority || 0);
    if (diff !== 0) return diff;
    return String(a.text).localeCompare(String(b.text));
  });

  const selected = [];
  const seenText = new Set();
  const seenCategory = new Set();
  const seenPlace = new Set();

  for (const clue of normalized) {
    const textKey = clue.text.toLowerCase();
    const categoryKey = clue.category || "";
    const placeKey = clue.placeKey || "";

    if (seenText.has(textKey)) continue;
    if (categoryKey && seenCategory.has(categoryKey)) continue;
    if (placeKey && seenPlace.has(placeKey)) continue;

    if (!clue.guaranteed && selected.length >= getMaxPrivateClues(room)) {
      continue;
    }

    selected.push(clue);
    seenText.add(textKey);
    if (categoryKey) seenCategory.add(categoryKey);
    if (placeKey) seenPlace.add(placeKey);
  }

  return selected;
}

function groupCluesByPlayer(clues, room = null) {
  const result = {};

  for (const clue of clues || []) {
    if (!clue || clue.visibility !== "private" || !clue.playerId || !clue.text) continue;
    if (!result[clue.playerId]) result[clue.playerId] = [];
    result[clue.playerId].push(clue);
  }

  return compactPrivateCluesByPlayerId(result, room);
}

function selectPublicClues(clues) {
  return (clues || [])
    .filter(clue => clue && clue.visibility === "public" && clue.text)
    .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0))
    .slice(0, CONFIG.clues.maxPublicCluesPerNight)
    .map(clue => clue.text);
}

module.exports = {
  privateClue,
  publicClue,
  getPriority,
  compactPrivateCluesByPlayerId,
  groupCluesByPlayer,
  selectPublicClues
};
