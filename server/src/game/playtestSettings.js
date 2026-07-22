const CONFIG = require("../config");
const { ALIGNMENT, ROLE_KEY } = require("../constants");
const { ROLE_DEFINITIONS } = require("../data/roles");

const LOCKED_ROLE_IDS = new Set([
  ROLE_KEY.RESIDENT,
  ROLE_KEY.KILLER,
  ROLE_KEY.CONDEMNED,
  ROLE_KEY.THIEF
]);

function createDefaultPlaytestSettings() {
  return {
    firstDaySeconds: CONFIG.phase.firstDaySeconds,
    daySeconds: CONFIG.phase.daySeconds,
    nightSeconds: CONFIG.phase.nightSeconds,
    resultSeconds: CONFIG.phase.nightResultSeconds,
    votingOpensAtProgress: CONFIG.phase.votingOpensAtProgress,
    maxPrivateCluesPerPlayerPerNight: CONFIG.clues.maxPrivateCluesPerPlayerPerNight,
    disabledRoleIds: getDefaultDisabledRoleIds()
  };
}

function getDefaultDisabledRoleIds() {
  return Object.values(ROLE_DEFINITIONS)
    .filter(role => role.disabled)
    .map(role => role.id);
}

function ensurePlaytestSettings(room) {
  if (!room.playtestSettings) {
    room.playtestSettings = createDefaultPlaytestSettings();
  }
  return room.playtestSettings;
}

function sanitizePlaytestSettings(input, currentSettings = createDefaultPlaytestSettings()) {
  const current = currentSettings || createDefaultPlaytestSettings();
  const disabledRoleIds = normalizeDisabledRoleIds(input?.disabledRoleIds ?? current.disabledRoleIds);

  return {
    firstDaySeconds: clampInteger(input?.firstDaySeconds, 20, 240, current.firstDaySeconds),
    daySeconds: clampInteger(input?.daySeconds, 45, 420, current.daySeconds),
    nightSeconds: clampInteger(input?.nightSeconds, 30, 240, current.nightSeconds),
    resultSeconds: clampInteger(input?.resultSeconds, 5, 60, current.resultSeconds),
    votingOpensAtProgress: clampInteger(input?.votingOpensAtProgress, 10, 95, current.votingOpensAtProgress),
    maxPrivateCluesPerPlayerPerNight: clampInteger(input?.maxPrivateCluesPerPlayerPerNight, 1, 4, current.maxPrivateCluesPerPlayerPerNight),
    disabledRoleIds
  };
}

function normalizeDisabledRoleIds(input) {
  const list = Array.isArray(input) ? input : [];
  const result = new Set(getDefaultDisabledRoleIds());

  for (const roleId of list) {
    const id = String(roleId || "").trim();
    const role = ROLE_DEFINITIONS[id];
    if (!role) continue;
    if (LOCKED_ROLE_IDS.has(id)) continue;
    result.add(id);
  }

  return [...result];
}

function isRoleEnabled(room, roleId) {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) return false;
  if (role.disabled) return false;
  if (roleId === ROLE_KEY.RESIDENT || roleId === ROLE_KEY.KILLER) return true;
  const settings = ensurePlaytestSettings(room || {});
  return !settings.disabledRoleIds.includes(roleId);
}

function buildHostSettingsPayload(room) {
  const settings = ensurePlaytestSettings(room);
  return {
    settings,
    roleOptions: buildRoleOptions()
  };
}

function buildRoleOptions() {
  return Object.values(ROLE_DEFINITIONS)
    .filter(role => role.id !== ROLE_KEY.CONDEMNED)
    .map(role => ({
      id: role.id,
      name: role.name,
      alignment: role.alignment,
      alignmentName: alignmentName(role.alignment),
      minPlayers: Number(role.minPlayers || 0),
      disabledByDefault: Boolean(role.disabled),
      locked: LOCKED_ROLE_IDS.has(role.id),
      note: role.disabled ? "fora do sorteio" : role.id === ROLE_KEY.RESIDENT || role.id === ROLE_KEY.KILLER ? "base" : ""
    }));
}

function getPhaseDurationOverride(room, key, fallback) {
  const settings = ensurePlaytestSettings(room || {});
  return Number(settings?.[key] || fallback);
}

function getMaxPrivateClues(room) {
  const settings = ensurePlaytestSettings(room || {});
  return Number(settings.maxPrivateCluesPerPlayerPerNight || CONFIG.clues.maxPrivateCluesPerPlayerPerNight);
}

function alignmentName(alignment) {
  if (alignment === ALIGNMENT.INNOCENT) return "Inocente";
  if (alignment === ALIGNMENT.IMPOSTOR) return "Impostor";
  if (alignment === ALIGNMENT.NEUTRAL) return "Neutro";
  return "Outro";
}

function clampInteger(value, min, max, fallback) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

module.exports = {
  createDefaultPlaytestSettings,
  ensurePlaytestSettings,
  sanitizePlaytestSettings,
  isRoleEnabled,
  buildHostSettingsPayload,
  getPhaseDurationOverride,
  getMaxPrivateClues
};
