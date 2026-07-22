const { ALIGNMENT, ROLE_KEY } = require("../constants");
const { ROLE_DEFINITIONS } = require("../data/roles");
const { POI_CONFIG } = require("../data/map");
const CONFIG = require("../config");
const { debugLog } = require("../debug");
const { ensurePlaytestSettings, isRoleEnabled } = require("./playtestSettings");

function assignRoles(room, rng = Math.random) {
  ensurePlaytestSettings(room);
  const players = shuffle([...room.players], rng);
  const rolePool = buildRolePool(players.length, rng, room);

  for (let index = 0; index < players.length; index++) {
    const player = players[index];
    const roleId = rolePool[index] || ROLE_KEY.RESIDENT;
    applyRole(player, roleId);
  }

  assignNeutralTargets(room, rng);

  debugLog("roles", "roles assigned", {
    roomCode: room.roomCode,
    players: room.players.map(player => ({
      index: player.index,
      name: player.name,
      roleId: player.roleId,
      roleName: player.roleName,
      alignment: player.alignment,
      neutralTargetRoleName: player.neutralTargetRoleName || "",
      neutralTargetName: player.neutralTargetName || ""
    }))
  });
}

function buildRolePool(playerCount, rng = Math.random, room = null) {
  const roles = [];
  const impostorPool = shuffle(filterAssignableRoles([
    ROLE_KEY.KILLER,
    ROLE_KEY.STALKER,
    ROLE_KEY.OBSESSOR,
    ROLE_KEY.METAMORPH,
    ROLE_KEY.ILLUSIONIST,
    ROLE_KEY.OCCULTIST,
    ROLE_KEY.HYPNOTIST,
    ROLE_KEY.LITHOMANCER
  ], playerCount, room), rng);

  const neutralPool = shuffle(filterAssignableRoles([
    ROLE_KEY.JOKER,
    ROLE_KEY.INSTIGATOR,
    ROLE_KEY.LAWYER,
    ROLE_KEY.POSSESSED,
    ROLE_KEY.BOUNTY_HUNTER,
    ROLE_KEY.CULTIST
  ], playerCount, room), rng);

  const distribution = getAlignmentDistribution(playerCount);
  const impostorRoles = pickMany(impostorPool, distribution.impostors, rng);
  while (impostorRoles.length < distribution.impostors) impostorRoles.push(ROLE_KEY.KILLER);

  const neutralRoles = pickMany(neutralPool, distribution.neutrals, rng);
  const remainingSlots = Math.max(0, playerCount - impostorRoles.length - neutralRoles.length);

  roles.push(...impostorRoles);
  roles.push(...neutralRoles);
  roles.push(...buildInnocentPool(remainingSlots, playerCount, rng, room));

  while (roles.length < playerCount) roles.push(ROLE_KEY.RESIDENT);

  return shuffle(roles.slice(0, playerCount), rng);
}

function getAlignmentDistribution(playerCount) {
  if (playerCount >= 12) return { innocents: 9, impostors: 2, neutrals: 1 };
  if (playerCount === 11) return { innocents: 8, impostors: 2, neutrals: 1 };
  if (playerCount === 10) return { innocents: 7, impostors: 1, neutrals: 2 };
  if (playerCount === 9) return { innocents: 7, impostors: 1, neutrals: 1 };
  if (playerCount === 8) return { innocents: 6, impostors: 1, neutrals: 1 };
  if (playerCount === 7) return { innocents: 5, impostors: 1, neutrals: 1 };
  if (playerCount === 6) return { innocents: 5, impostors: 1, neutrals: 0 };
  if (playerCount === 5) return { innocents: 4, impostors: 1, neutrals: 0 };
  if (playerCount === 4) return { innocents: 3, impostors: 1, neutrals: 0 };
  return { innocents: Math.max(0, playerCount - 1), impostors: 1, neutrals: 0 };
}

function isRoleAssignable(roleId, playerCount, room = null) {
  const role = ROLE_DEFINITIONS[roleId];
  if (!role) return false;
  if (!isRoleEnabled(room, roleId)) return false;
  return Number(playerCount || 0) >= Number(role.minPlayers || 0);
}

