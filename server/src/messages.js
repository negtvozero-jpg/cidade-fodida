const CONFIG = require("./config");
const { PHASE, WINNER, TARGET_TYPE, ACTION_CLASS, ROLE_KEY } = require("./constants");
const { getActivePublicEffectReminders } = require("./game/effectResolver");
const { getPoiByCode } = require("./data/map");

const TEXT = {
  lobby: {
    public: "Aguardando jogadores.",
    publicMinPlayers: (min) => `Precisa de pelo menos ${min} jogadores.`,
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
    possessedCondemn: (action) => `Você tentou condenar ${formatPlayerName(action.targetPlayerName)}.`,
    possessedSynergy: "Você tentou abrir sinergia com sua linhagem.",
    lithomancerGuess: (action) => `Você usou Vaticínio contra ${formatPlayerName(action.targetPlayerName)} como ${action.guessedRoleName || "um papel"}.`,
    bountyKill: (action) => `Você escolheu atacar ${formatPlayerName(action.targetPlayerName)}.`,
    obsessorMark: (action) => `Você marcou ${formatPlayerName(action.targetPlayerName)}.`,
    mediumSensePresence: (action) => `Você tentou sentir presenças em ${formatActionRegion(action)}.`,
    investigateRegion: (action) => `Você decidiu investigar ${formatActionRegion(action)}.`,
    bountyInvestigateRegion: (action) => `Você decidiu investigar ${formatActionRegion(action)}.`,
    protectPlayer: (action) => (
      action.targetPlayerId === action.actorId
        ? "Você decidiu se proteger."
        : `Você decidiu proteger ${formatPlayerName(action.targetPlayerName)}.`
    ),
    publishRegionClue: (action) => `Você decidiu apurar informações em ${formatActionRegion(action)}.`,
    stalkPoi: (action) => `Você decidiu espreitar ${formatPoiName(action.targetPoiCode)}.`,
    plantEvidence: "Você decidiu plantar uma prova contra seu alvo.",
    cultistRitualStep: (action) => `Você tentou preparar o ritual em ${formatPoiName(action.targetPoiCode)}.`,
    sabotage: "Você tentou sabotar a vila.",
    fallback: (action) => `Você confirmou: ${action.label || action.actionId || action.actionCommand}.`
  },

  neutral: {
    instigatorTarget: (name) => `Seu alvo é ${formatPlayerName(name)}.`,
    lawyerClient: (name) => `Seu cliente é ${formatPlayerName(name)}. Se ele morrer, você morre junto; se ele vencer, você vence junto.`,
    bountyTargetRole: (roleName) => `Seu alvo tem o papel: ${roleName || "desconhecido"}.`,
    possessedGoal: (hasUsedCondemn) => hasUsedCondemn
      ? "Você já condenou alguém. Vença chegando aos 2 últimos ou com sua linhagem entre os 4 últimos sem impostores vivos."
      : "Condene alguém e sobreviva. Sua linhagem vence nos 2 últimos, ou entre os 4 últimos sem impostores vivos.",
    condemnedGoal: "Você é Condenado. Vença junto da linhagem do Possuído.",
    cultistProgress: (progress, goal, poiName) => `Ritual: ${progress}/${goal}. Próxima etapa: ${poiName}.`
  },

  nightResult: {
    noDeath: "Ninguém morreu durante a noite.",
    death: (name) => `${name} morreu durante a noite.`
  },

  day: {
    firstDayCta: "Primeiro dia: confira seu papel, alinhamento, objetivo e habilidades. Não há votação.",
    discussionCta: "Converse com os outros jogadores.",
    votingCta: "Vote em alguém ou pule."
  },

  dayResult: {
    votedOut: (name) => `${name} ${String(name || "").includes(",") ? "foram eliminados" : "foi eliminado"} pela votação.`,
    noElimination: "Ninguém foi eliminado pela votação."
  },

  vote: {
    skipped: "Você escolheu pular o voto.",
    selectedTarget: (name) => `Você votou em ${name}.`,
    waiting: "Aguarde os outros jogadores."
  },

  gameOver: {
    fallback: "Fim de jogo.",
    innocentsWin: "Os inocentes venceram.",
    impostorsWin: "Os impostores venceram.",
    neutralWin: (name) => name ? `${name} venceu.` : "Um neutro venceu.",
    alliedWinners: (names) => names ? `Também venceram: ${names}.` : ""
  }
};

