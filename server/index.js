const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const {
  PORT,
  FIRST_DAY_SECONDS,
  DAY_SECONDS,
  NIGHT_SECONDS,
  DAY_RESULT_SECONDS,
  NIGHT_RESULT_SECONDS,
  MAX_PLAYERS,
  MIN_PLAYERS_TO_START,
  PHASE,
  ALIGNMENT,
  ROLE,
  ROLE_KEY,
  WINNER,
  VOTE_TYPE,
  TARGET_TYPE,
  ACTION_COMMAND,
  ACTION_CLASS,
  MICROGAME_ID,
  MICROGAME_CONFIG,
  ACTION_DEFINITIONS,
  ROLE_DEFINITIONS,
  PLAYER_CONFIG,
  POI_CONFIG,
  ROLE_TEXT,
  CLUE_CONFIG
} = require("./src/constants");

const {
  sanitizeRoomCode,
  sanitizePlayerName
} = require("./src/sanitize");

const {
  resolveNightClues,
  compactPrivateCluesByPlayerId
} = require("./src/clueGenerator");

const messages = require("./src/messages");

const buildPublicMessage = messages.buildPublicMessage;
const buildPrivateMessage = messages.buildPrivateMessage;
const buildGameOverMessage =
  typeof messages.buildGameOverMessage === "function"
    ? messages.buildGameOverMessage
    : fallbackBuildGameOverMessage;

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

const rooms = new Map();

app.use(express.static(path.join(__dirname, "../client")));

