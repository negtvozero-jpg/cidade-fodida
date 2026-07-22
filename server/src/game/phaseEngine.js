const CONFIG = require("../config");
const { PHASE, WINNER } = require("../constants");
const { resolveNight } = require("./actionResolver");
const { resolveDayVote } = require("./voteResolver");
const { evaluateWin, checkNeutralVoteWin } = require("./winResolver");
const messages = require("../messages");
const { getPhaseDurationOverride, ensurePlaytestSettings } = require("./playtestSettings");

function startPhase(room, phase, io, broadcastSnapshot) {
  room.phase = phase;
  room.phaseTotalSeconds = getPhaseDuration(room, phase);
  room.phaseEndsAt = room.phaseTotalSeconds > 0
    ? Date.now() + room.phaseTotalSeconds * 1000
    : 0;

  if (phase === PHASE.NIGHT) {
    prepareNight(room);
  }

  if (phase === PHASE.DAY) {
    prepareDay(room);
  }

  if (phase === PHASE.GAME_OVER) {
    room.gameOverMessage = messages.buildGameOverMessage(room.winner, room);
  }

  resetPhaseTimer(room, io, broadcastSnapshot);
  broadcastSnapshot(room);
}

function resetPhaseTimer(room, io, broadcastSnapshot) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  if (room.phaseTotalSeconds <= 0) return;

  room.timerInterval = setInterval(() => {
    const remaining = getPhaseTimeRemaining(room);

    if (remaining <= 0) {
      advancePhase(room, io, broadcastSnapshot);
      return;
    }

    broadcastSnapshot(room);
  }, 1000);
}

function advancePhase(room, io, broadcastSnapshot) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }

  if (room.phase === PHASE.DAY) {
    const votedOut = room.dayNumber > 1 ? resolveDayVote(room) : null;
    checkNeutralVoteWin(room, votedOut);
    if (evaluateWin(room) !== WINNER.NONE) {
      startPhase(room, PHASE.GAME_OVER, io, broadcastSnapshot);
      return;
    }
    startPhase(room, PHASE.DAY_RESULT, io, broadcastSnapshot);
    return;
  }

  if (room.phase === PHASE.DAY_RESULT) {
    startPhase(room, PHASE.NIGHT, io, broadcastSnapshot);
    return;
  }

  if (room.phase === PHASE.NIGHT) {
    resolveNight(room);
    if (evaluateWin(room) !== WINNER.NONE) {
      startPhase(room, PHASE.GAME_OVER, io, broadcastSnapshot);
      return;
    }
    startPhase(room, PHASE.NIGHT_RESULT, io, broadcastSnapshot);
    return;
  }

  if (room.phase === PHASE.NIGHT_RESULT) {
    startPhase(room, PHASE.DAY, io, broadcastSnapshot);
    return;
  }
}

function maybeEndNightEarly(room, io, broadcastSnapshot) {
  if (room.phase !== PHASE.NIGHT) return;
  const alive = room.players.filter(player => player.isAlive);
  const submitted = alive.filter(player => room.nightActions[player.id]).length;

  if (alive.length > 0 && submitted >= alive.length) {
    advancePhase(room, io, broadcastSnapshot);
  }
}

function getPhaseDuration(room, phase) {
  ensurePlaytestSettings(room);
  if (phase === PHASE.DAY) {
    return room.dayNumber <= 1
      ? getPhaseDurationOverride(room, "firstDaySeconds", CONFIG.phase.firstDaySeconds)
      : getPhaseDurationOverride(room, "daySeconds", CONFIG.phase.daySeconds);
  }
  if (phase === PHASE.NIGHT) return getPhaseDurationOverride(room, "nightSeconds", CONFIG.phase.nightSeconds);
  if (phase === PHASE.DAY_RESULT) return getPhaseDurationOverride(room, "resultSeconds", CONFIG.phase.dayResultSeconds);
  if (phase === PHASE.NIGHT_RESULT) return getPhaseDurationOverride(room, "resultSeconds", CONFIG.phase.nightResultSeconds);
  return 0;
}

function getPhaseTimeRemaining(room) {
  if (!room.phaseEndsAt) return 0;
  return Math.max(0, Math.ceil((room.phaseEndsAt - Date.now()) / 1000));
}

function getPhaseProgress(room) {
  if (!room.phaseTotalSeconds) return 0;
  return Math.max(0, Math.min(100, (getPhaseTimeRemaining(room) / room.phaseTotalSeconds) * 100));
}

function isVotingAllowed(room) {
  const settings = ensurePlaytestSettings(room);
  const votingOpensAtProgress = Number(settings.votingOpensAtProgress || CONFIG.phase.votingOpensAtProgress);
  return room.phase === PHASE.DAY && room.dayNumber > 1 && getPhaseProgress(room) <= votingOpensAtProgress;
}

function prepareNight(room) {
  room.dayNumber += 1;
  room.nightActions = {};
  room.lastActionErrorByPlayerId = {};
  room.dayResultAnnouncements = [];

  for (const player of room.players) {
    if (player.isAlive) player.publicStatus = "normal";
  }
}

function prepareDay(room) {
  room.votes = {};
}

module.exports = {
  startPhase,
  advancePhase,
  maybeEndNightEarly,
  getPhaseTimeRemaining,
  getPhaseProgress,
  isVotingAllowed
};
