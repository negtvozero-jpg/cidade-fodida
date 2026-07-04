const {
  PHASE,
  WINNER,
  VOTE_TYPE,
  TARGET_TYPE,
  ACTION_CLASS,
  POI_CONFIG,
  MIN_PLAYERS_TO_START
} = require("./constants");

// ============================================================
// MESSAGES.JS
// ============================================================
//
// Fonte única de mensagens narrativas:
//
// - publicMessage
// - privateMessage
// - gameOverMessage
//
// O client/main.js não deve escrever mensagens narrativas.
// O Rive deve apenas exibir o texto recebido.
//
// Regras atuais:
//
// 1. Não usar mensagem do tipo "você é tal papel".
// 2. Noite:
//    - primeiro parágrafo: informação importante, se houver
//    - segundo parágrafo: CTA
// 3. Resolução da noite:
//    - pistas e atualizações da noite anterior
//    - sem CTA
// 4. Dia:
//    - pistas da noite anterior
//    - CTA do dia
// 5. Resolução do dia:
//    - informações importantes
//    - sem CTA por enquanto
//
// ============================================================


// ============================================================
// TEXTOS EDITÁVEIS
// ============================================================

const TEXT = {
  lobby: {
    public: "Aguardando jogadores.",
    publicMinPlayers: (minPlayers) => `Precisa de pelo menos ${minPlayers} jogadores.`,
    privateHost: "",
    privatePlayer: ""
  },

  night: {
    public: "A noite começou.",
    actionCta: "Selecione uma ação.",
    targetPlayerCta: "Selecione um jogador e confirme.",
    targetPoiCta: "Selecione um ponto de interesse e confirme.",
    targetRegionCta: "Selecione uma casa ou ponto de interesse e confirme.",
    waitingCta: "Ação confirmada. Aguarde a noite terminar.",
    dead: "Você não age durante a noite."
  },

  actionConfirmations: {
    sleep: "Você decidiu dormir.",
    stayHomeAwake: "Você decidiu ficar em casa acordado.",
    goOutToPoi: (action) => `Você decidiu ir até ${formatPoiName(action.targetPoiCode)}.`,
    killPlayer: (action) => `Você escolheu atacar ${formatPlayerName(action.targetPlayerName)}.`,
    vigilanteKill: (action) => `Você escolheu atacar ${formatPlayerName(action.targetPlayerName)}.`,
    possessedKill: (action) => `Você escolheu atacar ${formatPlayerName(action.targetPlayerName)}.`,
    investigateRegion: (action) => `Você decidiu investigar ${formatActionRegion(action)}.`,
    protectPlayer: (action) => (
      action.targetPlayerId === action.actorId
        ? "Você decidiu se proteger."
        : `Você decidiu proteger ${formatPlayerName(action.targetPlayerName)}.`
    ),
    publishRegionClue: (action) => `Você decidiu apurar informações em ${formatActionRegion(action)}.`,
    stalkPoi: (action) => `Você decidiu espreitar ${formatPoiName(action.targetPoiCode)}.`,
    plantEvidence: (action) => `Você decidiu plantar uma prova contra ${formatPlayerName(action.targetPlayerName)}.`,
    sabotage: "Você tentou sabotar a vila.",
    fallback: (action) => `Você confirmou: ${action.actionLabel || action.actionId || action.actionCommand}.`
  },

  energy: {
    insufficient: "Energia insuficiente para essa ação."
  },

  neutral: {
    instigatorTarget: (name) => `Seu alvo é ${formatPlayerName(name)}.`
  },

  nightResult: {
    noDeath: "Ninguém morreu durante a noite.",
    death: (name) => `${name} morreu durante a noite.`
  },

  day: {
    firstDayCta: "Converse com os outros jogadores.",
    discussionCta: "Converse com os outros jogadores.",
    votingCta: "Vote em alguém ou pule."
  },

  dayResult: {
    votedOut: (name) => `${name} foi eliminado pela votação.`,
    noElimination: "Ninguém foi eliminado pela votação."
  },

  vote: {
    prompt: "Vote em alguém ou pule.",
    skipped: "Você escolheu pular o voto.",
    selectedTarget: (name) => `Você votou em ${name}.`,
    waiting: "Aguarde os outros jogadores."
  },

  gameOver: {
    fallback: "Fim de jogo.",
    innocentsWin: "Os inocentes venceram.",
    impostorsWin: "O impostor venceu.",
    neutralWin: "Um neutro venceu."
  }
};