io.on("connection", socket => {
  console.log("[SOCKET] conectado:", socket.id);

  socket.on("room:create", (payload, callback) => {
    const roomCode = createRoomCode();
    const playerName = resolvePlayerName({
      room: null,
      rawName: payload?.playerName,
      fallbackIndex: 1
    });

    const player = createPlayer({
      socketId: socket.id,
      index: 1,
      name: playerName,
      isHost: true
    });

    const room = {
      roomCode,
      hostPlayerId: player.id,

      phase: PHASE.LOBBY,
      dayNumber: 0,

      phaseEndsAt: 0,
      phaseTotalSeconds: 0,
      timerInterval: null,

      votes: {},
      nightActions: {},
      lastActionErrorByPlayerId: {},

      publicClues: [],
      privateCluesByPlayerId: {},
      lastNightPublicClues: [],
      lastNightPrivateCluesByPlayerId: {},
      publishedPublicClues: [],
      lastPublishedPublicClues: [],
      journalistPublicClues: [],
      rawClues: [],

      skipVoteCount: 0,
      submittedVoteCount: 0,
      eligibleVoteCount: 0,

      hasDayResult: false,
      hasVotedOut: false,
      lastVotedOutIndex: -1,
      lastVotedOutName: "",

      lastVoteCounts: {},
      lastSkipVoteCount: 0,
      lastSubmittedVoteCount: 0,
      lastEligibleVoteCount: 0,

      hasNightResult: false,

      hasVictim: false,
      lastVictimIndex: -1,
      lastVictimName: "",

      pendingVictimId: "",
      pendingVictimIndex: -1,
      pendingVictimName: "",

      winner: WINNER.NONE,
      gameOverMessage: "",
      neutralWinnerId: "",
      neutralWinnerName: "",
      neutralWinnerRoleName: "",

      players: [player]
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);

    callback?.({
      ok: true,
      roomCode,
      playerId: player.id
    });

    emitRoomSnapshot(roomCode);
  });

  socket.on("room:join", (payload, callback) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);

    const room = rooms.get(roomCode);

    if (!room) {
      callback?.({ ok: false, error: "ROOM_NOT_FOUND" });
      return;
    }

    if (room.phase !== PHASE.LOBBY) {
      callback?.({ ok: false, error: "GAME_ALREADY_STARTED" });
      return;
    }

    if (room.players.length >= MAX_PLAYERS) {
      callback?.({ ok: false, error: "ROOM_FULL" });
      return;
    }

    const nextIndex = room.players.length + 1;
    const playerName = resolvePlayerName({
      room,
      rawName: payload?.playerName,
      fallbackIndex: nextIndex
    });

    const player = createPlayer({
      socketId: socket.id,
      index: nextIndex,
      name: playerName,
      isHost: false
    });

    room.players.push(player);
    socket.join(roomCode);

    callback?.({
      ok: true,
      roomCode,
      playerId: player.id
    });

    emitRoomSnapshot(roomCode);
  });

  socket.on("game:start", (payload, callback) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const playerId = String(payload?.playerId || "");

    const room = rooms.get(roomCode);

    if (!room) {
      callback?.({ ok: false, error: "ROOM_NOT_FOUND" });
      return;
    }

    if (room.hostPlayerId !== playerId) {
      callback?.({ ok: false, error: "NOT_HOST" });
      return;
    }

    if (room.phase !== PHASE.LOBBY) {
      callback?.({ ok: false, error: "GAME_ALREADY_STARTED" });
      return;
    }

    if (room.players.length < MIN_PLAYERS_TO_START) {
      callback?.({ ok: false, error: "NOT_ENOUGH_PLAYERS" });
      return;
    }

    assignRoles(room);

    startDay(room, {
      hasVictim: false,
      victimIndex: -1,
      victimName: ""
    });

    callback?.({ ok: true });
  });

  socket.on("game:submitVictim", (_payload, callback) => {
    callback?.({
      ok: false,
      error: "DEPRECATED_FLOW_USE_ACTIVITY_RESULT"
    });
  });

  socket.on("game:submitVote", (payload, callback) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const playerId = String(payload?.playerId || "");
    const targetId = String(payload?.targetId || "");
    const voteSkip = Boolean(payload?.voteSkip);

    const room = rooms.get(roomCode);

    if (!room) {
      callback?.({ ok: false, error: "ROOM_NOT_FOUND" });
      return;
    }

    if (room.phase !== PHASE.DAY) {
      callback?.({ ok: false, error: "NOT_DAY" });
      return;
    }

    const voter = room.players.find(player => player.id === playerId);

    if (!voter) {
      callback?.({ ok: false, error: "PLAYER_NOT_FOUND" });
      return;
    }

    if (!voter.isAlive) {
      callback?.({ ok: false, error: "PLAYER_DEAD" });
      return;
    }

    if (voteSkip) {
      room.votes[voter.id] = {
        type: VOTE_TYPE.SKIP,
        targetId: ""
      };

      callback?.({ ok: true });

      if (isDayVotingComplete(room)) {
        finishDay(room);
        return;
      }

      emitRoomSnapshot(roomCode);
      return;
    }

    const target = room.players.find(player => player.id === targetId);

    if (!target) {
      callback?.({ ok: false, error: "TARGET_NOT_FOUND" });
      return;
    }

    if (!target.isAlive) {
      callback?.({ ok: false, error: "TARGET_DEAD" });
      return;
    }

    if (target.id === voter.id) {
      callback?.({ ok: false, error: "CANNOT_VOTE_SELF" });
      return;
    }

    room.votes[voter.id] = {
      type: VOTE_TYPE.PLAYER,
      targetId: target.id
    };

    callback?.({ ok: true });

    if (isDayVotingComplete(room)) {
      finishDay(room);
      return;
    }

    emitRoomSnapshot(roomCode);
  });

  socket.on("game:clearSelection", (payload, callback) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const playerId = String(payload?.playerId || "");
    const interactionMode = String(payload?.interactionMode || "");

    const room = rooms.get(roomCode);

    if (!room) {
      callback?.({ ok: false, error: "ROOM_NOT_FOUND" });
      return;
    }

    const actor = room.players.find(player => player.id === playerId);

    if (!actor) {
      callback?.({ ok: false, error: "PLAYER_NOT_FOUND" });
      return;
    }

    if (!actor.isAlive) {
      callback?.({ ok: false, error: "PLAYER_DEAD" });
      return;
    }

    if (interactionMode === "vote") {
      if (room.phase !== PHASE.DAY) {
        callback?.({ ok: false, error: "NOT_DAY" });
        return;
      }

      if (!isVotingAllowed(room)) {
        callback?.({ ok: false, error: "VOTING_DISABLED" });
        return;
      }

      delete room.votes[actor.id];

      callback?.({ ok: true });
      emitRoomSnapshot(roomCode);
      return;
    }

    if (interactionMode === "victim") {
      if (room.phase !== PHASE.NIGHT) {
        callback?.({ ok: false, error: "NOT_NIGHT" });
        return;
      }

      if (getPlayerAlignment(actor) !== ALIGNMENT.IMPOSTOR) {
        callback?.({ ok: false, error: "NOT_IMPOSTOR" });
        return;
      }

      room.pendingVictimId = "";
      room.pendingVictimIndex = -1;
      room.pendingVictimName = "";

      callback?.({ ok: true });
      emitRoomSnapshot(roomCode);
      return;
    }

    callback?.({ ok: false, error: "INVALID_INTERACTION_MODE" });
  });


  socket.on("game:submitActivityResult", (payload, callback) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const playerId = String(payload?.playerId || "");
    const actionCommand = String(payload?.actionCommand || "");
    const resultCommand = String(payload?.resultCommand || "");
    const skippedMicrogame = Boolean(payload?.skippedMicrogame);

    const room = rooms.get(roomCode);

    if (!room) {
      callback?.({ ok: false, error: "ROOM_NOT_FOUND" });
      return;
    }

    if (room.phase !== PHASE.NIGHT) {
      callback?.({ ok: false, error: "NOT_NIGHT" });
      return;
    }

    const actor = room.players.find(player => player.id === playerId);

    if (!actor) {
      callback?.({ ok: false, error: "PLAYER_NOT_FOUND" });
      return;
    }

    if (!actor.isAlive) {
      callback?.({ ok: false, error: "PLAYER_DEAD" });
      return;
    }

    if (room.nightActions[actor.id]) {
      callback?.({ ok: false, error: "ACTION_ALREADY_SUBMITTED" });
      return;
    }

    if (![ACTION_COMMAND.ACTION_1, ACTION_COMMAND.ACTION_2, ACTION_COMMAND.SLEEP].includes(actionCommand)) {
      callback?.({ ok: false, error: "INVALID_ACTION_COMMAND" });
      return;
    }

    if (![ACTION_COMMAND.PASS, ACTION_COMMAND.FAIL].includes(resultCommand)) {
      callback?.({ ok: false, error: "INVALID_RESULT_COMMAND" });
      return;
    }

    const roleKey = getRoleKey(actor);
    const definition = getActivityDefinition(roleKey, actionCommand);

    if (!definition) {
      callback?.({ ok: false, error: "ACTION_NOT_CONFIGURED" });
      return;
    }

    if (definition.implemented === false) {
      callback?.({ ok: false, error: "ACTION_NOT_IMPLEMENTED" });
      return;
    }

    const energyBefore = getPlayerEnergy(actor);
    const energyCost = Number(definition.energyCost || 0);
    const energyGain = Number(definition.energyGain || 0);

    if (energyCost > energyBefore) {
      room.lastActionErrorByPlayerId[actor.id] = "NOT_ENOUGH_ENERGY";
      callback?.({ ok: false, error: "NOT_ENOUGH_ENERGY" });
      emitRoomSnapshot(roomCode);
      return;
    }

    delete room.lastActionErrorByPlayerId[actor.id];

    const targetType = definition.targetType || TARGET_TYPE.NONE;
    const targetPlayerId = String(payload?.targetPlayerId || "");
    const targetPlayerIndex = Number(payload?.targetPlayerIndex ?? -1);
    const targetPoiIndex = Number(payload?.targetPoiIndex ?? -1);
    const targetPoiCode = String(payload?.targetPoiCode || "");
    const targetPoiType = String(payload?.targetPoiType || "");

    let targetPlayer = null;
    let targetPoi = null;

    if (targetType === TARGET_TYPE.PLAYER || targetType === TARGET_TYPE.REGION) {
      targetPlayer =
        room.players.find(player => player.id === targetPlayerId) ||
        room.players.find(player => player.index === targetPlayerIndex) ||
        null;
    }

    if (targetType === TARGET_TYPE.POI || targetType === TARGET_TYPE.REGION) {
      targetPoi = getPoiDefinition(targetPoiCode, targetPoiIndex);
    }

    if (definition.id === "plantEvidence") {
      targetPlayer = getInstigatorAssignedTarget(room, actor);

      if (!targetPlayer) {
        callback?.({ ok: false, error: "INSTIGATOR_TARGET_NOT_FOUND" });
        return;
      }

      if (!targetPlayer.isAlive) {
        callback?.({ ok: false, error: "INSTIGATOR_TARGET_DEAD" });
        return;
      }
    }

    if (targetType === TARGET_TYPE.PLAYER) {
      if (!targetPlayer) {
        callback?.({ ok: false, error: "TARGET_PLAYER_NOT_FOUND" });
        return;
      }

      if (!targetPlayer.isAlive) {
        callback?.({ ok: false, error: "TARGET_PLAYER_DEAD" });
        return;
      }

      if (targetPlayer.id === actor.id && definition.allowSelfTarget !== true) {
        callback?.({ ok: false, error: "CANNOT_TARGET_SELF" });
        return;
      }
    }

    if (targetType === TARGET_TYPE.POI) {
      if (!targetPoi) {
        callback?.({ ok: false, error: "TARGET_POI_NOT_FOUND" });
        return;
      }
    }

    if (targetType === TARGET_TYPE.REGION) {
      if (!targetPlayer && !targetPoi) {
        callback?.({ ok: false, error: "TARGET_REGION_NOT_FOUND" });
        return;
      }

      if (targetPlayer && !targetPlayer.isAlive) {
        callback?.({ ok: false, error: "TARGET_PLAYER_DEAD" });
        return;
      }
    }

    const success =
      resultCommand === ACTION_COMMAND.PASS ||
      skippedMicrogame === true ||
      actionCommand === ACTION_COMMAND.SLEEP;

    const energyAfter = clamp(
      energyBefore - energyCost + energyGain,
      PLAYER_CONFIG.minEnergy,
      actor.maxEnergy || PLAYER_CONFIG.maxEnergy
    );

    actor.energy = energyAfter;

    const microgameScore = getMicrogameScoreFromResult({
      resultCommand,
      skippedMicrogame
    });

    const action = {
      actorId: actor.id,
      actorIndex: actor.index,
      actorName: actor.name,
      roleKey,
      alignment: getPlayerAlignment(actor),

      actionId: definition.id || actionCommand,
      actionCommand,
      actionClass: definition.actionClass,
      actionIntent: definition.intent || "neutral",
      actionLabel: definition.label || actionCommand,

      targetType,

      targetPlayerId: targetPlayer ? targetPlayer.id : "",
      targetPlayerIndex: targetPlayer ? targetPlayer.index : -1,
      targetPlayerName: targetPlayer ? targetPlayer.name : "",

      targetPoiIndex: targetPoi ? targetPoi.index : -1,
      targetPoiCode: targetPoi ? targetPoi.code : "",
      targetPoiType: targetPoi ? targetPoi.poiType : "none",
      targetPoiName: targetPoi ? targetPoi.displayName || targetPoi.visibleName : "",

      microgameCategory: definition.microgameCategory || "none",
      microgameId: String(payload?.microgameId || "none"),
      microgameSeed: Number(payload?.microgameSeed ?? 0),
      microgameTimeLimit: Number(payload?.microgameTimeLimit ?? 0),
      microgameDifficulty: Number(payload?.microgameDifficulty ?? 0),
      microgameScore,

      resultCommand,
      skippedMicrogame,
      success,

      energyCost,
      energyGain,
      energyBefore,
      energyAfter,

      submittedAt: Date.now()
    };

    room.nightActions[actor.id] = action;

    if (action.actionId === "plantEvidence" && targetPlayer) {
      actor.neutralTargetId = actor.neutralTargetId || targetPlayer.id;
      actor.neutralTargetIndex = actor.neutralTargetIndex || targetPlayer.index;
      actor.neutralTargetName = actor.neutralTargetName || targetPlayer.name;
    }

    const isKillAction =
      getPlayerAlignment(actor) === ALIGNMENT.IMPOSTOR &&
      targetType === TARGET_TYPE.PLAYER &&
      action.actionId === "killPlayer";

    if (isKillAction) {
      if (success && targetPlayer) {
        room.pendingVictimId = targetPlayer.id;
        room.pendingVictimIndex = targetPlayer.index;
        room.pendingVictimName = targetPlayer.name;

        console.log("[GAME] assassinato confirmado:", actor.name, "->", targetPlayer.name);
      } else {
        room.pendingVictimId = "";
        room.pendingVictimIndex = -1;
        room.pendingVictimName = "";

        console.log("[GAME] assassinato falhou:", actor.name);
      }
    }

    if (actionCommand === ACTION_COMMAND.SLEEP) {
      if (getPlayerAlignment(actor) === ALIGNMENT.IMPOSTOR) {
        room.pendingVictimId = "";
        room.pendingVictimIndex = -1;
        room.pendingVictimName = "";
      }

      console.log("[GAME] jogador dormiu:", actor.name, `energia ${energyBefore}->${energyAfter}`);
    }

    if (!isKillAction && actionCommand !== ACTION_COMMAND.SLEEP) {
      console.log("[GAME] atividade registrada:", actor.name, action.actionId, resultCommand, `energia ${energyBefore}->${energyAfter}`);
    }

    callback?.({
      ok: true,
      success,
      resultCommand,
      energy: actor.energy,
      maxEnergy: actor.maxEnergy
    });

    emitRoomSnapshot(roomCode);
  });

  socket.on("game:submitNightCommand", (_payload, callback) => {
    callback?.({
      ok: false,
      error: "DEPRECATED_FLOW_USE_ACTIVITY_RESULT"
    });
  });

  socket.on("room:heartbeat", () => {
    // Mantém tráfego WebSocket.
  });

  socket.on("disconnect", () => {
    console.log("[SOCKET] desconectado:", socket.id);

    for (const [roomCode, room] of rooms.entries()) {
      const playerIndex = room.players.findIndex(
        player => player.socketId === socket.id
      );

      if (playerIndex === -1) {
        continue;
      }

      const removedPlayer = room.players[playerIndex];

      room.players.splice(playerIndex, 1);

      delete room.votes[removedPlayer.id];

      for (const voterId of Object.keys(room.votes)) {
        if (room.votes[voterId]?.targetId === removedPlayer.id) {
          delete room.votes[voterId];
        }
      }

      if (room.players.length === 0) {
        clearRoomTimer(room);
        rooms.delete(roomCode);
        continue;
      }

      if (room.hostPlayerId === removedPlayer.id) {
        room.hostPlayerId = room.players[0].id;
      }

      reindexPlayers(room);

      if (applyWinConditionIfNeeded(room)) {
        continue;
      }

      if (room.phase === PHASE.DAY && isDayVotingComplete(room)) {
        finishDay(room);
        continue;
      }

      emitRoomSnapshot(roomCode);
    }
  });
});