function buildPublicMessage({ room, votingAllowed = false, voteSummary = null } = {}) {
  if (!room) return "";

  if (room.phase === PHASE.LOBBY) {
    return room.players.length < CONFIG.room.minPlayersToStart
      ? TEXT.lobby.publicMinPlayers(CONFIG.room.minPlayersToStart)
      : TEXT.lobby.public;
  }

  if (room.phase === PHASE.NIGHT) {
    return TEXT.night.public;
  }

  if (room.phase === PHASE.NIGHT_RESULT) {
    return composeParagraphs([
      buildNightResultUpdate(room),
      buildPublicPublishedClues(room),
      buildNightResultAnnouncements(room)
    ]);
  }

  if (room.phase === PHASE.DAY) {
    if (room.dayNumber <= 1) {
      return TEXT.day.firstDayCta;
    }

    return composeParagraphs([
      buildNightResultUpdate(room),
      buildPublicPublishedClues(room),
      buildDayCTA(room, votingAllowed, voteSummary)
    ]);
  }

  if (room.phase === PHASE.DAY_RESULT) {
    return composeParagraphs([
      buildDayResultUpdate(room),
      ...getActivePublicEffectReminders(room)
    ]);
  }

  if (room.phase === PHASE.GAME_OVER) {
    return buildGameOverMessage(room.winner, room);
  }

  return "";
}

function buildPrivateMessage({ player, room, votingAllowed = false, playerVote = null } = {}) {
  if (!player || !room) return "";

  if (room.phase === PHASE.LOBBY) {
    return player.isHost ? TEXT.lobby.privateHost : TEXT.lobby.privatePlayer;
  }

  if (room.phase === PHASE.NIGHT) {
    return buildPrivateNightMessage(player, room);
  }

  if (room.phase === PHASE.NIGHT_RESULT) {
    return composeParagraphs([
      buildPrivateClues(player, room),
      buildEffectMarkerText(player),
      buildNeutralPrivateInfo(player)
    ]);
  }

  if (room.phase === PHASE.DAY) {
    return composeParagraphs([
      buildPrivateClues(player, room),
      buildEffectMarkerText(player),
      buildDayPrivateCTA(player, room, votingAllowed, playerVote)
    ]);
  }

  if (room.phase === PHASE.DAY_RESULT) {
    return composeParagraphs([
      buildEffectMarkerText(player)
    ]);
  }

  return "";
}

function buildPrivateNightMessage(player, room) {
  if (!player.isAlive) return TEXT.night.dead;

  const action = room.nightActions[player.id];

  if (action) {
    return composeParagraphs([
      buildActionConfirmation(action),
      buildNeutralPrivateInfo(player),
      TEXT.night.waitingCta
    ]);
  }

  return composeParagraphs([
    buildNeutralPrivateInfo(player),
    TEXT.night.actionCta
  ]);
}

function buildActionConfirmation(action) {
  const handler = TEXT.actionConfirmations[action.id] || TEXT.actionConfirmations[action.actionClass] || TEXT.actionConfirmations.fallback;
  return typeof handler === "function" ? handler(action) : handler;
}

function buildNightResultUpdate(room) {
  if (!room.hasVictim || !room.lastVictimName) {
    return TEXT.nightResult.noDeath;
  }

  return TEXT.nightResult.death(room.lastVictimName);
}

function buildPublicPublishedClues(room) {
  return (room.lastPublishedPublicClues || []).join("\n");
}

function buildNightResultAnnouncements(room) {
  return (room.nightResultAnnouncements || []).join("\n");
}

function buildPrivateClues(player, room) {
  return (room.lastNightPrivateCluesByPlayerId?.[player.id] || []).join("\n");
}

function buildDayCTA(room, votingAllowed, voteSummary) {
  if (votingAllowed) return composeInline([TEXT.day.votingCta, formatVoteCounter(voteSummary)]);
  return room.dayNumber <= 1 ? TEXT.day.firstDayCta : TEXT.day.discussionCta;
}

