const { VOTE_TYPE } = require("../constants");
const { killPlayer, killLinkedLawyers } = require("./actionResolver");

function submitVote(room, player, { targetId = "", voteSkip = false } = {}) {
  if (!room || !player || !player.isAlive) {
    return { ok: false, error: "INVALID_VOTER" };
  }

  if (voteSkip) {
    room.votes[player.id] = {
      voterId: player.id,
      type: VOTE_TYPE.SKIP,
      targetId: ""
    };
    return { ok: true };
  }

  const target = room.players.find(candidate => candidate.id === targetId && candidate.isAlive);

  if (!target || target.id === player.id) {
    return { ok: false, error: "INVALID_TARGET" };
  }

  room.votes[player.id] = {
    voterId: player.id,
    type: VOTE_TYPE.PLAYER,
    targetId: target.id
  };

  return { ok: true };
}

function clearVote(room, player) {
  if (!room || !player) return { ok: false, error: "INVALID_CONTEXT" };
  delete room.votes[player.id];
  return { ok: true };
}

function getVoteSummary(room) {
  const alive = room.players.filter(player => player.isAlive);
  const votes = Object.values(room.votes || {}).filter(vote => alive.some(player => player.id === vote.voterId));
  const counts = {};
  let skipVoteCount = 0;

  for (const vote of votes) {
    if (vote.type === VOTE_TYPE.SKIP) {
      skipVoteCount++;
      continue;
    }

    counts[vote.targetId] = (counts[vote.targetId] || 0) + 1;
  }

  return {
    eligibleVoteCount: alive.length,
    submittedVoteCount: votes.length,
    skipVoteCount,
    counts
  };
}

function resolveDayVote(room) {
  const summary = getVoteSummary(room);
  const alive = room.players.filter(player => player.isAlive);
  const counts = { ...summary.counts };
  const skipCount = summary.skipVoteCount + Math.max(0, summary.eligibleVoteCount - summary.submittedVoteCount);

  let topTargetId = "";
  let topCount = skipCount;
  let tied = false;

  for (const [targetId, count] of Object.entries(counts)) {
    if (count > topCount) {
      topTargetId = targetId;
      topCount = count;
      tied = false;
    } else if (count === topCount) {
      tied = true;
    }
  }

  room.lastVoteCounts = counts;
  room.lastSkipVoteCount = skipCount;
  room.lastSubmittedVoteCount = summary.submittedVoteCount;
  room.lastEligibleVoteCount = summary.eligibleVoteCount;
  room.hasDayResult = true;
  room.hasVotedOut = false;
  room.lastVotedOutIndex = -1;
  room.lastVotedOutName = "";

  if (!topTargetId || tied) {
    room.votes = {};
    return null;
  }

  const target = alive.find(player => player.id === topTargetId);
  if (!target) {
    room.votes = {};
    return null;
  }

  killPlayer(room, target, { cause: "votedOut", scenePlayerId: target.id });
  const linkedLawyers = killLinkedLawyers(room, target, [], { source: "votedOut" });

  room.hasVotedOut = true;
  room.lastVotedOutIndex = target.index;
  room.lastVotedOutName = [target, ...linkedLawyers].map(player => player.name).join(", ");

  room.votes = {};
  return target;
}

function allAlivePlayersVoted(room) {
  const summary = getVoteSummary(room);
  return summary.eligibleVoteCount > 0 && summary.submittedVoteCount >= summary.eligibleVoteCount;
}

module.exports = {
  submitVote,
  clearVote,
  getVoteSummary,
  resolveDayVote,
  allAlivePlayersVoted
};