function fallbackBuildGameOverMessage(winner) {
  if (winner === WINNER.INNOCENTS) {
    return "amogus morreu";
  }

  if (winner === WINNER.IMPOSTORS) {
    return "Os impostores venceram.";
  }

  if (winner === WINNER.NEUTRAL) {
    return "Um neutro venceu.";
  }

  return "Fim de jogo.";
}

function assignRoles(room) {
  const playerCount = room.players.length;
  const roleKeys = buildRolePoolForPlayerCount(playerCount);

  room.winner = WINNER.NONE;
  room.gameOverMessage = "";
  room.neutralWinnerId = "";
  room.neutralWinnerName = "";
  room.neutralWinnerRoleName = "";
  room.nightActions = {};
  room.lastActionErrorByPlayerId = {};
  resetRoomClues(room);

  const shuffledPlayers = shuffleArray(room.players);

  room.players.forEach(player => {
    applyRoleToPlayer(player, ROLE_KEY.RESIDENT);

    player.isAlive = true;
    player.publicStatus = 0;
    player.energy = PLAYER_CONFIG.initialEnergy;
    player.maxEnergy = PLAYER_CONFIG.maxEnergy;
    player.neutralTargetId = "";
    player.neutralTargetName = "";
    player.neutralTargetIndex = -1;
  });

  roleKeys.forEach((roleKey, index) => {
    const player = shuffledPlayers[index];

    if (!player) {
      return;
    }

    applyRoleToPlayer(player, roleKey);
  });

  assignInstigatorTargets(room);

  console.log("[GAME] papéis:", room.players.map(player => {
    const target = player.neutralTargetName ? `->${player.neutralTargetName}` : "";
    return `${player.name}:${player.roleKey}${target}`;
  }).join(", "));
}

function buildRolePoolForPlayerCount(playerCount) {
  const roles = [];

  // Sempre há um impostor. O espreitador substitui o antigo "assassino".
  roles.push(ROLE_KEY.STALKER);

  // O unicórnio entra cedo como proteção básica contra mortes.
  if (playerCount >= 4) {
    roles.push(ROLE_KEY.UNICORN);
  }

  // Com 5 jogadores entra jornalista OU detetive, não os dois.
  if (playerCount === 5) {
    roles.push(Math.random() < 0.5 ? ROLE_KEY.JOURNALIST : ROLE_KEY.DETECTIVE);
  }

  // A partir de 6, jornalista e detetive coexistem.
  if (playerCount >= 6) {
    roles.push(ROLE_KEY.JOURNALIST);
    roles.push(ROLE_KEY.DETECTIVE);
  }

  // Neutros só aparecem a partir de 6 jogadores.
  if (playerCount >= 6) {
    roles.push(Math.random() < 0.5 ? ROLE_KEY.JOKER : ROLE_KEY.INSTIGATOR);
  }

  // Garante que papéis especiais não excedam a quantidade de jogadores.
  return roles.slice(0, Math.max(0, playerCount));
}

function assignInstigatorTargets(room) {
  const instigators = room.players.filter(player => player.roleKey === ROLE_KEY.INSTIGATOR);

  for (const instigator of instigators) {
    const eligibleTargets = room.players.filter(player => {
      return player.id !== instigator.id && player.isAlive !== false;
    });

    const shuffledTargets = shuffleArray(eligibleTargets);
    const target = shuffledTargets[0] || null;

    instigator.neutralTargetId = target ? target.id : "";
    instigator.neutralTargetIndex = target ? target.index : -1;
    instigator.neutralTargetName = target ? target.name : "";
  }
}

function getInstigatorAssignedTarget(room, actor) {
  if (!room || !actor || actor.roleKey !== ROLE_KEY.INSTIGATOR) {
    return null;
  }

  return room.players.find(player => player.id === actor.neutralTargetId) || null;
}

function shuffleArray(values) {
  const result = [...values];

  for (let index = result.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = result[index];
    result[index] = result[swapIndex];
    result[swapIndex] = temp;
  }

  return result;
}

function applyRoleToPlayer(player, roleKey) {
  const roleDefinition =
    ROLE_DEFINITIONS[roleKey] ||
    ROLE_DEFINITIONS[ROLE_KEY.RESIDENT];

  player.roleKey = roleDefinition.id;
  player.alignment = roleDefinition.alignment;
  player.roleId = roleDefinition.alignment; // legado: roleId agora guarda alinhamento
  player.roleName = roleDefinition.name;
  player.isImpostor = roleDefinition.alignment === ALIGNMENT.IMPOSTOR;

  if (roleDefinition.alignment !== ALIGNMENT.NEUTRAL) {
    player.neutralTargetId = "";
    player.neutralTargetName = "";
    player.neutralTargetIndex = -1;
  }
}

