const CONFIG = require("../config");
const { PHASE, ALIGNMENT, WINNER, ROLE_KEY, EFFECT_KEY } = require("../constants");
const { POI_CONFIG } = require("../data/map");
const { getResolvedActionsForPlayer } = require("./actionResolver");
const { getVoteSummary } = require("./voteResolver");
const { getPhaseTimeRemaining, getPhaseProgress, isVotingAllowed } = require("./phaseEngine");
const { getEffectLabels, getEffectMessages, hasEffect } = require("../data/effects");
const { getActivePublicEffectReminders } = require("./effectResolver");
const messages = require("../messages");
const { ensurePlaytestSettings, buildHostSettingsPayload } = require("./playtestSettings");

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

function buildSnapshot(room, player) {
  const votingAllowed = isVotingAllowed(room);
  const voteSummary = getVoteSummary(room);
  const publicState = buildPublicState(room, votingAllowed, voteSummary);
  const privateState = buildPrivateState(room, player, votingAllowed, voteSummary);

  return {
    public: publicState,
    private: privateState
  };
}

function buildPublicState(room, votingAllowed, voteSummary) {
  ensurePlaytestSettings(room);
  return {
    roomCode: room.roomCode,
    phase: room.phase,
    dayNumber: room.dayNumber,
    phaseTimeRemaining: getPhaseTimeRemaining(room),
    phaseTimeTotal: room.phaseTotalSeconds,
    phaseProgress: getPhaseProgress(room),

    playerCount: room.players.length,
    players: room.players.map(serializePublicPlayer),
    pois: room.pois || buildInitialPois(),

    publicMessage: messages.buildPublicMessage({ room, votingAllowed, voteSummary }),

    skipVoteCount: voteSummary.skipVoteCount,
    submittedVoteCount: voteSummary.submittedVoteCount,
    eligibleVoteCount: voteSummary.eligibleVoteCount,

    hasVictim: Boolean(room.hasVictim),
    lastVictimIndex: Number(room.lastVictimIndex ?? -1),
    lastVictimName: room.lastVictimName || "",

    hasDayResult: Boolean(room.hasDayResult),
    hasVotedOut: Boolean(room.hasVotedOut),
    lastVotedOutIndex: Number(room.lastVotedOutIndex ?? -1),
    lastVotedOutName: room.lastVotedOutName || "",

    hasNightResult: Boolean(room.hasNightResult),
    eventIndicatorsMessage: getActivePublicEffectReminders(room).join("\n"),

    winner: Number(room.winner || WINNER.NONE),
    winnerNames: getWinnerNames(room),
    gameOverMessage: room.gameOverMessage || ""
  };
}

function buildPrivateState(room, player, votingAllowed, voteSummary) {
  const actions = getResolvedActionsForPlayer(room, player);
  const vote = room.votes[player.id] || null;
  const target = vote?.targetId ? room.players.find(candidate => candidate.id === vote.targetId) : null;
  const effectsMessage = getEffectMessages(player).join("\n");

  return {
    playerId: player.id,
    playerIndex: player.index,
    playerName: player.name,
    isHost: player.id === room.hostPlayerId,
    isAlive: Boolean(player.isAlive),

    roleId: player.roleId,
    roleName: player.roleName,
    roleMessage: player.roleMessage,
    alignment: player.alignment,
    isImpostor: player.alignment === ALIGNMENT.IMPOSTOR,

    energy: player.energy,
    maxEnergy: player.maxEnergy,

    actions,
    hasSubmittedNightAction: Boolean(room.nightActions?.[player.id]),
    action1Label: actions.action1?.label || "",
    action2Label: actions.action2?.label || "",
    action1Description: actions.action1?.description || "",
    action2Description: actions.action2?.description || "",

    canStartGame: room.phase === PHASE.LOBBY && player.id === room.hostPlayerId && room.players.length >= CONFIG.room.minPlayersToStart,
    canChooseVictim: false,

    canVote: votingAllowed && player.isAlive,
    hasVoted: Boolean(vote),
    votedTargetIndex: target?.index ?? -1,
    votedTargetName: target?.name || "",
    votedSkip: vote?.type === "skip",

    hasSelectedVictim: false,
    selectedVictimIndex: -1,
    selectedVictimName: "",

    privateMessage: messages.buildPrivateMessage({ player, room, votingAllowed, playerVote: vote }),

    playerEffectsMessage: effectsMessage,
    effectLabels: getEffectLabels(player).join(", "),
    hasParanoia: hasEffect(player, EFFECT_KEY.PARANOIA),
    isHaunted: hasEffect(player, EFFECT_KEY.HAUNTED),

    neutralTargetRoleName: player.neutralTargetRoleName || "",

    playtestSettings: player.id === room.hostPlayerId && room.phase === PHASE.LOBBY
      ? buildHostSettingsPayload(room)
      : null
  };
}

function getWinnerNames(room) {
  if (!room || !room.winner || room.winner === WINNER.NONE) return [];

  const names = new Set();

  if (room.winner === WINNER.INNOCENTS) {
    for (const player of room.players || []) {
      if (player.alignment === ALIGNMENT.INNOCENT) names.add(player.name);
    }
  }

  if (room.winner === WINNER.IMPOSTORS) {
    for (const player of room.players || []) {
      if (player.alignment === ALIGNMENT.IMPOSTOR) names.add(player.name);
    }
  }

  if (room.winner === WINNER.NEUTRAL) {
    for (const player of room.players || []) {
      if (player.hasWonNeutral) names.add(player.name);
      if (player.id && player.id === room.neutralWinnerId) names.add(player.name);
      if (player.isAlive && (player.roleId === ROLE_KEY.POSSESSED || player.roleId === ROLE_KEY.CONDEMNED)) {
        names.add(player.name);
      }
    }
    if (room.neutralWinnerName) names.add(room.neutralWinnerName);
  }

  for (const name of room.alliedWinnerNames || []) names.add(name);

  return [...names].filter(Boolean);
}

function serializePublicPlayer(player) {
  return {
    id: player.id,
    index: player.index,
    name: player.name,
    isAlive: Boolean(player.isAlive),
    publicStatus: player.publicStatus || "normal",
    houseVariant: (player.index - 1) % 4,
    voteCount: 0,
    houseSlot: 0
  };
}

module.exports = {
  buildInitialPois,
  buildSnapshot,
  buildPublicState,
  buildPrivateState,
  serializePublicPlayer
};
