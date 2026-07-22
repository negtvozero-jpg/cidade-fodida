const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const CONFIG = require("./src/config");
const { PHASE, WINNER } = require("./src/constants");
const { sanitizeRoomCode } = require("./src/sanitize");
const {
  createRoomCode,
  createRoom,
  createPlayer,
  addPlayerToRoom,
  resolvePlayerName,
  findPlayer,
  findPlayerBySocket,
  markPlayerDisconnected
} = require("./src/game/roomManager");
const { buildSnapshot } = require("./src/game/snapshotBuilder");
const { assignRoles } = require("./src/game/roleAssigner");
const { startPhase, advancePhase, maybeEndNightEarly, isVotingAllowed } = require("./src/game/phaseEngine");
const { submitActivityResult } = require("./src/game/actionResolver");
const { submitVote, clearVote, allAlivePlayersVoted } = require("./src/game/voteResolver");
const { evaluateWin } = require("./src/game/winResolver");
const messages = require("./src/messages");
const { ensurePlaytestSettings, sanitizePlaytestSettings } = require("./src/game/playtestSettings");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const rooms = new Map();

app.use(express.static(path.join(__dirname, "../client")));

io.on("connection", socket => {
  console.log("[SOCKET] conectado:", socket.id);

  socket.on("room:create", (payload, callback) => {
    const roomCode = createRoomCode(new Set(rooms.keys()));
    const player = createPlayer({
      socketId: socket.id,
      index: 1,
      name: resolvePlayerName({ room: null, rawName: payload?.playerName, fallbackIndex: 1 }),
      isHost: true
    });

    const room = createRoom({ roomCode, hostPlayer: player });
    rooms.set(roomCode, room);
    socket.join(roomCode);

    callback?.({ ok: true, roomCode, playerId: player.id });
    broadcastSnapshot(room);
  });

  socket.on("room:join", (payload, callback) => {
    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const room = rooms.get(roomCode);

    if (!room) return callback?.({ ok: false, error: "ROOM_NOT_FOUND" });
    if (room.phase !== PHASE.LOBBY) return callback?.({ ok: false, error: "GAME_ALREADY_STARTED" });
    if (room.players.length >= CONFIG.room.maxPlayers) return callback?.({ ok: false, error: "ROOM_FULL" });

    const player = addPlayerToRoom(room, { socketId: socket.id, rawName: payload?.playerName });
    socket.join(roomCode);

    callback?.({ ok: true, roomCode, playerId: player.id });
    broadcastSnapshot(room);
  });

  socket.on("room:heartbeat", payload => {
    const room = rooms.get(sanitizeRoomCode(payload?.roomCode));
    const player = room ? findPlayer(room, payload?.playerId) : null;

    if (!room || !player) {
      socket.emit("room:restoreFailed", { ok: false, error: "ROOM_NOT_FOUND" });
      return;
    }

    player.socketId = socket.id;
    player.lastSeenAt = Date.now();
    socket.join(room.roomCode);
    socket.emit("room:snapshot", buildSnapshot(room, player));
  });


  socket.on("game:updatePlaytestSettings", (payload, callback) => {
    const context = getContext(payload);
    if (!context.ok) return callback?.(context);

    const { room, player } = context;
    if (player.id !== room.hostPlayerId) return callback?.({ ok: false, error: "NOT_HOST" });
    if (room.phase !== PHASE.LOBBY) return callback?.({ ok: false, error: "GAME_ALREADY_STARTED" });

    room.playtestSettings = sanitizePlaytestSettings(payload?.settings || {}, ensurePlaytestSettings(room));
    callback?.({ ok: true, settings: room.playtestSettings });
    broadcastSnapshot(room);
  });

  socket.on("game:start", (payload, callback) => {
    const context = getContext(payload);
    if (!context.ok) return callback?.(context);

    const { room, player } = context;
    if (player.id !== room.hostPlayerId) return callback?.({ ok: false, error: "NOT_HOST" });
    if (room.phase !== PHASE.LOBBY) return callback?.({ ok: false, error: "GAME_ALREADY_STARTED" });
    if (room.players.length < CONFIG.room.minPlayersToStart) return callback?.({ ok: false, error: "NOT_ENOUGH_PLAYERS" });

    assignRoles(room);
    room.dayNumber = 1;
    startPhase(room, PHASE.DAY, io, broadcastSnapshot);
    callback?.({ ok: true });
  });

  socket.on("game:submitActivityResult", (payload, callback) => {
    const context = getContext(payload);
    if (!context.ok) return callback?.(context);

    const { room, player } = context;
    if (room.phase !== PHASE.NIGHT) return callback?.({ ok: false, error: "NOT_NIGHT" });

    const result = submitActivityResult(room, player, payload);
    callback?.(result);

    evaluateAndMaybeEnd(room);
    broadcastSnapshot(room);
    maybeEndNightEarly(room, io, broadcastSnapshot);
  });

  socket.on("game:submitVote", (payload, callback) => {
    const context = getContext(payload);
    if (!context.ok) return callback?.(context);

    const { room, player } = context;
    if (!isVotingAllowed(room)) return callback?.({ ok: false, error: "VOTING_CLOSED" });

    const result = submitVote(room, player, {
      targetId: payload?.targetId || "",
      voteSkip: Boolean(payload?.voteSkip)
    });

    callback?.(result);
    broadcastSnapshot(room);

    if (result.ok && allAlivePlayersVoted(room)) {
      advancePhase(room, io, broadcastSnapshot);
    }
  });

  socket.on("game:clearSelection", (payload, callback) => {
    const context = getContext(payload);
    if (!context.ok) return callback?.(context);

    const result = clearVote(context.room, context.player);
    callback?.(result);
    broadcastSnapshot(context.room);
  });

  socket.on("game:submitNightCommand", (_payload, callback) => {
    callback?.({ ok: false, error: "DEPRECATED_FLOW_USE_ACTIVITY_RESULT" });
  });

  socket.on("game:submitVictim", (_payload, callback) => {
    callback?.({ ok: false, error: "DEPRECATED_FLOW_USE_ACTIVITY_RESULT" });
  });

  socket.on("disconnect", () => {
    console.log("[SOCKET] desconectado:", socket.id);
    for (const room of rooms.values()) {
      const player = findPlayerBySocket(room, socket.id);
      if (player) markPlayerDisconnected(player);
    }
  });
});

function getContext(payload = {}) {
  const roomCode = sanitizeRoomCode(payload.roomCode);
  const room = rooms.get(roomCode);
  if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };

  const player = findPlayer(room, payload.playerId);
  if (!player) return { ok: false, error: "PLAYER_NOT_FOUND" };

  return { ok: true, room, player };
}

function broadcastSnapshot(room) {
  for (const player of room.players) {
    if (!player.socketId) continue;
    io.to(player.socketId).emit("room:snapshot", buildSnapshot(room, player));
  }
}

function evaluateAndMaybeEnd(room) {
  if (evaluateWin(room) !== WINNER.NONE) {
    room.gameOverMessage = messages.buildGameOverMessage(room.winner, room);
  }
}

server.listen(CONFIG.server.port, () => {
  console.log(`Servidor rodando na porta ${CONFIG.server.port}`);
});