function startDay(room, victimResult) {
  room.phase = PHASE.DAY;
  room.dayNumber += 1;

  room.votes = {};
  room.nightActions = {};
  room.lastActionErrorByPlayerId = {};

  room.skipVoteCount = 0;
  room.submittedVoteCount = 0;
  room.eligibleVoteCount = getEligibleVoteCount(room);

  room.hasDayResult = false;
  room.hasVotedOut = false;
  room.lastVotedOutIndex = -1;
  room.lastVotedOutName = "";

  room.lastVoteCounts = {};
  room.lastSkipVoteCount = 0;
  room.lastSubmittedVoteCount = 0;
  room.lastEligibleVoteCount = 0;

  room.hasNightResult = false;

  room.pendingVictimId = "";
  room.pendingVictimIndex = -1;
  room.pendingVictimName = "";

  room.hasVictim = Boolean(victimResult?.hasVictim);
  room.lastVictimIndex = Number(victimResult?.victimIndex ?? -1);
  room.lastVictimName = victimResult?.victimName || "";

  const totalSeconds =
    room.dayNumber === 1 ? FIRST_DAY_SECONDS : DAY_SECONDS;

  startPhaseTimer(room, totalSeconds);

  emitRoomSnapshot(room.roomCode);
}

function finishDay(room) {
  if (room.phase !== PHASE.DAY) {
    return;
  }

  if (!isVotingAllowed(room)) {
    startDayResult(room, {
      hasVotedOut: false,
      votedOutIndex: -1,
      votedOutName: ""
    });

    return;
  }

  const result = resolveDayVotes(room);
  startDayResult(room, result);
}

function startDayResult(room, voteResult) {
  room.phase = PHASE.DAY_RESULT;

  room.hasDayResult = true;
  room.hasVotedOut = Boolean(voteResult?.hasVotedOut);
  room.lastVotedOutIndex = Number(voteResult?.votedOutIndex ?? -1);
  room.lastVotedOutName = voteResult?.votedOutName || "";

  startPhaseTimer(room, DAY_RESULT_SECONDS);
  emitRoomSnapshot(room.roomCode);
}

function startNight(room) {
  room.phase = PHASE.NIGHT;

  room.votes = {};
  room.nightActions = {};
  room.lastActionErrorByPlayerId = {};
  resetRoomClues(room);

  room.skipVoteCount = 0;
  room.submittedVoteCount = 0;
  room.eligibleVoteCount = 0;

  room.hasDayResult = false;
  room.hasVotedOut = false;
  room.lastVotedOutIndex = -1;
  room.lastVotedOutName = "";

  room.hasNightResult = false;

  room.hasVictim = false;
  room.lastVictimIndex = -1;
  room.lastVictimName = "";

  room.pendingVictimId = "";
  room.pendingVictimIndex = -1;
  room.pendingVictimName = "";

  startPhaseTimer(room, NIGHT_SECONDS);
  emitRoomSnapshot(room.roomCode);
}

function startNightResult(room, victimResult) {
  room.phase = PHASE.NIGHT_RESULT;

  room.hasNightResult = true;

  room.pendingVictimId = "";
  room.pendingVictimIndex = -1;
  room.pendingVictimName = "";

  room.hasVictim = Boolean(victimResult?.hasVictim);
  room.lastVictimIndex = Number(victimResult?.victimIndex ?? -1);
  room.lastVictimName = victimResult?.victimName || "";

  startPhaseTimer(room, NIGHT_RESULT_SECONDS);
  emitRoomSnapshot(room.roomCode);
}

function startGameOver(room, winner, message = "") {
  clearRoomTimer(room);

  room.phase = PHASE.GAME_OVER;
  room.phaseEndsAt = 0;
  room.phaseTotalSeconds = 0;

  room.winner = winner;
  room.gameOverMessage = message || buildGameOverMessage(winner);

  emitRoomSnapshot(room.roomCode);
}

function resolveNight(room) {
  const clueResult = resolveNightClues({
    room,
    seed: Date.now() + room.dayNumber * 1009
  });

  room.lastNightPublicClues = clueResult.publicClues;
  room.lastNightPrivateCluesByPlayerId = clueResult.privateCluesByPlayerId;

  // Pistas comuns permanecem privadas. Campos públicos ficam reservados
  // para habilidades específicas, como jornalista.
  room.publicClues = [];
  room.privateCluesByPlayerId = clueResult.privateCluesByPlayerId;
  room.rawClues = clueResult.rawClues;

  resolveSpecialNightActions(room);

  const victimResult = resolveNightDeaths(room);

  room.lastNightPrivateCluesByPlayerId = compactPrivateCluesByPlayerId(
    room.lastNightPrivateCluesByPlayerId
  );
  room.privateCluesByPlayerId = room.lastNightPrivateCluesByPlayerId;

  return victimResult;
}

function resolveSpecialNightActions(room) {
  const actions = Object.values(room.nightActions || {}).filter(Boolean);

  for (const action of actions) {
    if (!action.success) {
      continue;
    }

    if (action.actionClass === ACTION_CLASS.DETECT_REGION) {
      resolveDetectiveAction(room, action);
      continue;
    }

    if (action.actionClass === ACTION_CLASS.JOURNALIST_REPORT) {
      resolveJournalistAction(room, action);
      continue;
    }

    if (action.actionClass === ACTION_CLASS.PLANT_EVIDENCE) {
      resolvePlantedEvidenceAction(room, action);
      continue;
    }
  }
}

function resolveNightDeaths(room) {
  const attacks = getSuccessfulAttackActions(room);

  for (const attack of attacks) {
    const victim = resolveVictimForAttack(room, attack);

    if (!victim || !victim.isAlive) {
      continue;
    }

    if (isPlayerProtected(room, victim.id)) {
      appendPrivateClue(room, victim.id, "Um ataque contra você foi impedido durante a noite.");
      continue;
    }

    if (attack.actionId === "killPlayer" && !isPlayerHomeDuringNight(room, victim)) {
      appendPrivateClue(room, victim.id, "Alguém passou pela sua casa durante a noite.");
      continue;
    }

    victim.isAlive = false;
    victim.publicStatus = 1;

    return {
      hasVictim: true,
      victimIndex: victim.index,
      victimName: victim.name
    };
  }

  return {
    hasVictim: false,
    victimIndex: -1,
    victimName: ""
  };
}

function getSuccessfulAttackActions(room) {
  return Object.values(room.nightActions || {})
    .filter(action => {
      return Boolean(action?.success) &&
        (
          action.actionId === "killPlayer" ||
          action.actionId === "stalkPoi"
        );
    })
    .sort((a, b) => Number(a.submittedAt || 0) - Number(b.submittedAt || 0));
}

function resolveVictimForAttack(room, attack) {
  if (attack.actionId === "killPlayer") {
    return room.players.find(player => player.id === attack.targetPlayerId) || null;
  }

  if (attack.actionId === "stalkPoi") {
    return pickReturningPoiVictim(room, attack);
  }

  return null;
}

function pickReturningPoiVictim(room, attack) {
  const poiCode = String(attack.targetPoiCode || "");

  if (!poiCode) {
    return null;
  }

  const candidates = Object.values(room.nightActions || {})
    .filter(action => {
      if (!action || !action.success) {
        return false;
      }

      if (action.actorId === attack.actorId) {
        return false;
      }

      if (action.targetPoiCode !== poiCode) {
        return false;
      }

      return action.actionClass === ACTION_CLASS.VISIT_POI ||
        action.actionClass === ACTION_CLASS.JOURNALIST_REPORT ||
        action.actionClass === ACTION_CLASS.DETECT_REGION;
    })
    .map(action => room.players.find(player => player.id === action.actorId))
    .filter(player => player && player.isAlive);

  if (candidates.length <= 0) {
    return null;
  }

  const index = Math.floor(Math.random() * candidates.length);
  return candidates[index];
}

