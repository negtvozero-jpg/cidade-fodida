export function encodePlayersData(players, options = {}) {
  const selectablePlayerIds = new Set(options.selectablePlayerIds || []);
  const selectablePlayerIndexes = new Set((options.selectablePlayerIndexes || []).map(value => Number(value)));
  const hasExplicitSelectionSet = selectablePlayerIds.size > 0 || selectablePlayerIndexes.size > 0;

  return players
    .map((player, arrayIndex) => {
      const index = Number(player.index || arrayIndex + 1);
      const id = sanitizeDataField(player.id || `player_${index}`);
      const name = sanitizeDataField(player.name || `Player ${index}`);
      const alive = player.isAlive ? 1 : 0;
      const publicStatus = mapPublicStatus(player.publicStatus);
      const houseVariant = Number(player.houseVariant ?? ((index - 1) % 4));
      const voteCount = Number(player.voteCount || 0);
      const houseSlot = Number(player.houseSlot || 0);
      const selectionEnabled = getPlayerSelectionEnabled(player, {
        selectablePlayerIds,
        selectablePlayerIndexes,
        hasExplicitSelectionSet,
        globalSelectionEnabled: Boolean(options.selectionEnabled),
        localPlayerId: options.localPlayerId || "",
        allowSelfTarget: Boolean(options.allowSelfTarget)
      }) ? 1 : 0;

      return `${index}|${id}|${name}|${alive}|${publicStatus}|${houseVariant}|${voteCount}|${houseSlot}|${selectionEnabled}`;
    })
    .join(";");
}

function getPlayerSelectionEnabled(player, options) {
  if (!options.globalSelectionEnabled || !player?.isAlive) return false;

  if (!options.allowSelfTarget && options.localPlayerId && player.id === options.localPlayerId) {
    return false;
  }

  if (!options.hasExplicitSelectionSet) {
    return true;
  }

  return options.selectablePlayerIds.has(player.id) || options.selectablePlayerIndexes.has(Number(player.index));
}

function mapPublicStatus(value) {
  if (value === "normal" || value === "nightDead" || value === "votedOut") {
    return value;
  }

  const numericValue = Number(value);

  if (numericValue === 1) {
    return "nightDead";
  }

  if (numericValue === 2) {
    return "votedOut";
  }

  return "normal";
}

function sanitizeDataField(value) {
  return String(value ?? "")
    .replace(/[|;]/g, "")
    .trim()
    .slice(0, 32);
}