// ============================================================
// API
// ============================================================

function buildGameOverMessage(winner) {
  if (winner === WINNER.INNOCENTS) {
    return TEXT.gameOver.innocentsWin;
  }

  if (winner === WINNER.IMPOSTORS) {
    return TEXT.gameOver.impostorsWin;
  }

  if (winner === WINNER.NEUTRAL) {
    return TEXT.gameOver.neutralWin;
  }

  return TEXT.gameOver.fallback;
}

function buildPublicMessage({
  room,
  votingAllowed = false,
  voteSummary = null
} = {}) {
  if (!room) {
    return "";
  }

  if (room.phase === PHASE.LOBBY) {
    const playerCount = getAliveOrTotalPlayerCount(room);

    if (playerCount < MIN_PLAYERS_TO_START) {
      return TEXT.lobby.publicMinPlayers(MIN_PLAYERS_TO_START);
    }

    return TEXT.lobby.public;
  }

  if (room.phase === PHASE.NIGHT) {
    return composeParagraphs([
      getImportantPublicNightInfo(room),
      TEXT.night.public
    ]);
  }

  if (room.phase === PHASE.NIGHT_RESULT) {
    return composeParagraphs([
      buildPublishedPublicClueText(room),
      buildNightResultUpdate(room)
    ]);
  }

  if (room.phase === PHASE.DAY) {
    return composeParagraphs([
      buildPublishedPublicClueText(room),
      buildDayCTA(room, votingAllowed, voteSummary)
    ]);
  }

  if (room.phase === PHASE.DAY_RESULT) {
    return buildDayResultUpdate(room);
  }

  if (room.phase === PHASE.GAME_OVER) {
    return buildGameOverMessage(room.winner);
  }

  return "";
}

function buildPrivateMessage({
  player,
  room,
  votingAllowed = false,
  playerVote = null
} = {}) {
  if (!player || !room) {
    return "";
  }

  if (room.phase === PHASE.LOBBY) {
    return player.isHost ? TEXT.lobby.privateHost : TEXT.lobby.privatePlayer;
  }

  if (room.phase === PHASE.NIGHT) {
    return buildPrivateNightMessage({
      player,
      room
    });
  }

  if (room.phase === PHASE.NIGHT_RESULT) {
    return composeParagraphs([
      buildPrivateClueText(player, room),
      buildPrivateNightUpdate(player, room)
    ]);
  }

  if (room.phase === PHASE.DAY) {
    return buildPrivateDayMessage({
      player,
      room,
      votingAllowed,
      playerVote
    });
  }

  if (room.phase === PHASE.DAY_RESULT) {
    return buildPrivateDayResultMessage({
      player,
      room
    });
  }

  if (room.phase === PHASE.GAME_OVER) {
    return "";
  }

  return "";
}


// ============================================================
// NOITE
// ============================================================

function buildPrivateNightMessage({ player, room }) {
  if (!isPlayerAlive(player)) {
    return TEXT.night.dead;
  }

  const importantInfo = composeParagraphs([
    getImportantPrivateNightInfo(player, room),
    buildActionConfirmation(player, room)
  ]);

  return composeParagraphs([
    importantInfo,
    getNightCTA(player, room)
  ]);
}

function getNightCTA(player, _room) {
  const pendingTargetType =
    player.pendingTargetType ||
    player.selectedTargetType ||
    "";

  if (hasSubmittedNightAction(player, _room)) {
    return TEXT.night.waitingCta;
  }

  if (pendingTargetType === TARGET_TYPE.PLAYER) {
    return TEXT.night.targetPlayerCta;
  }

  if (pendingTargetType === TARGET_TYPE.POI) {
    return TEXT.night.targetPoiCta;
  }

  if (pendingTargetType === TARGET_TYPE.REGION) {
    return TEXT.night.targetRegionCta;
  }

  return TEXT.night.actionCta;
}