function isPlayerHomeDuringNight(room, player) {
  const action = room.nightActions?.[player.id];

  if (!action || !action.success) {
    return true;
  }

  return !doesActionLeaveHome(action);
}

function doesActionLeaveHome(action) {
  return action.actionClass === ACTION_CLASS.VISIT_POI ||
    action.actionClass === ACTION_CLASS.JOURNALIST_REPORT ||
    action.actionClass === ACTION_CLASS.DETECT_REGION;
}

function isPlayerProtected(room, playerId) {
  return Object.values(room.nightActions || {}).some(action => {
    return Boolean(action?.success) &&
      action.actionClass === ACTION_CLASS.PROTECT_PLAYER &&
      action.targetPlayerId === playerId;
  });
}

function resolveDetectiveAction(room, action) {
  const actor = room.players.find(player => player.id === action.actorId);

  if (!actor) {
    return;
  }

  const regionLabel = getActionRegionLabel(action);
  const details = getMovementDetailsForRegion(room, action, {
    includeActor: false
  });

  appendPrivateClue(
    room,
    actor.id,
    details
      ? `Você investigou ${regionLabel}: ${details}`
      : `Você investigou ${regionLabel}, mas não notou fora do ordinário.`
  );
}

function resolveJournalistAction(room, action) {
  const regionLabel = getActionRegionLabel(action);
  const details = getMovementDetailsForRegion(room, action, {
    includeActor: false
  });

  const data = buildClueTemplateData(room, action, {
    place: regionLabel,
    detail: details || "nada fora do ordinário foi percebido"
  });

  const text = renderClueTemplate("journalistPublished", data);

  if (!Array.isArray(room.lastPublishedPublicClues)) {
    room.lastPublishedPublicClues = [];
  }

  if (!Array.isArray(room.publishedPublicClues)) {
    room.publishedPublicClues = [];
  }

  if (text && !room.lastPublishedPublicClues.includes(text)) {
    room.lastPublishedPublicClues.push(text);
  }

  if (text && !room.publishedPublicClues.includes(text)) {
    room.publishedPublicClues.push(text);
  }
}

function resolvePlantedEvidenceAction(room, action) {
  const actor = room.players.find(player => player.id === action.actorId);
  const target = actor ? getInstigatorAssignedTarget(room, actor) : null;

  if (!actor || !target) {
    return;
  }

  action.targetPlayerId = target.id;
  action.targetPlayerIndex = target.index;
  action.targetPlayerName = target.name;

  const data = buildClueTemplateData(room, action, {
    player: target.name,
    targetPlayer: target.name,
    targetHome: getPlayerHomeLabel(target)
  });

  const plantedText = renderClueTemplate("plantedEvidence", data);
  const actorText = renderClueTemplate("plantedEvidenceActor", data);

  const observers = getAlivePlayers(room)
    .filter(player => player.id !== actor.id && player.id !== target.id);

  const selectedObservers = observers.slice(0, 2);

  for (const observer of selectedObservers) {
    appendPrivateClue(room, observer.id, plantedText);
  }

  appendPrivateClue(room, actor.id, actorText);
}


function renderClueTemplate(templateKey, data = {}) {
  const options = CLUE_CONFIG.templates?.[templateKey] || [""];
  const raw = options[Math.floor(Math.random() * options.length)] || "";

  return String(raw).replace(/\{([^}]+)\}/g, (_match, key) => {
    const normalizedKey = String(key || "").trim();
    return String(data[normalizedKey] ?? "");
  }).trim();
}

function buildClueTemplateData(room, action, extra = {}) {
  const actor = room.players.find(player => player.id === action.actorId) || null;
  const target = room.players.find(player => player.id === action.targetPlayerId) || null;
  const poi = getPoiDefinition(action.targetPoiCode, action.targetPoiIndex);
  const crimeContext = getCrimeSceneContext(room, action);
  const regionLabel = getActionRegionLabel(action);
  const adjacentRoad = crimeContext.adjacentCrimeSceneRoad || getFirstRelevantRoadName({ room, action, target, poi });

  return {
    place: regionLabel,
    detail: "",

    player: target?.name || action.targetPlayerName || "alguém",
    targetPlayer: target?.name || action.targetPlayerName || "alguém",
    actor: actor?.name || action.actorName || "alguém",

    crimeScene: crimeContext.crimeScene || regionLabel,
    adjacentCrimeSceneRoad: adjacentRoad,
    impostorPath: crimeContext.impostorPath || adjacentRoad,
    impostorPathPartial: crimeContext.impostorPathPartial || adjacentRoad,

    targetHome: target ? getPlayerHomeLabel(target) : "uma casa próxima",
    poi: poi?.displayName || poi?.visibleName || action.targetPoiName || "um ponto de interesse",
    road: adjacentRoad,

    ...extra
  };
}

function getCrimeSceneContext(room, currentAction) {
  const attacks = Object.values(room.nightActions || {})
    .filter(action => {
      return action &&
        action.success &&
        action.actorId !== currentAction.actorId &&
        (action.actionId === "killPlayer" || action.actionId === "stalkPoi");
    });

  const attack = attacks[0] || null;

  if (!attack) {
    const target = room.players.find(player => player.id === currentAction.targetPlayerId) || null;
    const road = target ? getFirstPlayerHomeRoadName(target) : "uma rua próxima";

    return {
      crimeScene: target ? getPlayerHomeLabel(target) : getActionRegionLabel(currentAction),
      adjacentCrimeSceneRoad: road,
      impostorPath: road,
      impostorPathPartial: road
    };
  }

  if (attack.actionId === "stalkPoi") {
    const poi = getPoiDefinition(attack.targetPoiCode, attack.targetPoiIndex);
    const road = getFirstPoiRoadName(poi);

    return {
      crimeScene: poi?.displayName || poi?.visibleName || attack.targetPoiName || "um ponto de interesse",
      adjacentCrimeSceneRoad: road,
      impostorPath: road,
      impostorPathPartial: road
    };
  }

  const target = room.players.find(player => player.id === attack.targetPlayerId) || null;
  const road = target ? getFirstPlayerHomeRoadName(target) : "uma rua próxima";

  return {
    crimeScene: target ? getPlayerHomeLabel(target) : "a área do crime",
    adjacentCrimeSceneRoad: road,
    impostorPath: road,
    impostorPathPartial: road
  };
}

function getFirstRelevantRoadName({ target, poi }) {
  if (target) {
    return getFirstPlayerHomeRoadName(target);
  }

  if (poi) {
    return getFirstPoiRoadName(poi);
  }

  return "uma rua próxima";
}

function getPlayerHomeLabel(player) {
  return `a região da casa de ${player.name}`;
}

function getFirstPlayerHomeRoadName(player) {
  const roadCode = getPlayerHomeRoads(player)[0] || "";
  return getRoadName(roadCode) || "uma rua próxima";
}

function getFirstPoiRoadName(poi) {
  const roadCode = Array.isArray(poi?.nearRoads) ? poi.nearRoads[0] : "";
  return getRoadName(roadCode) || "uma rua próxima";
}

function getRoadName(roadCode) {
  return CLUE_CONFIG.roads?.[roadCode]?.visibleName || "";
}

function getMovementDetailsForRegion(room, regionAction, options = {}) {
  const includeActor = Boolean(options.includeActor);
  const related = [];

  for (const action of Object.values(room.nightActions || {})) {
    if (!action || !action.success) {
      continue;
    }

    if (!includeActor && action.actorId === regionAction.actorId) {
      continue;
    }

    if (isActionRelatedToRegion(room, action, regionAction)) {
      related.push(action.actorName || "alguém");
    }
  }

  const uniqueNames = [...new Set(related)];

  if (uniqueNames.length <= 0) {
    return "";
  }

  if (uniqueNames.length === 1) {
    return `${uniqueNames[0]} foi visto naquela região.`;
  }

  return `${uniqueNames.join(", ")} foram vistos naquela região.`;
}

