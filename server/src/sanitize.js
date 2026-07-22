function sanitizeRoomCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function sanitizePlayerName(value) {
  return String(value || "")
    .trim()
    .replace(/[|;]/g, "")
    .slice(0, 18);
}

module.exports = {
  sanitizeRoomCode,
  sanitizePlayerName
};
