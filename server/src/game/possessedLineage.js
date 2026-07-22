const { ALIGNMENT, ROLE_KEY } = require("../constants");
const { ROLE_DEFINITIONS } = require("../data/roles");

function isPossessedLineageRole(roleId) {
  return roleId === ROLE_KEY.POSSESSED || roleId === ROLE_KEY.CONDEMNED;
}

function isPossessedLineagePlayer(player) {
  return Boolean(player && isPossessedLineageRole(player.roleId));
}

function getAlivePossessedLineage(room) {
  return (room.players || []).filter(player => player.isAlive && isPossessedLineagePlayer(player));
}

function getAlivePossessed(room) {
  return (room.players || []).filter(player => player.isAlive && player.roleId === ROLE_KEY.POSSESSED);
}

function getAliveCondemned(room) {
  return (room.players || []).filter(player => player.isAlive && player.roleId === ROLE_KEY.CONDEMNED);
}

function canCondemn(room, actor, target) {
  if (!room || !actor || !target) return false;
  if (!actor.isAlive || !target.isAlive) return false;
  if (actor.roleId !== ROLE_KEY.POSSESSED) return false;
  if (actor.hasUsedCondemn) return false;
  if (actor.id === target.id) return false;
  if (isPossessedLineagePlayer(target)) return false;
  if (getAliveCondemned(room).length > 0) return false;
  return true;
}

function turnPlayerIntoCondemned(room, actor, target) {
  if (!canCondemn(room, actor, target)) return false;

  const currentEnergy = target.energy;
  const currentMaxEnergy = target.maxEnergy;
  const currentEffects = Array.isArray(target.effects) ? [...target.effects] : [];
  const condemnedRole = ROLE_DEFINITIONS[ROLE_KEY.CONDEMNED];

  target.previousRoleId = target.roleId;
  target.previousRoleName = target.roleName;
  target.previousAlignment = target.alignment;
  target.roleId = condemnedRole.id;
  target.roleName = condemnedRole.name;
  target.alignment = ALIGNMENT.NEUTRAL;
  target.roleMessage = condemnedRole.roleMessage;
  target.energy = currentEnergy;
  target.maxEnergy = currentMaxEnergy;
  target.effects = currentEffects;
  target.neutralTargetId = "";
  target.neutralTargetRoleId = "";
  target.neutralTargetRoleName = "";
  target.neutralTargetName = "";
  target.cultistRitualProgress = 0;
  target.cultistRitualPoiCodes = [];
  target.condemnedById = actor.id;
  target.hasUsedCondemn = true;
  target.synergyNightsRemaining = 0;

  actor.hasUsedCondemn = true;
  return true;
}

function promoteCondemnedIfNeeded(room, events = []) {
  if (getAlivePossessed(room).length > 0) return null;

  const heir = getAliveCondemned(room)[0];
  if (!heir) return null;

  const possessedRole = ROLE_DEFINITIONS[ROLE_KEY.POSSESSED];

  heir.roleId = possessedRole.id;
  heir.roleName = possessedRole.name;
  heir.alignment = ALIGNMENT.NEUTRAL;
  heir.roleMessage = possessedRole.roleMessage;
  heir.hasUsedCondemn = false;
  heir.condemnedById = "";
  heir.synergyNightsRemaining = 0;

  events.push({
    type: "possessed_successor_awakened",
    actorId: heir.id
  });

  return heir;
}

function activateSynergy(player, nights = 2) {
  if (!isPossessedLineagePlayer(player)) return false;
  player.synergyNightsRemaining = Math.max(Number(player.synergyNightsRemaining || 0), nights);
  return true;
}

function decrementSynergy(room) {
  for (const player of room.players || []) {
    if (!player.isAlive || !isPossessedLineagePlayer(player)) continue;
    if (Number(player.synergyNightsRemaining || 0) > 0) {
      player.synergyNightsRemaining = Math.max(0, Number(player.synergyNightsRemaining || 0) - 1);
    }
  }
}

module.exports = {
  isPossessedLineageRole,
  isPossessedLineagePlayer,
  getAlivePossessedLineage,
  getAlivePossessed,
  getAliveCondemned,
  canCondemn,
  turnPlayerIntoCondemned,
  promoteCondemnedIfNeeded,
  activateSynergy,
  decrementSynergy
};