function isActionRelatedToRegion(room, action, regionAction) {
  if (regionAction.targetPoiCode) {
    return action.targetPoiCode === regionAction.targetPoiCode;
  }

  if (regionAction.targetPlayerId) {
    if (action.targetPlayerId === regionAction.targetPlayerId) {
      return true;
    }

    const target = room.players.find(player => player.id === regionAction.targetPlayerId);
    const actor = room.players.find(player => player.id === action.actorId);

    if (!target || !actor) {
      return false;
    }

    const targetRoads = getPlayerHomeRoads(target);
    const actorRoads = getPlayerHomeRoads(actor);

    return actorRoads.some(road => targetRoads.includes(road));
  }

  return false;
}

function getPlayerHomeRoads(player) {
  const slot = CLUE_CONFIG.playerSlots?.[`p${Number(player.index || 1)}`] || {};
  return Array.isArray(slot.homeRoads) ? slot.homeRoads : [];
}

function getActionRegionLabel(action) {
  if (action.targetPoiName) {
    return action.targetPoiName;
  }

  if (action.targetPlayerName) {
    return `a região da casa de ${action.targetPlayerName}`;
  }

  return "a região escolhida";
}

function appendPrivateClue(room, playerId, text) {
  const clueText = String(text || "").trim();

  if (!playerId || !clueText) {
    return;
  }

  if (!room.lastNightPrivateCluesByPlayerId) {
    room.lastNightPrivateCluesByPlayerId = {};
  }

  if (!room.privateCluesByPlayerId) {
    room.privateCluesByPlayerId = {};
  }

  if (!Array.isArray(room.lastNightPrivateCluesByPlayerId[playerId])) {
    room.lastNightPrivateCluesByPlayerId[playerId] = [];
  }

  if (!Array.isArray(room.privateCluesByPlayerId[playerId])) {
    room.privateCluesByPlayerId[playerId] = [];
  }

  if (!room.lastNightPrivateCluesByPlayerId[playerId].includes(clueText)) {
    room.lastNightPrivateCluesByPlayerId[playerId].push(clueText);
  }

  if (!room.privateCluesByPlayerId[playerId].includes(clueText)) {
    room.privateCluesByPlayerId[playerId].push(clueText);
  }
}

function resolveDayVotes(room) {
  const summary = getVoteSummary(room, {
    includeMissingAsSkip: true,
    useLastResult: false
  });

  room.lastVoteCounts = summary.playerVoteCounts;
  room.lastSkipVoteCount = summary.skipVoteCount;
  room.lastSubmittedVoteCount = summary.submittedVoteCount;
  room.lastEligibleVoteCount = summary.eligibleVoteCount;

  room.skipVoteCount = summary.skipVoteCount;
  room.submittedVoteCount = summary.submittedVoteCount;
  room.eligibleVoteCount = summary.eligibleVoteCount;

  let highestCount = 0;
  const candidates = [];

  if (summary.skipVoteCount > highestCount) {
    highestCount = summary.skipVoteCount;
    candidates.length = 0;
    candidates.push({
      type: VOTE_TYPE.SKIP,
      targetId: ""
    });
  } else if (summary.skipVoteCount === highestCount && summary.skipVoteCount > 0) {
    candidates.push({
      type: VOTE_TYPE.SKIP,
      targetId: ""
    });
  }

  for (const player of room.players) {
    if (!player.isAlive) {
      continue;
    }

    const count = summary.playerVoteCounts[player.id] || 0;

    if (count > highestCount) {
      highestCount = count;
      candidates.length = 0;
      candidates.push({
        type: VOTE_TYPE.PLAYER,
        targetId: player.id
      });
    } else if (count === highestCount && count > 0) {
      candidates.push({
        type: VOTE_TYPE.PLAYER,
        targetId: player.id
      });
    }
  }

  if (highestCount <= 0 || candidates.length !== 1) {
    return {
      hasVotedOut: false,
      votedOutIndex: -1,
      votedOutName: ""
    };
  }

  const winner = candidates[0];

  if (winner.type === VOTE_TYPE.SKIP) {
    return {
      hasVotedOut: false,
      votedOutIndex: -1,
      votedOutName: ""
    };
  }

  const eliminated = room.players.find(player => player.id === winner.targetId);

  if (!eliminated || !eliminated.isAlive) {
    return {
      hasVotedOut: false,
      votedOutIndex: -1,
      votedOutName: ""
    };
  }

  eliminated.isAlive = false;
  eliminated.publicStatus = 2;

  const neutralWinner = getNeutralWinnerForVotedOut(room, eliminated);

  if (neutralWinner) {
    room.neutralWinnerId = neutralWinner.id;
    room.neutralWinnerName = neutralWinner.name;
    room.neutralWinnerRoleName = neutralWinner.roleName;
  }

  return {
    hasVotedOut: true,
    votedOutIndex: eliminated.index,
    votedOutName: eliminated.name,
    neutralWinnerId: neutralWinner ? neutralWinner.id : "",
    neutralWinnerName: neutralWinner ? neutralWinner.name : "",
    neutralWinnerRoleName: neutralWinner ? neutralWinner.roleName : ""
  };
}

function getNeutralWinnerForVotedOut(room, eliminated) {
  if (!eliminated) {
    return null;
  }

  if (eliminated.roleKey === ROLE_KEY.JOKER) {
    return eliminated;
  }

  const instigator = room.players.find(player => {
    return player.roleKey === ROLE_KEY.INSTIGATOR &&
      player.neutralTargetId === eliminated.id;
  });

  return instigator || null;
}

function startPhaseTimer(room, totalSeconds) {
  clearRoomTimer(room);

  room.phaseTotalSeconds = totalSeconds;
  room.phaseEndsAt = Date.now() + totalSeconds * 1000;

  room.timerInterval = setInterval(() => {
    const remaining = getPhaseTimeRemaining(room);

    emitRoomSnapshot(room.roomCode);

    if (remaining > 0) {
      return;
    }

    if (room.phase === PHASE.DAY) {
      finishDay(room);
      return;
    }

    if (room.phase === PHASE.DAY_RESULT) {
      if (applyWinConditionIfNeeded(room)) {
        return;
      }

      startNight(room);
      return;
    }

    if (room.phase === PHASE.NIGHT) {
      const victimResult = resolveNight(room);
      startNightResult(room, victimResult);
      return;
    }

    if (room.phase === PHASE.NIGHT_RESULT) {
      if (applyWinConditionIfNeeded(room)) {
        return;
      }

      startDay(room, {
        hasVictim: room.hasVictim,
        victimIndex: room.lastVictimIndex,
        victimName: room.lastVictimName
      });
    }
  }, 1000);
}

function clearRoomTimer(room) {
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
}

function getPhaseTimeRemaining(room) {
  if (!room.phaseEndsAt) {
    return 0;
  }

  return Math.max(0, Math.ceil((room.phaseEndsAt - Date.now()) / 1000));
}

function getAlivePlayers(room) {
  return room.players.filter(player => player.isAlive);
}

function isVotingAllowed(room) {
  if (room.phase !== PHASE.DAY) {
    return false;
  }

  if (room.dayNumber <= 1) {
    return false;
  }

  return getPhaseProgress(room) <= 50;
}

function getPhaseProgress(room) {
  const total = room.phaseTotalSeconds || 0;

  if (total <= 0) {
    return 0;
  }

  const remaining = getPhaseTimeRemaining(room);

  return Math.max(0, Math.min(100, Math.round((remaining / total) * 100)));
}

