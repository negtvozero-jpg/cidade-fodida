const crypto = require("crypto");
const CONFIG = require("../config");
const { PHASE, WINNER } = require("../constants");
const { sanitizePlayerName } = require("../sanitize");
const { POI_CONFIG } = require("../data/map");
const { createDefaultPlaytestSettings } = require("./playtestSettings");

function createRoomCode(existingCodes = new Set()) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  for (let attempt = 0; attempt < 100; attempt++) {
    let code = "";

    for (let index = 0; index < CONFIG.room.codeLength; index++) {
      code += alphabet[Math.floor(Math.random() * alphabet.length)];
    }

    if (!existingCodes.has(code)) {
      return code;
    }
  }

  return String(Date.now()).slice(-CONFIG.room.codeLength).toUpperCase();
}

function createRoom({ roomCode, hostPlayer }) {
  return {
    roomCode,
    hostPlayerId: hostPlayer.id,
    phase: PHASE.LOBBY,
    dayNumber: 0,
    phaseEndsAt: 0,
    phaseTotalSeconds: 0,
    timerInterval: null,

    players: [hostPlayer],
    playtestSettings: createDefaultPlaytestSettings(),
    votes: {},
    nightActions: {},
    lastActionErrorByPlayerId: {},

    eventLog: [],
    nightEvents: [],
    dayResultAnnouncements: [],
    nightResultAnnouncements: [],

    lastNightPublicText: [],
    lastNightPrivateCluesByPlayerId: {},
    lastPublishedPublicClues: [],
    privateCluesByPlayerId: {},

    sabotages: {},
    delayedDeaths: [],

    skipVoteCount: 0,
    submittedVoteCount: 0,
    eligibleVoteCount: 0,
    lastVoteCounts: {},
    lastSkipVoteCount: 0,
    lastSubmittedVoteCount: 0,
    lastEligibleVoteCount: 0,

    hasDayResult: false,
    hasVotedOut: false,
    lastVotedOutIndex: -1,
    lastVotedOutName: "",

    hasNightResult: false,
    hasVictim: false,
    lastVictimIndex: -1,
    lastVictimName: "",
    lastVictims: [],

    winner: WINNER.NONE,
    neutralWinnerId: "",
    neutralWinnerName: "",
    alliedWinnerNames: [],
    gameOverMessage: "",

    pois: buildInitialPois()
  };
}

function createPlayer({ socketId, index, name, isHost = false }) {
  return {
    id: crypto.randomUUID(),
    socketId,
    index,
    name,
    isHost,
    isAlive: true,
    roleId: "",
    roleName: "",
    alignment: 0,
    roleMessage: "",
    energy: CONFIG.player.initialEnergy,
    maxEnergy: CONFIG.player.maxEnergy,
    effects: [],
    neutralTargetId: "",
    neutralTargetRoleId: "",
    neutralTargetRoleName: "",
    neutralTargetName: "",
    hasWonNeutral: false,
    hasWonWithClient: false,
    previousRoleId: "",
    previousRoleName: "",
    previousAlignment: 0,
    cultistRitualProgress: 0,
    cultistRitualPoiCodes: [],
    condemnedById: "",
    hasUsedCondemn: false,
    synergyNightsRemaining: 0,
    lastSeenAt: Date.now()
  };
}

function resolvePlayerName({ room, rawName, fallbackIndex }) {
  const name = sanitizePlayerName(rawName);

  if (name) {
    return name;
  }

  const index = Number(fallbackIndex || (room?.players?.length || 0) + 1);
  return `${CONFIG.player.defaultNamePrefix} ${index}`;
}

function addPlayerToRoom(room, { socketId, rawName }) {
  const index = room.players.length + 1;
  const player = createPlayer({
    socketId,
    index,
    name: resolvePlayerName({ room, rawName, fallbackIndex: index }),
    isHost: false
  });

  room.players.push(player);
  return player;
}

function findPlayer(room, playerId) {
  return room?.players?.find(player => player.id === playerId) || null;
}

function findPlayerBySocket(room, socketId) {
  return room?.players?.find(player => player.socketId === socketId) || null;
}

function getAlivePlayers(room) {
  return room.players.filter(player => player.isAlive);
}

function markPlayerDisconnected(player) {
  if (!player) return;
  player.socketId = "";
  player.lastSeenAt = Date.now();
}

function buildInitialPois() {
  return POI_CONFIG.codes.map(code => {
    const definition = POI_CONFIG.definitions[code];
    return {
      index: definition.index,
      code: definition.code,
      poiType: definition.poiType,
      status: "normal",
      selectionEnabled: true,
      name: definition.displayName
    };
  });
}

module.exports = {
  createRoomCode,
  createRoom,
  createPlayer,
  resolvePlayerName,
  addPlayerToRoom,
  findPlayer,
  findPlayerBySocket,
  getAlivePlayers,
  markPlayerDisconnected
};