function buildActionConfirmation(player, room) {
  const action = room.nightActions?.[player.id];

  if (!action) {
    return "";
  }

  const formatter =
    TEXT.actionConfirmations[action.actionId] ||
    TEXT.actionConfirmations[action.actionClass] ||
    TEXT.actionConfirmations[action.actionCommand] ||
    TEXT.actionConfirmations.fallback;

  if (typeof formatter === "function") {
    return formatter(action);
  }

  return formatter || "";
}

function hasSubmittedNightAction(player, room) {
  return Boolean(room?.nightActions?.[player.id]);
}

function getImportantPublicNightInfo(_room) {
  return "";
}

function getImportantPrivateNightInfo(player, room) {
  const parts = [];
  const lastError = room.lastActionErrorByPlayerId?.[player.id] || "";

  if (lastError === "NOT_ENOUGH_ENERGY") {
    parts.push(TEXT.energy.insufficient);
  }

  if (player.neutralTargetName) {
    parts.push(TEXT.neutral.instigatorTarget(player.neutralTargetName));
  }

  return composeParagraphs(parts);
}


// ============================================================
// RESOLUÇÃO DA NOITE
// ============================================================

function buildNightResultUpdate(room) {
  const victimName = getLastVictimName(room);

  if (victimName) {
    return TEXT.nightResult.death(victimName);
  }

  return TEXT.nightResult.noDeath;
}

function buildPrivateNightUpdate(_player, _room) {
  return "";
}


// ============================================================
// DIA
// ============================================================

function buildPrivateDayMessage({
  player,
  room,
  votingAllowed,
  playerVote
}) {
  const clueText = buildPrivateClueText(player, room);

  if (!isPlayerAlive(player)) {
    return clueText;
  }

  const cta = votingAllowed
    ? buildPrivateVotingCTA(playerVote)
    : buildDiscussionCTA(room);

  return composeParagraphs([
    clueText,
    cta
  ]);
}

function buildDayCTA(room, votingAllowed, voteSummary) {
  if (votingAllowed) {
    return composeInline([
      TEXT.day.votingCta,
      formatVoteCounter(voteSummary)
    ]);
  }

  if (room.dayNumber <= 1) {
    return TEXT.day.firstDayCta;
  }

  return TEXT.day.discussionCta;
}

function buildDiscussionCTA(_room) {
  return TEXT.day.discussionCta;
}

function buildPrivateVotingCTA(playerVote) {
  if (!playerVote) {
    return TEXT.vote.prompt;
  }

  if (playerVote.type === VOTE_TYPE.SKIP || playerVote.voteSkip === true) {
    return composeParagraphs([
      TEXT.vote.skipped,
      TEXT.vote.waiting
    ]);
  }

  const name =
    playerVote.targetName ||
    playerVote.targetPlayerName ||
    playerVote.name ||
    playerVote.target?.name ||
    "";

  if (name) {
    return composeParagraphs([
      TEXT.vote.selectedTarget(name),
      TEXT.vote.waiting
    ]);
  }

  return TEXT.vote.waiting;
}


// ============================================================
// RESOLUÇÃO DO DIA
// ============================================================

function buildDayResultUpdate(room) {
  const votedOutName = getLastVotedOutName(room);

  if (votedOutName) {
    return TEXT.dayResult.votedOut(votedOutName);
  }

  return TEXT.dayResult.noElimination;
}

function buildPrivateDayResultMessage(_params) {
  return "";
}


// ============================================================
// PISTAS
// ============================================================

function buildPublishedPublicClueText(room) {
  const clues = getPublishedPublicClues(room);

  if (clues.length <= 0) {
    return "";
  }

  return clues.join("\n");
}

function buildPrivateClueText(player, room) {
  const clues = getPrivateClues(player, room);

  if (clues.length <= 0) {
    return "";
  }

  return clues.join("\n");
}

function getPublishedPublicClues(room) {
  const result = [];

  // Pistas comuns da noite não entram no publicMessage.
  // Estes campos ficam reservados para habilidades futuras como jornalista.
  appendStringArray(result, room.publishedPublicClues);
  appendStringArray(result, room.lastPublishedPublicClues);
  appendStringArray(result, room.journalistPublicClues);

  if (room.clues && Array.isArray(room.clues.published)) {
    appendStringArray(result, room.clues.published);
  }

  if (Array.isArray(room.clues)) {
    for (const clue of room.clues) {
      if (!clue) continue;

      const visibility = clue.visibility || clue.type || "";
      const text = clue.text || clue.message || "";

      if ((visibility === "published" || visibility === "journalist") && text) {
        result.push(String(text));
      }
    }
  }

  return uniqueStrings(result);
}