function getEligibleVoteCount(room) {
  if (!isVotingAllowed(room)) {
    return 0;
  }

  return getAlivePlayers(room).length;
}

function getSubmittedVoteCount(room) {
  const alivePlayerIds = new Set(getAlivePlayers(room).map(player => player.id));

  return Object.keys(room.votes).filter(voterId => {
    return alivePlayerIds.has(voterId);
  }).length;
}

function isDayVotingComplete(room) {
  if (!isVotingAllowed(room)) {
    return false;
  }

  const eligibleCount = getEligibleVoteCount(room);

  if (eligibleCount <= 0) {
    return false;
  }

  return getSubmittedVoteCount(room) >= eligibleCount;
}

function getVoteSummary(room, options = {}) {
  const includeMissingAsSkip = Boolean(options.includeMissingAsSkip);
  const useLastResult = Boolean(options.useLastResult);

  if (!useLastResult && !isVotingAllowed(room)) {
    return {
      playerVoteCounts: {},
      skipVoteCount: 0,
      submittedVoteCount: 0,
      eligibleVoteCount: 0
    };
  }

  if (useLastResult) {
    return {
      playerVoteCounts: room.lastVoteCounts || {},
      skipVoteCount: room.lastSkipVoteCount || 0,
      submittedVoteCount: room.lastSubmittedVoteCount || 0,
      eligibleVoteCount: room.lastEligibleVoteCount || 0
    };
  }

  const alivePlayers = getAlivePlayers(room);
  const alivePlayerIds = new Set(alivePlayers.map(player => player.id));

  const playerVoteCounts = {};
  let skipVoteCount = 0;
  let submittedVoteCount = 0;

  for (const player of alivePlayers) {
    playerVoteCounts[player.id] = 0;
  }

  for (const voter of alivePlayers) {
    const vote = room.votes[voter.id];

    if (!vote) {
      if (includeMissingAsSkip) {
        skipVoteCount += 1;
      }

      continue;
    }

    submittedVoteCount += 1;

    if (vote.type === VOTE_TYPE.SKIP) {
      skipVoteCount += 1;
      continue;
    }

    if (vote.type === VOTE_TYPE.PLAYER && alivePlayerIds.has(vote.targetId)) {
      playerVoteCounts[vote.targetId] = (playerVoteCounts[vote.targetId] || 0) + 1;
      continue;
    }

    if (includeMissingAsSkip) {
      skipVoteCount += 1;
    }
  }

  return {
    playerVoteCounts,
    skipVoteCount,
    submittedVoteCount,
    eligibleVoteCount: alivePlayers.length
  };
}

function getAliveAlignmentCounts(room) {
  const alivePlayers = getAlivePlayers(room);

  const aliveImpostors = alivePlayers.filter(player => {
    return getPlayerAlignment(player) === ALIGNMENT.IMPOSTOR;
  }).length;

  const aliveInnocents = alivePlayers.filter(player => {
    return getPlayerAlignment(player) === ALIGNMENT.INNOCENT;
  }).length;

  return {
    alivePlayers: alivePlayers.length,
    aliveImpostors,
    aliveInnocents
  };
}

function getWinCondition(room) {
  if (room.phase === PHASE.LOBBY || room.phase === PHASE.GAME_OVER) {
    return null;
  }

  if (room.neutralWinnerId) {
    return {
      winner: WINNER.NEUTRAL
    };
  }

  const counts = getAliveAlignmentCounts(room);

  if (counts.aliveImpostors <= 0) {
    return {
      winner: WINNER.INNOCENTS
    };
  }

  if (counts.aliveInnocents <= counts.aliveImpostors) {
    return {
      winner: WINNER.IMPOSTORS
    };
  }

  return null;
}

function applyWinConditionIfNeeded(room) {
  const result = getWinCondition(room);

  if (!result) {
    return false;
  }

  startGameOver(room, result.winner);
  return true;
}

function getPublicMessage(room) {
  return buildPublicMessage({
    room,
    votingAllowed: isVotingAllowed(room),
    voteSummary: getVoteSummary(room)
  });
}

function getPrivateMessage(player, room) {
  return buildPrivateMessage({
    player,
    room,
    votingAllowed: isVotingAllowed(room),
    playerVote: getPlayerVote(player, room)
  });
}

function emitRoomSnapshot(roomCode) {
  const room = rooms.get(roomCode);

  if (!room) {
    return;
  }

  const publicState = buildPublicState(room);

  for (const player of room.players) {
    io.to(player.socketId).emit("room:snapshot", {
      public: publicState,
      private: buildPrivateState(player, room)
    });
  }
}

function buildPublicState(room) {
  const remaining = getPhaseTimeRemaining(room);
  const total = room.phaseTotalSeconds || 0;
  const progress = getPhaseProgress(room);

  const voteSummary = getVoteSummary(room, {
    includeMissingAsSkip: false,
    useLastResult: room.phase === PHASE.DAY_RESULT
  });

  return {
    roomCode: room.roomCode,

    phase: room.phase,
    dayNumber: room.dayNumber,

    phaseTimeRemaining: remaining,
    phaseTimeTotal: total,
    phaseProgress: progress,

    publicMessage: getPublicMessage(room),

    skipVoteCount: voteSummary.skipVoteCount,
    submittedVoteCount: voteSummary.submittedVoteCount,
    eligibleVoteCount: voteSummary.eligibleVoteCount,

    hasDayResult: room.hasDayResult,
    hasVotedOut: room.hasVotedOut,
    lastVotedOutIndex: room.lastVotedOutIndex,
    lastVotedOutName: room.lastVotedOutName,

    hasNightResult: room.hasNightResult,

    hasVictim: room.hasVictim,
    lastVictimIndex: room.lastVictimIndex,
    lastVictimName: room.lastVictimName,

    winner: room.winner,
    gameOverMessage: room.gameOverMessage,

    playerCount: room.players.length,

    pois: getPublicPois(),

    players: room.players.map(player => ({
      id: player.id,
      index: player.index,
      name: player.name,
      isHost: player.isHost,
      isAlive: player.isAlive,
      publicStatus: player.publicStatus,
      houseVariant: (player.index - 1) % 4,
      voteCount: voteSummary.playerVoteCounts[player.id] || 0
    }))
  };
}

function getPlayerRoleText(player) {
  const roleKey = getRoleKey(player);
  const roleDefinition =
    ROLE_DEFINITIONS[roleKey] ||
    ROLE_DEFINITIONS[ROLE_KEY.RESIDENT];

  const actions = getResolvedPlayerActions(player);

  return {
    roleMessage: roleDefinition.roleMessage || "",
    action1Label: actions.action1?.label || "",
    action2Label: actions.action2?.label || "",
    action1Description: actions.action1?.description || "",
    action2Description: actions.action2?.description || ""
  };
}

