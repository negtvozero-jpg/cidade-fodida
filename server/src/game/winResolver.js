const { ALIGNMENT, WINNER, ROLE_KEY } = require("../constants");
const { getAlivePossessedLineage, promoteCondemnedIfNeeded } = require("./possessedLineage");

function evaluateWin(room) {
  promoteCondemnedIfNeeded(room);

  const alive = room.players.filter(player => player.isAlive);
  const aliveInnocents = alive.filter(player => player.alignment === ALIGNMENT.INNOCENT);
  const aliveImpostors = alive.filter(player => player.alignment === ALIGNMENT.IMPOSTOR);
  const aliveLineage = getAlivePossessedLineage(room);

  const neutralWinner = room.players.find(player => player.hasWonNeutral);
  if (neutralWinner) {
    room.winner = WINNER.NEUTRAL;
    room.neutralWinnerId = neutralWinner.id;
    room.neutralWinnerName = neutralWinner.name;
    markLawyerClientWinners(room, { neutralWinnerIds: new Set([neutralWinner.id]) });
    return room.winner;
  }

  if (aliveLineage.length >= 2 && alive.length <= 4 && aliveImpostors.length === 0) {
    room.winner = WINNER.NEUTRAL;
    room.neutralWinnerId = aliveLineage[0].id;
    room.neutralWinnerName = aliveLineage[0].name;
    markLawyerClientWinners(room, { neutralWinnerIds: new Set(aliveLineage.map(player => player.id)) });
    return room.winner;
  }

  if (aliveLineage.length >= 1 && alive.length <= 2) {
    room.winner = WINNER.NEUTRAL;
    room.neutralWinnerId = aliveLineage[0].id;
    room.neutralWinnerName = aliveLineage[0].name;
    markLawyerClientWinners(room, { neutralWinnerIds: new Set(aliveLineage.map(player => player.id)) });
    return room.winner;
  }

  if (aliveImpostors.length === 0 && aliveLineage.length === 0) {
    room.winner = WINNER.INNOCENTS;
    markLawyerClientWinners(room, { alignmentWinner: ALIGNMENT.INNOCENT });
    return room.winner;
  }

  if (aliveImpostors.length >= aliveInnocents.length && aliveInnocents.length > 0) {
    room.winner = WINNER.IMPOSTORS;
    markLawyerClientWinners(room, { alignmentWinner: ALIGNMENT.IMPOSTOR });
    return room.winner;
  }

  room.winner = WINNER.NONE;
  return room.winner;
}

function checkNeutralVoteWin(room, votedOutPlayer) {
  if (!votedOutPlayer) return;

  if (votedOutPlayer.roleId === ROLE_KEY.JOKER) {
    votedOutPlayer.hasWonNeutral = true;
    room.winner = WINNER.NEUTRAL;
    room.neutralWinnerId = votedOutPlayer.id;
    room.neutralWinnerName = votedOutPlayer.name;
    markLawyerClientWinners(room, { neutralWinnerIds: new Set([votedOutPlayer.id]) });
    return;
  }

  for (const player of room.players) {
    if (player.roleId === ROLE_KEY.INSTIGATOR && player.neutralTargetId === votedOutPlayer.id) {
      player.hasWonNeutral = true;
      room.winner = WINNER.NEUTRAL;
      room.neutralWinnerId = player.id;
      room.neutralWinnerName = player.name;
      markLawyerClientWinners(room, { neutralWinnerIds: new Set([player.id]) });
      return;
    }
  }
}

function markLawyerClientWinners(room, { alignmentWinner = null, neutralWinnerIds = new Set() } = {}) {
  const names = [];

  for (const player of room.players || []) {
    if (player.roleId !== ROLE_KEY.LAWYER || !player.neutralTargetId) continue;

    const client = room.players.find(candidate => candidate.id === player.neutralTargetId);
    if (!client) continue;

    const clientWonByAlignment = alignmentWinner !== null && client.alignment === alignmentWinner;
    const clientWonAsNeutral = neutralWinnerIds.has(client.id) || client.hasWonNeutral;

    if (!clientWonByAlignment && !clientWonAsNeutral) continue;

    player.hasWonWithClient = true;
    names.push(player.name);
  }

  room.alliedWinnerNames = [...new Set(names)];
}

module.exports = {
  evaluateWin,
  checkNeutralVoteWin
};