function getPrivateClues(player, room) {
  const result = [];
  const playerId = player.id || player.playerId || "";

  if (!playerId) {
    return result;
  }

  if (room.privateCluesByPlayerId) {
    appendStringArray(result, room.privateCluesByPlayerId[playerId]);
  }

  if (room.lastNightPrivateCluesByPlayerId) {
    appendStringArray(result, room.lastNightPrivateCluesByPlayerId[playerId]);
  }

  if (room.privateClues) {
    appendStringArray(result, room.privateClues[playerId]);
  }

  if (room.clues && room.clues.private) {
    appendStringArray(result, room.clues.private[playerId]);
  }

  if (Array.isArray(room.clues)) {
    for (const clue of room.clues) {
      if (!clue) continue;

      const visibility = clue.visibility || clue.type || "";
      const targetPlayerId =
        clue.playerId ||
        clue.targetPlayerId ||
        clue.recipientId ||
        clue.possibleRecipientId ||
        "";

      const text = clue.text || clue.message || "";

      if (visibility === "private" && targetPlayerId === playerId && text) {
        result.push(String(text));
      }
    }
  }

  return uniqueStrings(result);
}


// ============================================================
// FORMATADORES
// ============================================================

function formatVoteCounter(voteSummary) {
  if (!voteSummary) {
    return "";
  }

  const submitted = Number(
    voteSummary.submittedVoteCount ??
    voteSummary.submitted ??
    0
  );

  const eligible = Number(
    voteSummary.eligibleVoteCount ??
    voteSummary.eligible ??
    0
  );

  const skip = Number(
    voteSummary.skipVoteCount ??
    voteSummary.skip ??
    0
  );

  const parts = [];

  if (eligible > 0) {
    parts.push(`${submitted}/${eligible} votos`);
  }

  if (skip > 0) {
    parts.push(`${skip} pularam`);
  }

  return parts.join(". ");
}

function formatPoiName(code) {
  const poi = POI_CONFIG.definitions[String(code || "")];
  return poi?.visibleName || code || "o ponto escolhido";
}

function formatPlayerName(name) {
  return String(name || "o jogador escolhido");
}

function formatActionRegion(action) {
  if (action?.targetPoiCode) {
    return formatPoiName(action.targetPoiCode);
  }

  if (action?.targetPlayerName) {
    return `a região da casa de ${formatPlayerName(action.targetPlayerName)}`;
  }

  return "a região escolhida";
}

function composeParagraphs(parts) {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function composeInline(parts) {
  return parts
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" ");
}

function appendStringArray(target, value) {
  if (!Array.isArray(value)) {
    return;
  }

  for (const item of value) {
    const text = String(item || "").trim();

    if (text) {
      target.push(text);
    }
  }
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values) {
    const text = String(value || "").trim();

    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    result.push(text);
  }

  return result;
}


// ============================================================
// ROOM / PLAYER HELPERS
// ============================================================

function getAliveOrTotalPlayerCount(room) {
  if (!Array.isArray(room.players)) {
    return 0;
  }

  return room.players.length;
}

function isPlayerAlive(player) {
  return Boolean(player.isAlive ?? player.alive ?? true);
}

function getLastVictimName(room) {
  if (room.lastVictimName) {
    return String(room.lastVictimName);
  }

  if (room.lastVictim && room.lastVictim.name) {
    return String(room.lastVictim.name);
  }

  if (room.nightResult && room.nightResult.victimName) {
    return String(room.nightResult.victimName);
  }

  return "";
}

function getLastVotedOutName(room) {
  if (room.lastVotedOutName) {
    return String(room.lastVotedOutName);
  }

  if (room.lastVotedOut && room.lastVotedOut.name) {
    return String(room.lastVotedOut.name);
  }

  if (room.dayResult && room.dayResult.votedOutName) {
    return String(room.dayResult.votedOutName);
  }

  return "";
}


// ============================================================
// EXPORT
// ============================================================

module.exports = {
  buildPublicMessage,
  buildPrivateMessage,
  buildGameOverMessage
};