function buildPrivateState(player, room) {
  const pendingVictim = room.pendingVictimId
    ? room.players.find(p => p.id === room.pendingVictimId)
    : null;

  const playerVote = getPlayerVote(player, room);
  const roleText = getPlayerRoleText(player);

  const canChooseVictim =
    room.phase === PHASE.NIGHT &&
    player.isAlive &&
    getPlayerAlignment(player) === ALIGNMENT.IMPOSTOR &&
    room.players.some(p => p.isAlive && p.id !== player.id);

  const canVote =
    isVotingAllowed(room) &&
    player.isAlive;

  return {
    playerId: player.id,
    playerIndex: player.index,
    playerName: player.name,
    isHost: player.isHost,

    phase: room.phase,

    roleName: player.roleName,
    roleMessage: roleText.roleMessage,
    actions: getResolvedPlayerActions(player),

    // Campos legados para o Rive/client atual.
    // Fonte real: actions.
    action1Label: roleText.action1Label,
    action2Label: roleText.action2Label,
    action1Description: roleText.action1Description,
    action2Description: roleText.action2Description,

    isImpostor: player.isImpostor,
    isAlive: player.isAlive,

    energy: getPlayerEnergy(player),
    maxEnergy: player.maxEnergy || PLAYER_CONFIG.maxEnergy,

    canStartGame:
      room.phase === PHASE.LOBBY &&
      player.isHost &&
      room.players.length >= MIN_PLAYERS_TO_START,

    canChooseVictim,

    hasSelectedVictim: Boolean(pendingVictim && getPlayerAlignment(player) === ALIGNMENT.IMPOSTOR),
    selectedVictimIndex: pendingVictim ? pendingVictim.index : -1,
    selectedVictimName: pendingVictim ? pendingVictim.name : "",

    canVote,
    hasVoted: playerVote.type !== "",
    votedTargetIndex: playerVote.target ? playerVote.target.index : -1,
    votedTargetName: playerVote.target ? playerVote.target.name : "",
    votedSkip: playerVote.type === VOTE_TYPE.SKIP,

    neutralTargetId: player.neutralTargetId || "",
    neutralTargetIndex: Number(player.neutralTargetIndex ?? -1),
    neutralTargetName: player.neutralTargetName || "",

    privateMessage: getPrivateMessage(player, room)
  };
}

function getPlayerVote(player, room) {
  const vote = room.votes[player.id];

  if (!vote) {
    return {
      type: "",
      target: null
    };
  }

  if (vote.type === VOTE_TYPE.SKIP) {
    return {
      type: VOTE_TYPE.SKIP,
      target: null
    };
  }

  const target = room.players.find(p => p.id === vote.targetId) || null;

  return {
    type: VOTE_TYPE.PLAYER,
    target
  };
}

function createPlayer({ socketId, index, name, isHost }) {
  return {
    id: createPlayerId(),
    socketId,
    index,
    name,
    isHost,

    roleKey: "",
    alignment: ALIGNMENT.NONE,
    roleId: ROLE.NONE,
    roleName: "",
    isImpostor: false,
    isAlive: true,
    publicStatus: 0,

    neutralTargetId: "",
    neutralTargetIndex: -1,
    neutralTargetName: "",

    energy: PLAYER_CONFIG.initialEnergy,
    maxEnergy: PLAYER_CONFIG.maxEnergy
  };
}

function reindexPlayers(room) {
  room.players.forEach((player, arrayIndex) => {
    player.index = arrayIndex + 1;
    player.isHost = player.id === room.hostPlayerId;
  });
}


function resolvePlayerName({ room, rawName, fallbackIndex }) {
  const sanitized = sanitizePlayerName(rawName);

  if (sanitized) {
    return sanitized;
  }

  const index = Number(fallbackIndex || (room?.players?.length || 0) + 1);
  return `${PLAYER_CONFIG.defaultNamePrefix} ${index}`;
}

function getRoleKey(player) {
  if (player.roleKey && ROLE_DEFINITIONS[player.roleKey]) {
    return player.roleKey;
  }

  if (getPlayerAlignment(player) === ALIGNMENT.IMPOSTOR) {
    return ROLE_KEY.KILLER;
  }

  return ROLE_KEY.RESIDENT;
}

function getPlayerAlignment(player) {
  const alignment = Number(player.alignment ?? player.roleId ?? ALIGNMENT.NONE);

  if (alignment === ALIGNMENT.IMPOSTOR) {
    return ALIGNMENT.IMPOSTOR;
  }

  if (alignment === ALIGNMENT.INNOCENT) {
    return ALIGNMENT.INNOCENT;
  }

  return ALIGNMENT.NONE;
}

function getActivityDefinition(roleKey, actionCommand) {
  const roleDefinition =
    ROLE_DEFINITIONS[roleKey] ||
    ROLE_DEFINITIONS[ROLE_KEY.RESIDENT];

  const actionId = roleDefinition?.actionSlots?.[actionCommand];

  if (!actionId) {
    return null;
  }

  return ACTION_DEFINITIONS[actionId] || null;
}

function getResolvedPlayerActions(player) {
  const roleKey = getRoleKey(player);
  const roleDefinition =
    ROLE_DEFINITIONS[roleKey] ||
    ROLE_DEFINITIONS[ROLE_KEY.RESIDENT];

  const result = {};

  for (const slot of [
    ACTION_COMMAND.ACTION_1,
    ACTION_COMMAND.ACTION_2,
    ACTION_COMMAND.SLEEP
  ]) {
    const actionId = roleDefinition?.actionSlots?.[slot];
    const definition = actionId ? ACTION_DEFINITIONS[actionId] : null;

    if (!definition) {
      continue;
    }

    result[slot] = buildClientActionDefinition(slot, definition);
  }

  return result;
}

function buildClientActionDefinition(slot, definition) {
  const microgameCategory = definition.microgameCategory || "none";
  const microgameConfig =
    MICROGAME_CONFIG[microgameCategory] ||
    MICROGAME_CONFIG.none ||
    {
      pool: [MICROGAME_ID.NONE],
      timeLimit: 0,
      difficulty: 0
    };

  return {
    slot,
    id: definition.id,
    actionClass: definition.actionClass,
    intent: definition.intent || "neutral",
    label: definition.label || definition.id || slot,
    description: definition.description || "",

    energyCost: Number(definition.energyCost || 0),
    energyGain: Number(definition.energyGain || 0),

    targetType: definition.targetType || TARGET_TYPE.NONE,
    allowSelfTarget: Boolean(definition.allowSelfTarget),
    defaultTargetSelf: Boolean(definition.defaultTargetSelf),

    microgameCategory,
    microgamePool: Array.isArray(microgameConfig.pool)
      ? [...microgameConfig.pool]
      : [MICROGAME_ID.NONE],
    microgameTimeLimit: Number(microgameConfig.timeLimit || 0),
    microgameDifficulty: Number(microgameConfig.difficulty || 0),

    implemented: definition.implemented !== false,
    skipsMicrogame: Boolean(definition.skipsMicrogame)
  };
}

function getPlayerEnergy(player) {
  const value = Number(player.energy ?? PLAYER_CONFIG.initialEnergy);

  if (!Number.isFinite(value)) {
    return PLAYER_CONFIG.initialEnergy;
  }

  return clamp(value, PLAYER_CONFIG.minEnergy, player.maxEnergy || PLAYER_CONFIG.maxEnergy);
}

function getMicrogameScoreFromResult({ resultCommand, skippedMicrogame }) {
  if (skippedMicrogame) {
    return CLUE_CONFIG.microgameResultScore.skipped;
  }

  if (resultCommand === ACTION_COMMAND.PASS) {
    return CLUE_CONFIG.microgameResultScore.pass;
  }

  return CLUE_CONFIG.microgameResultScore.fail;
}

function getPoiDefinition(code, index) {
  const normalizedCode = String(code || "");

  if (normalizedCode && POI_CONFIG.definitions[normalizedCode]) {
    return POI_CONFIG.definitions[normalizedCode];
  }

  return Object.values(POI_CONFIG.definitions).find(poi => {
    return Number(poi.index) === Number(index);
  }) || null;
}

function getPublicPois() {
  return POI_CONFIG.codes.map(code => {
    const poi = POI_CONFIG.definitions[code];

    return {
      index: poi.index,
      code: poi.code,
      poiType: poi.poiType,
      status: "normal",
      selectionEnabled: true,
      name: poi.displayName || poi.visibleName
    };
  });
}

function resetRoomClues(room) {
  room.publicClues = [];
  room.privateCluesByPlayerId = {};
  room.lastNightPublicClues = [];
  room.lastNightPrivateCluesByPlayerId = {};
  room.rawClues = [];
  room.publishedPublicClues = [];
  room.lastPublishedPublicClues = [];
  room.journalistPublicClues = [];
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, number));
}

function createRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  do {
    code = "";

    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
  } while (rooms.has(code));

  return code;
}

function createPlayerId() {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});