function filterAssignableRoles(roleIds, playerCount, room = null) {
  return roleIds.filter(roleId => isRoleAssignable(roleId, playerCount, room));
}

function buildInnocentPool(count, playerCount, rng = Math.random, room = null) {
  const roles = filterAssignableRoles([
    ROLE_KEY.UNICORN,
    ROLE_KEY.DETECTIVE,
    ROLE_KEY.MEDIUM,
    ROLE_KEY.JOURNALIST
  ], playerCount, room).slice(0, count);

  if (roles.length < count && playerCount >= 8 && isRoleAssignable(ROLE_KEY.VIGILANTE, playerCount, room)) {
    roles.push(ROLE_KEY.VIGILANTE);
  }

  while (roles.length < count) {
    roles.push(ROLE_KEY.RESIDENT);
  }

  return shuffle(roles, rng);
}

function applyRole(player, roleId) {
  const role = ROLE_DEFINITIONS[roleId] || ROLE_DEFINITIONS[ROLE_KEY.RESIDENT];

  player.roleId = role.id;
  player.roleName = role.name;
  player.alignment = role.alignment;
  player.roleMessage = role.roleMessage || "";
  player.energy = CONFIG.player.initialEnergy;
  player.maxEnergy = CONFIG.player.maxEnergy;
  player.isAlive = true;
  player.effects = [];
  player.neutralTargetId = "";
  player.neutralTargetRoleId = "";
  player.neutralTargetRoleName = "";
  player.neutralTargetName = "";
  player.hasWonNeutral = false;
  player.hasWonWithClient = false;
  player.cultistRitualProgress = 0;
  player.cultistRitualPoiCodes = [];
  player.previousRoleId = "";
  player.previousRoleName = "";
  player.previousAlignment = ALIGNMENT.NONE;
  player.condemnedById = "";
  player.hasUsedCondemn = false;
  player.synergyNightsRemaining = 0;
}

function assignNeutralTargets(room, rng = Math.random) {
  for (const player of room.players) {
    if (player.roleId === ROLE_KEY.INSTIGATOR) {
      const target = pick(room.players.filter(candidate => candidate.id !== player.id), rng);
      if (target) {
        player.neutralTargetId = target.id;
        player.neutralTargetRoleId = target.roleId;
        player.neutralTargetRoleName = target.roleName;
        player.neutralTargetName = target.name;
      }
    }

    if (player.roleId === ROLE_KEY.BOUNTY_HUNTER) {
      const target = pick(room.players.filter(candidate => candidate.id !== player.id), rng);
      if (target) {
        player.neutralTargetId = target.id;
        player.neutralTargetRoleId = target.roleId;
        player.neutralTargetRoleName = target.roleName;
      }
    }

    if (player.roleId === ROLE_KEY.LAWYER) {
      const target = pick(room.players.filter(candidate => candidate.id !== player.id), rng);
      if (target) {
        player.neutralTargetId = target.id;
        player.neutralTargetName = target.name;
      }
    }

    if (player.roleId === ROLE_KEY.CULTIST) {
      player.cultistRitualProgress = 0;
      player.cultistRitualPoiCodes = shuffle(POI_CONFIG.codes, rng).slice(0, 4);
    }
  }
}

function shuffle(array, rng = Math.random) {
  const copy = [...array];

  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function pick(array, rng = Math.random) {
  if (!Array.isArray(array) || array.length <= 0) return null;
  return array[Math.floor(rng() * array.length)];
}

function pickMany(array, count, rng = Math.random) {
  const result = [];
  const source = shuffle(array, rng);
  if (source.length <= 0) return result;

  while (result.length < count) {
    result.push(source[result.length % source.length]);
  }

  return result;
}

function isImpostor(player) {
  return player?.alignment === ALIGNMENT.IMPOSTOR;
}

module.exports = {
  assignRoles,
  buildRolePool,
  applyRole,
  assignNeutralTargets,
  shuffle,
  pick,
  isImpostor
};
