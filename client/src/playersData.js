export function encodePlayersData(players) {
  return players
    .map((player, arrayIndex) => {
      const index = Number(player.index || arrayIndex + 1);
      const id = sanitizeDataField(player.id || `player_${index}`);
      const name = sanitizeDataField(player.name || `Player ${index}`);
      const alive = player.isAlive ? 1 : 0;
      const publicStatus = mapPublicStatus(player.publicStatus);
      const houseVariant = Number(player.houseVariant ?? ((index - 1) % 4));
      const voteCount = Number(player.voteCount || 0);

      return `${index}|${id}|${name}|${alive}|${publicStatus}|${houseVariant}|${voteCount}`;
    })
    .join(";");
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