function buildDayPrivateCTA(player, room, votingAllowed, vote) {
  if (!player.isAlive) return "";

  if (!votingAllowed) return room.dayNumber <= 1 ? TEXT.day.firstDayCta : TEXT.day.discussionCta;

  if (!vote) return TEXT.day.votingCta;
  if (vote.type === "skip") return composeParagraphs([TEXT.vote.skipped, TEXT.vote.waiting]);

  const target = room.players.find(player => player.id === vote.targetId);
  return composeParagraphs([TEXT.vote.selectedTarget(target?.name || "alguém"), TEXT.vote.waiting]);
}

function buildDayResultUpdate(room) {
  if (room.dayNumber <= 1) return "O primeiro dia terminou. A noite vai começar.";
  if (room.hasVotedOut && room.lastVotedOutName) return TEXT.dayResult.votedOut(room.lastVotedOutName);
  return TEXT.dayResult.noElimination;
}

function buildEffectMarkerText(player) {
  return (player.effects || [])
    .map(effect => CONFIG.effects[effect.id]?.privateMessage || "")
    .filter(Boolean)
    .join("\n");
}

function buildNeutralPrivateInfo(player) {
  if (player.roleId === ROLE_KEY.INSTIGATOR && player.neutralTargetId) {
    return TEXT.neutral.instigatorTarget(player.neutralTargetName || "seu alvo");
  }

  if (player.roleId === ROLE_KEY.LAWYER && player.neutralTargetId) {
    return TEXT.neutral.lawyerClient(player.neutralTargetName || "seu cliente");
  }

  if (player.roleId === ROLE_KEY.BOUNTY_HUNTER && player.neutralTargetRoleName) {
    return TEXT.neutral.bountyTargetRole(player.neutralTargetRoleName);
  }

  if (player.roleId === ROLE_KEY.POSSESSED) {
    return TEXT.neutral.possessedGoal(Boolean(player.hasUsedCondemn));
  }

  if (player.roleId === ROLE_KEY.CONDEMNED) {
    return TEXT.neutral.condemnedGoal;
  }

  if (player.roleId === ROLE_KEY.CULTIST) {
    const progress = Number(player.cultistRitualProgress || 0);
    const goal = 4;
    const nextPoiCode = player.cultistRitualPoiCodes?.[progress] || "";
    const nextPoiName = getPoiByCode(nextPoiCode)?.displayName || "desconhecida";
    return TEXT.neutral.cultistProgress(progress, goal, nextPoiName);
  }

  return "";
}

function buildGameOverMessage(winner, room = {}) {
  const alliedWinners = (room.alliedWinnerNames || []).join(", ");
  const suffix = alliedWinners ? `\n${TEXT.gameOver.alliedWinners(alliedWinners)}` : "";
  if (winner === WINNER.INNOCENTS) return `${TEXT.gameOver.innocentsWin}${suffix}`;
  if (winner === WINNER.IMPOSTORS) return `${TEXT.gameOver.impostorsWin}${suffix}`;
  if (winner === WINNER.NEUTRAL) return `${TEXT.gameOver.neutralWin(room.neutralWinnerName)}${suffix}`;
  return TEXT.gameOver.fallback;
}

function formatActionRegion(action) {
  if (action.targetPlayerName) return `a casa de ${formatPlayerName(action.targetPlayerName)}`;
  if (action.targetPoiCode) return formatPoiName(action.targetPoiCode);
  return "uma região";
}

function formatPoiName(code) {
  return getPoiByCode(code)?.displayName || code || "um ponto de interesse";
}

function formatPlayerName(name) {
  return String(name || "alguém");
}

function formatVoteCounter(voteSummary) {
  if (!voteSummary) return "";
  if (!voteSummary.eligibleVoteCount) return "";
  return `${voteSummary.submittedVoteCount}/${voteSummary.eligibleVoteCount} votos.`;
}

function composeParagraphs(parts) {
  return parts.map(part => String(part || "").trim()).filter(Boolean).join("\n\n");
}

function composeInline(parts) {
  return parts.map(part => String(part || "").trim()).filter(Boolean).join(" ");
}

module.exports = {
  TEXT,
  buildPublicMessage,
  buildPrivateMessage,
  buildGameOverMessage
};
