function sanitizeRoomCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function sanitizePlayerName(value) {
  const name = String(value || "").trim();

  if (!name) {
    return "";
  }

  return name.slice(0, 18);
}

module.exports = {
  sanitizeRoomCode,
  sanitizePlayerName
};
