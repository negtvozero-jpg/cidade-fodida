const CONFIG = require("../config");
const { ACTION_CLASS, ACTION_INTENT, ALIGNMENT, EFFECT_KEY } = require("../constants");
const { templateFromGroup } = require("./clueTemplates");
const { privateClue, publicClue, groupCluesByPlayer, selectPublicClues, getPriority } = require("./clueSelector");
const {
  getPlayerById,
  getActionTargetPlayer,
  getActionTargetPoi,
  getPlayerHomeLabel,
  getActionRegionLabel,
  getActionPathData,
  buildTemplateData,
  formatList
} = require("./clueContext");
const { hasEffect } = require("../data/effects");
const { actionLeavesHome, isBlackoutActive } = require("../game/effectResolver");
const { isPossessedLineagePlayer } = require("../game/possessedLineage");
const { POI_CONFIG, ROAD_NAMES, ROAD_DIRECTIONS, getPlayerSlot } = require("../data/map");
const { debugLog } = require("../debug");

function resolveNightClues({ room, actions = [], events = [], rng = Math.random }) {
  const clues = [];

  const environmentalClues = buildEnvironmentalClues(room, actions, rng);
  clues.push(...environmentalClues);

  const eventClues = [];
  for (const event of events) {
    eventClues.push(...buildEventClues(room, event, rng));
  }
  clues.push(...eventClues);

  clues.push(...buildObserverQuietClues(room, actions, [...environmentalClues, ...eventClues], rng));

  for (const player of room.players) {
    clues.push(...buildEffectClues(room, player, rng));
  }

  clues.push(...buildLineageSynergyClues(room, actions));

  const privateByPlayerId = groupCluesByPlayer(clues, room);
  const publicClues = selectPublicClues(clues);

  return {
    privateByPlayerId,
    publicClues,
    rawClues: clues
  };
}

function buildEventClues(room, event, rng) {
  const clues = [];

  if (event.type === "target_not_home") {
    const target = getPlayerById(room, event.targetId);
    const actor = getPlayerById(room, event.actorId);

    if (target) {
      const text = renderObservationClue(room, target, {
        action: event.action,
        profile: "incidental",
        place: getPlayerHomeLabel(target, target),
        direction: getActionPathData(room, event.action).actionApproachDirection,
        players: actor ? [actor] : [],
        forceMinimumScore: Number(CONFIG.clues.homeIntrusionMinimumScore ?? 1),
        rng
      });

      if (text) {
        clues.push(privateClue(target.id, text, {
          category: "missedHome",
          placeKey: `home:${target.id}`,
          priority: getPriority("missedHome"),
          guaranteed: true
        }));

        debugLog("clues", "home intrusion clue", {
          recipient: target.name,
          actor: actor?.name || "",
          place: "sua casa",
          text
        });
      } else {
        debugLog("clues", "home intrusion produced no clue", {
          recipient: target.name,
          actor: actor?.name || "",
          eventType: event.type
        });
      }
    }
  }

  if (event.type === "protected_attack") {
    const target = getPlayerById(room, event.targetId);
    if (target) {
      clues.push(privateClue(target.id, templateFromGroup("protectedAttack", buildTemplateData(room, event.action, {
        targetPlayer: target.name
      }), rng), {
        category: "protected",
        placeKey: `home:${target.id}`,
        priority: getPriority("protected")
      }));
    }
  }

  if (event.type === "detective_result") {
    clues.push(...buildDetectiveClues(room, event.action, rng));
  }

  if (event.type === "medium_result") {
    clues.push(...buildMediumClues(room, event.action, rng));
  }

  if (event.type === "journalist_publish") {
    const text = buildJournalistPublicClue(room, event.action, rng);
    if (text) clues.push(publicClue(text, { category: "roleResult", priority: getPriority("roleResult") }));
  }

  if (event.type === "planted_evidence") {
    const observers = event.observerIds || [];
    for (const observerId of observers) {
      const observer = getPlayerById(room, observerId);
      if (!observer) continue;

      const text = renderObservationClue(room, observer, {
        action: event.action,
        profile: "plantedEvidence",
        factType: "movement",
        place: event.crimeScene || getFallbackRealPlace(room, rng),
        direction: event.adjacentCrimeSceneDirection || getFallbackRealDirection(rng),
        players: event.framedPlayerId ? [getPlayerById(room, event.framedPlayerId)].filter(Boolean) : [{ name: event.framedPlayerName }],
        hasMovement: true,
        forceMinimumScore: 1,
        rng
      });

      if (text) {
        clues.push(privateClue(observer.id, text, {
          category: "plantedEvidence",
          priority: getPriority("plantedEvidence")
        }));
      }
    }
  }

  if (event.type === "vigilante_killed_innocent") {
    const actor = getPlayerById(room, event.actorId);
    const target = getPlayerById(room, event.targetId);
    const primaryObservers = getPotentialObservers(room, event.action);
    const fallbackObservers = shuffleForClues(
      room.players.filter(player => player.isAlive && player.id !== event.actorId && player.id !== event.targetId && isPlayerAwake(room, player)),
      rng
    );
    const observers = uniquePlayers([...primaryObservers, ...fallbackObservers]).slice(0, 2);

    debugLog("clues", "vigilante backfire observers selected", {
      actor: actor?.name || "",
      target: target?.name || "",
      observerCount: observers.length,
      observers: observers.map(player => player.name)
    });

    for (const observer of observers) {
      const text = renderObservationClue(room, observer, {
        action: event.action,
        profile: "vigilanteBackfire",
        place: target ? getPlayerHomeLabel(target, observer) : event.crimeScene || getActionRegionLabel(room, event.action),
        direction: getActionPathData(room, event.action).actionApproachDirection,
        players: actor ? [actor] : [],
        forceMinimumScore: Number(CONFIG.clues.vigilanteBackfireMinimumScore ?? 3),
        rng
      });

      if (text) {
        clues.push(privateClue(observer.id, text, {
          category: "vigilanteBackfire",
          priority: getPriority("vigilanteBackfire"),
          guaranteed: true
        }));
      } else {
        debugLog("clues", "vigilante backfire clue skipped", {
          observer: observer.name,
          actor: actor?.name || "",
          target: target?.name || "",
          reason: "empty_text"
        });
      }
    }
  }

  if (event.type === "obsessor_marked") {
    const actor = getPlayerById(room, event.actorId);
    const target = getPlayerById(room, event.targetId);

    if (actor && target) {
      clues.push(privateClue(actor.id, templateFromGroup("obsessorMarked", buildTemplateData(room, event.action, {
        targetPlayer: target.name
      }), rng), {
        category: "marked",
        priority: getPriority("marked")
      }));
      clues.push(privateClue(target.id, templateFromGroup("obsessorVictimMarked", buildTemplateData(room, event.action, {
        targetPlayer: target.name
      }), rng), {
        category: "marked",
        priority: getPriority("marked") - 5
      }));
    }
  }

  if (event.type === "possessed_condemned") {
    const actor = getPlayerById(room, event.actorId);
    const target = getPlayerById(room, event.targetId);

    if (actor) {
      clues.push(privateClue(actor.id, `${event.targetName || "Alguém"} foi condenado à sua linhagem.`, {
        category: "roleResult",
        priority: getPriority("roleResult")
      }));
    }

    if (target) {
      clues.push(privateClue(target.id, "Você sentiu sua antiga vontade se apagar. Agora você é Condenado.", {
        category: "roleResult",
        priority: getPriority("roleResult")
      }));
    }

    clues.push(publicClue("Algo pesado caiu sobre o bairro durante a noite.", {
      category: "haunted",
      priority: getPriority("haunted") + 3
    }));
  }

  if (event.type === "possessed_synergy") {
    const actor = getPlayerById(room, event.actorId);
    if (actor) {
      clues.push(privateClue(actor.id, "Você abriu uma sinergia com sua linhagem.", {
        category: "roleResult",
        priority: getPriority("roleResult")
      }));
    }
  }

  if (event.type === "possessed_successor_awakened") {
    const actor = getPlayerById(room, event.actorId);
    if (actor) {
      clues.push(privateClue(actor.id, "A possessão encontrou um novo corpo. Agora você é o Possuído.", {
        category: "roleResult",
        priority: getPriority("roleResult")
      }));
    }
  }

  if (event.type === "cultist_ritual_wrong_poi") {
    const actor = getPlayerById(room, event.actorId);
    if (actor) {
      clues.push(privateClue(actor.id, "O ritual não respondeu neste lugar.", {
        category: "roleResult",
        priority: getPriority("roleResult")
      }));
    }
  }

  if (event.type === "cultist_ritual_progress") {
    const actor = getPlayerById(room, event.actorId);
    const poi = POI_CONFIG.definitions?.[event.poiCode];
    const place = poi?.displayName || event.action?.targetPoiName || "um ponto de interesse";
    const progress = Number(event.ritualProgress || 0);
    const goal = Number(event.ritualGoal || 4);

    if (actor) {
      clues.push(privateClue(actor.id, `Você completou a etapa ${progress}/${goal} do ritual em ${place}.`, {
        category: "roleResult",
        priority: getPriority("roleResult")
      }));
    }

    const publicText = progress >= goal
      ? `Um sinal ritualístico se fechou em ${place}.`
      : progress >= 3
        ? `Um sinal ritualístico forte apareceu em ${place}.`
        : progress >= 2
          ? `Marcas estranhas apareceram em ${place}.`
          : `Algo estranho foi sentido em ${place}.`;

    clues.push(publicClue(publicText, {
      category: "haunted",
      priority: getPriority("haunted") + progress
    }));
  }

  if (event.type === "bounty_target_killed") {
    const actor = getPlayerById(room, event.actorId);
    if (actor) {
      clues.push(privateClue(actor.id, "Você eliminou seu alvo.", {
        category: "bounty",
        priority: getPriority("bounty")
      }));
    }
  }

  return clues;
}

function buildDetectiveClues(room, action, rng) {
  const actor = getPlayerById(room, action.actorId);
  if (!actor) return [];

  const forensicText = action.id === "investigateRegion"
    ? buildForensicDeathClue(room, action, "detective")
    : "";
  if (forensicText) {
    return [privateClue(actor.id, forensicText, {
      category: "roleResult",
      placeKey: `forensic:${action.targetPlayerId || action.targetPoiCode}`,
      priority: getPriority("roleResult") + 5
    })];
  }

  const regionText = buildRegionObservationClue(room, action, actor, {
    profile: "investigation",
    excludePlayerIds: [actor.id],
    includeRegionOwner: true,
    forceMinimumScore: 1,
    rng
  });

  if (!regionText) return [];

  return [privateClue(actor.id, regionText, {
    category: "roleResult",
    placeKey: `detect:${action.targetPlayerId || action.targetPoiCode}`,
    priority: getPriority("roleResult")
  })];
}

function buildMediumClues(room, action, rng) {
  const actor = getPlayerById(room, action.actorId);
  if (!actor) return [];

  const forensicText = buildForensicDeathClue(room, action, "medium");
  if (forensicText) {
    return [privateClue(actor.id, forensicText, {
      category: "roleResult",
      placeKey: `medium-forensic:${action.targetPlayerId || action.targetPoiCode}`,
      priority: getPriority("roleResult") + 5
    })];
  }

  const regionText = buildRegionObservationClue(room, action, actor, {
    profile: "medium",
    style: "supernatural",
    excludePlayerIds: [actor.id],
    includeRegionOwner: false,
    forceMinimumScore: 0,
    rng
  });

  if (!regionText) return [];

  return [privateClue(actor.id, regionText, {
    category: "roleResult",
    placeKey: `medium:${action.targetPlayerId || action.targetPoiCode}`,
    priority: getPriority("roleResult")
  })];
}

function buildForensicDeathClue(room, action, profile = "detective") {
  const victim = findDeathAtInvestigatedScene(room, action);
  if (!victim) return "";

  const place = getActionRegionLabel(room, action);
  const cause = String(victim.cause || "unknown");
  const supernatural = profile === "medium";

  if (cause === ACTION_CLASS.LITHOMANCER_GUESS) {
    return supernatural
      ? `A presença em ${place} parecia ter sido arrancada quando alguém reconheceu o papel da vítima.`
      : `A cena em ${place} indicava uma morte ligada ao papel da vítima, sem sinais comuns de luta.`;
  }

  if (cause === "lithomancer_backfire") {
    return supernatural
      ? `A presença em ${place} voltou contra quem tentou ler o destino de outra pessoa.`
      : `A cena em ${place} parecia um efeito reverso: alguém apostou errado e morreu por isso.`;
  }

  if (cause === "lawyer_client_death") {
    return supernatural
      ? `A presença em ${place} parecia presa a outra morte, como um vínculo rompido.`
      : `A cena em ${place} não parecia ataque direto; a morte veio como consequência de um vínculo.`;
  }

  if (cause === "obsessor_mark") {
    return supernatural
      ? `A presença em ${place} parecia antiga, como se a morte tivesse sido marcada antes.`
      : `A cena em ${place} sugeria uma morte preparada em outra noite.`;
  }

  if (cause === ACTION_CLASS.VIGILANTE_KILL) {
    return supernatural
      ? `A presença em ${place} tinha o peso de uma execução precipitada.`
      : `A cena em ${place} sugeria execução direta, não um assassinato comum de impostor.`;
  }

  if (cause === ACTION_CLASS.POSSESSED_KILL) {
    return supernatural
      ? `A presença em ${place} estava pesada demais, como se algo possuído tivesse passado por ali.`
      : `A cena em ${place} tinha sinais estranhos demais para uma morte comum.`;
  }

  if (cause === ACTION_CLASS.BOUNTY_KILL) {
    return supernatural
      ? `A presença em ${place} parecia precisa, quase como um contrato fechado.`
      : `A cena em ${place} indicava uma execução objetiva, com pouco improviso.`;
  }

  if (cause === ACTION_CLASS.AMBUSH_POI) {
    return supernatural
      ? `A presença em ${place} parecia ter sido interrompida no caminho, como uma emboscada.`
      : `A cena em ${place} indicava que a vítima foi pega ao passar por aquele local.`;
  }

  return supernatural
    ? `Houve uma morte em ${place}, mas a presença não revelou um método incomum.`
    : `Houve uma morte em ${place}, mas a cena não indicava uma causa especial.`;
}

function findDeathAtInvestigatedScene(room, action) {
  const targetPlayerId = String(action.targetPlayerId || "");
  const targetPoiCode = String(action.targetPoiCode || "");

  for (const victim of room.lastVictims || []) {
    if (targetPoiCode && String(victim.scenePoiCode || "") === targetPoiCode) {
      return victim;
    }

    const scenePlayerId = String(victim.scenePlayerId || victim.id || "");
    if (targetPlayerId && scenePlayerId === targetPlayerId) {
      return victim;
    }
  }

  return null;
}

function buildJournalistPublicClue(room, action, rng) {
  const detail = buildRegionObservationClue(room, action, null, {
    profile: "journalist",
    perspective: "public",
    excludePlayerIds: [action.actorId],
    includeRegionOwner: false,
    forceMinimumScore: 1,
    rng
  });

  const text = templateFromGroup("journalistPublished", buildTemplateData(room, action, {
    detail: detail || "nada fora do ordinário foi notado"
  }), rng);

  debugLog("journalist", "public report", {
    actorId: action.actorId,
    place: getActionRegionLabel(room, action),
    detail,
    text
  });

  return text;
}

function buildLineageSynergyClues(room, actions = []) {
  const clues = [];
  const actionByActorId = new Map(actions.map(action => [action.actorId, action]));
  const lineage = (room.players || []).filter(player => player.isAlive && isPossessedLineagePlayer(player));

  for (const player of lineage) {
    if (Number(player.synergyNightsRemaining || 0) <= 0) continue;

    for (const ally of lineage) {
      if (ally.id === player.id) continue;

      const allyAction = actionByActorId.get(ally.id);
      const text = allyAction
        ? `Sinergia: ${ally.name} agiu em ${getActionRegionLabel(room, allyAction, { recipient: player })}.`
        : `Sinergia: ${ally.name} não deixou atividade clara nesta noite.`;

      clues.push(privateClue(player.id, text, {
        category: "roleResult",
        priority: getPriority("roleResult") - 1
      }));
    }
  }

  return clues;
}

function buildEnvironmentalClues(room, actions = [], rng = Math.random) {
  const clues = [];
  const observerActions = actions
    .map(action => ({ action, player: getPlayerById(room, action.actorId) }))
    .filter(item => item.player?.isAlive && isAwakeAction(item.action));

  const traceActions = actions
    .filter(action => actionLeavesHome(action))
    .filter(action => !action.suppressesClues)
    .filter(action => getPlayerById(room, action.actorId)?.isAlive);

  for (const traceAction of traceActions) {
    const actor = getPlayerById(room, traceAction.actorId);
    const candidates = [];

    for (const observer of observerActions) {
      if (observer.player.id === actor.id) continue;

      const observerArea = buildObserverArea(room, observer.action, observer.player);
      const facts = buildTraceFacts(room, traceAction, actor);

      for (const fact of facts) {
        if (!areasOverlap(observerArea.roadCodes, fact.roadCodes)) continue;

        const score = getEffectiveClueScore(room, observer.player, observer.action, "ambient", {
          observedAction: traceAction,
          hasMovement: true
        });

        candidates.push({
          observer: observer.player,
          observerAction: observer.action,
          traceAction,
          actor,
          fact,
          score,
          priority: getPriority(fact.category) + score + getTraceNoiseBonus(traceAction)
        });
      }
    }

    const selected = shuffleForClues(candidates, rng)
      .sort((a, b) => b.priority - a.priority)
      .slice(0, getTraceBudget(traceAction));

    for (const candidate of selected) {
      const text = renderObservationClue(room, candidate.observer, {
        action: candidate.observerAction,
        observedAction: candidate.traceAction,
        profile: "ambient",
        factType: "movement",
        place: candidate.fact.place,
        direction: candidate.fact.direction,
        players: [candidate.actor],
        hasMovement: true,
        rng
      });

      if (!text) continue;

      clues.push(privateClue(candidate.observer.id, text, {
        category: candidate.fact.category,
        placeKey: candidate.fact.placeKey,
        priority: candidate.priority
      }));
    }
  }

  return clues;
}

function buildObserverQuietClues(room, actions = [], existingClues = [], rng = Math.random) {
  const clues = [];
  const playersWithExistingClue = new Set(
    existingClues
      .filter(clue => clue?.visibility === "private" && clue.playerId)
      .map(clue => clue.playerId)
  );

  for (const action of actions) {
    const player = getPlayerById(room, action.actorId);
    if (!player?.isAlive || !isAwakeAction(action)) continue;
    if (playersWithExistingClue.has(player.id)) continue;
    if (action.actionClass === ACTION_CLASS.JOURNALIST_REPORT) continue;

    const focus = getObserverFocus(room, action, player);
    const text = renderObservationClue(room, player, {
      action,
      profile: "watch",
      factType: "noActivity",
      place: focus.place,
      hasMovement: false,
      forceMinimumScore: 1,
      rng
    }) || templateFromGroup("ownStayHomeAwake", buildTemplateData(room, action), rng);

    if (!text) continue;

    clues.push(privateClue(player.id, text, {
      category: "watchQuiet",
      placeKey: focus.placeKey,
      priority: getPriority("watchQuiet")
    }));
  }

  return clues;
}

function buildRegionObservationClue(room, regionAction, recipient, options = {}) {
  const visitors = getVisitorsForRegionDetailed(room, regionAction)
    .filter(item => !(options.excludePlayerIds || []).includes(item.player.id));

  const target = getActionTargetPlayer(room, regionAction);
  const visitorPlayers = [];

  for (const item of visitors) {
    if (!visitorPlayers.some(player => player.id === item.player.id)) {
      visitorPlayers.push(item.player);
    }
  }

  const players = [...visitorPlayers];
  let factType = visitorPlayers.length > 0 ? "movement" : "noActivity";
  let hasMovement = visitorPlayers.length > 0;

  // Caso específico: investigar uma casa onde o próprio dono ficou em casa.
  // Isso não deve virar "Jogador X foi visto em casa de Jogador X".
  // Com score baixo vira presença ambígua; com score alto vira "não saiu de casa".
  if (options.includeRegionOwner && target && visitorPlayers.length <= 0) {
    const targetAction = room.nightActions?.[target.id];
    const targetStayedHome = !targetAction || !actionLeavesHome(targetAction);

    if (targetStayedHome) {
      players.push(target);
      factType = "ownerAtHome";
      hasMovement = false;
    }
  }

  const directionAction = visitors[0]?.action || regionAction;

  return renderObservationClue(room, recipient, {
    action: regionAction,
    observedAction: visitors[0]?.action || null,
    profile: options.profile,
    perspective: options.perspective,
    factType,
    place: getActionRegionLabel(room, regionAction, { recipient }),
    direction: getActionPathData(room, directionAction).actionApproachDirection,
    players,
    hasMovement,
    style: options.style,
    forceMinimumScore: options.forceMinimumScore,
    rng: options.rng || Math.random
  });
}

function getMovementDetailsForRegion(room, regionAction, options = {}, rng = Math.random) {
  return buildRegionObservationClue(room, regionAction, null, {
    profile: "journalist",
    excludePlayerIds: [options.excludeActorId, ...(options.excludePlayerIds || [])].filter(Boolean),
    includeRegionOwner: false,
    forceMinimumScore: 1,
    rng
  });
}

function renderObservationClue(room, recipient, options = {}) {
  const rng = options.rng || Math.random;
  const rawScore = getEffectiveClueScore(room, recipient, options.action, options.profile, {
    forceMinimumScore: options.forceMinimumScore,
    observedAction: options.observedAction,
    hasMovement: options.hasMovement
  });

  const players = normalizePlayers(options.players);
  const factType = normalizeFactType(options.factType, players, options.hasMovement);
  const score = normalizeScoreForFact(rawScore, factType, players);

  if (score <= 0 && rng() < Number(CONFIG.clues.scoreRules?.scoreZeroNoClueChance ?? 0.45)) {
    debugLog("clues", "observation skipped", {
      reason: "score_zero",
      recipient: recipient?.name || "",
      perspective: options.perspective === "public" ? "public" : "private",
      profile: options.profile || "generic",
      factType,
      place: options.place || "uma região do bairro",
      actionClass: options.action?.actionClass || "",
      observedActionClass: options.observedAction?.actionClass || "",
      microgameScore: options.action?.microgameScore ?? null,
      observedMicrogameScore: options.observedAction?.microgameScore ?? null,
      rawScore,
      finalScore: score
    });
    return "";
  }

  const style = options.style || getObservationStyle(recipient);
  const perspective = options.perspective === "public" ? "public" : "private";
  const templateStyle = getObservationTemplateStyle(style, perspective, factType);
  const fallbackStyle = getObservationTemplateStyle(style, perspective, "movement");
  const templates = CONFIG.clues.observationTemplates?.[templateStyle]?.[score]
    || CONFIG.clues.observationTemplates?.[fallbackStyle]?.[score]
    || CONFIG.clues.observationTemplates?.normal?.[score]
    || CONFIG.clues.observationTemplates?.normal?.[1]
    || ["Você percebeu algo em {place}."];

  const data = {
    place: options.place || "uma região do bairro",
    direction: options.direction || "entorno",
    players: formatList(players.map(player => player.name), "alguém"),
    player: players[0]?.name || "alguém",
    playersVerb: players.length === 1 ? "foi visto" : "foram vistos"
  };

  const text = renderInlineTemplate(pick(templates, rng), data);

  debugLog("clues", "observation rendered", {
    recipient: recipient?.name || "",
    perspective,
    profile: options.profile || "generic",
    factType,
    rawScore,
    score,
    observedActionClass: options.observedAction?.actionClass || "",
    observedMicrogameScore: options.observedAction?.microgameScore ?? null,
    place: data.place,
    direction: data.direction,
    players: data.players,
    text
  });

  return text;
}

function getEffectiveClueScore(room, recipient, action, profile = "generic", options = {}) {
  const rules = CONFIG.clues.scoreRules || {};
  const profileBias = Number(rules.profileBias?.[profile] ?? 0);
  const baseScore = Number.isFinite(Number(action?.microgameScore))
    ? Number(action.microgameScore)
    : Number(rules.defaultScore ?? 2);

  const utilityBias = Number(CONFIG.clues.utility?.scoreBias ?? rules.utilityBias ?? 0);

  let score = baseScore + profileBias + utilityBias;
  score -= getContestPenalty(room, action, options.observedAction, {
    hasMovement: options.hasMovement
  });

  if (isBlackoutActive(room)) {
    score += Number(rules.penalties?.blackout ?? -2);
  }

  if (recipient && hasEffect(recipient, EFFECT_KEY.PARANOIA)) {
    score += Number(rules.penalties?.paranoia ?? -1);
  }

  if (recipient && hasEffect(recipient, EFFECT_KEY.HAUNTED)) {
    score += Number(rules.penalties?.haunted ?? -2);
  }

  if (Number.isFinite(Number(options.forceMinimumScore))) {
    score = Math.max(score, Number(options.forceMinimumScore));
  }

  return clamp(Math.round(score), 0, 4);
}

function getContestPenalty(room, observerAction, observedAction, options = {}) {
  if (!observedAction || !options.hasMovement) return 0;
  if (observedAction.actorId === observerAction?.actorId) return 0;

  const observerScore = Number(observerAction?.microgameScore);
  const observedScore = Number(observedAction?.microgameScore);

  if (!Number.isFinite(observerScore) || !Number.isFinite(observedScore)) {
    return 0;
  }

  if (observerScore > observedScore) return 0;
  if (observerScore < observedScore) return observedScore - observerScore;

  const observer = getPlayerById(room, observerAction?.actorId);
  const observed = getPlayerById(room, observedAction?.actorId);

  if (observer?.alignment === ALIGNMENT.INNOCENT) return 0;
  if (observed?.alignment === ALIGNMENT.INNOCENT) return 1;

  if (isHostileOrDeceptiveAction(observedAction) && !isHostileOrDeceptiveAction(observerAction)) {
    return 0;
  }

  return 0;
}

function isAwakeAction(action = {}) {
  return action.actionClass !== ACTION_CLASS.REST;
}

function buildObserverArea(room, action, player) {
  const roadCodes = new Set();

  if (actionLeavesHome(action)) {
    for (const road of getActionPathData(room, action).roadCodes) {
      roadCodes.add(road);
    }

    for (const road of getTargetRegionRoads(room, action)) {
      roadCodes.add(road);
    }
  } else {
    for (const road of getPlayerSlot(player).homeRoads || []) {
      roadCodes.add(road);
    }
  }

  return { roadCodes };
}

function buildTraceFacts(room, action, actor) {
  const facts = [];
  const path = getActionPathData(room, action);
  const target = getActionTargetPlayer(room, action);
  const poi = getActionTargetPoi(action);

  for (const roadCode of path.roadCodes || []) {
    facts.push({
      category: "routeRoad",
      placeKey: `road:${roadCode}`,
      place: ROAD_NAMES[roadCode] || "uma rua próxima",
      direction: ROAD_DIRECTIONS[roadCode] || path.actionApproachDirection,
      roadCodes: [roadCode]
    });
  }

  if (target) {
    const roads = getPlayerSlot(target).homeRoads || [];
    facts.push({
      category: "targetHome",
      placeKey: `home:${target.id}`,
      place: getPlayerHomeLabel(target),
      direction: path.actionApproachDirection,
      roadCodes: roads
    });
  } else if (poi) {
    facts.push({
      category: "targetPoi",
      placeKey: `poi:${poi.code}`,
      place: poi.displayName || poi.visibleName || "um ponto de interesse",
      direction: path.actionApproachDirection,
      roadCodes: poi.nearRoads || []
    });
  }

  if (facts.length <= 0 && actor) {
    for (const roadCode of getPlayerSlot(actor).homeRoads || []) {
      facts.push({
        category: "routeRoad",
        placeKey: `road:${roadCode}`,
        place: ROAD_NAMES[roadCode] || "uma rua próxima",
        direction: ROAD_DIRECTIONS[roadCode] || "entorno",
        roadCodes: [roadCode]
      });
    }
  }

  return facts;
}

function getTargetRegionRoads(room, action) {
  const target = getActionTargetPlayer(room, action);
  if (target) return getPlayerSlot(target).homeRoads || [];

  const poi = getActionTargetPoi(action);
  if (poi) return poi.nearRoads || [];

  return [];
}

function getObserverFocus(room, action, player) {
  if (actionLeavesHome(action)) {
    const target = getActionTargetPlayer(room, action);
    if (target) {
      return {
        place: getPlayerHomeLabel(target, player),
        placeKey: `home:${target.id}`
      };
    }

    const poi = getActionTargetPoi(action);
    if (poi) {
      return {
        place: poi.displayName || poi.visibleName || "um ponto de interesse",
        placeKey: `poi:${poi.code}`
      };
    }
  }

  return {
    place: getPlayerHomeLabel(player, player),
    placeKey: `home:${player.id}`
  };
}

function areasOverlap(left = new Set(), right = []) {
  for (const item of right || []) {
    if (left.has(item)) return true;
  }

  return false;
}

function getTraceBudget(action = {}) {
  const score = getNormalizedActionScore(action);
  if (score <= 0) return 4;
  if (score === 1) return 3;
  if (score === 2) return 2;
  return 1;
}

function getTraceNoiseBonus(action = {}) {
  return 4 - getNormalizedActionScore(action);
}

function getNormalizedActionScore(action = {}) {
  const fallback = Number(CONFIG.clues.scoreRules?.defaultScore ?? 2);
  const score = Number.isFinite(Number(action.microgameScore))
    ? Number(action.microgameScore)
    : fallback;

  return clamp(Math.round(score), 0, 4);
}

function isHostileOrDeceptiveAction(action = {}) {
  return action.intent === ACTION_INTENT.HOSTILE || action.intent === ACTION_INTENT.DECEPTIVE;
}

function getObservationStyle(recipient) {
  if (recipient && hasEffect(recipient, EFFECT_KEY.HAUNTED)) return "supernatural";
  return "normal";
}

function getObservationTemplateStyle(style, perspective, factType = "movement") {
  const base = style === "supernatural" ? "Supernatural" : "Normal";
  const prefix = perspective === "public" ? "public" : "";
  const suffix = factType === "ownerAtHome"
    ? "OwnerAtHome"
    : factType === "noActivity"
      ? "NoActivity"
      : "";

  if (prefix) return `${prefix}${base}${suffix}`;
  return `${base.charAt(0).toLowerCase()}${base.slice(1)}${suffix}`;
}

function normalizeFactType(factType, players, hasMovement) {
  if (factType === "ownerAtHome") return "ownerAtHome";
  if (factType === "noActivity") return "noActivity";
  if (players.length <= 0 && hasMovement === false) return "noActivity";
  return "movement";
}

function normalizeScoreForFact(score, factType, players) {
  if (factType === "movement" && players.length <= 0 && score >= 4) {
    return 3;
  }

  return score;
}

function buildEffectClues(room, player, rng) {
  if (!player.isAlive) return [];
  const clues = [];

  if (hasEffect(player, EFFECT_KEY.HAUNTED)) {
    const fact = buildSyntheticObservationFact(room, rng);
    const syntheticAction = {
      microgameScore: Number(CONFIG.clues.scoreRules?.hauntedSyntheticScore ?? 1)
    };

    const text = renderObservationClue(room, player, {
      action: syntheticAction,
      profile: "hauntedSynthetic",
      place: fact.place,
      direction: fact.direction,
      players: fact.players,
      rng
    });

    if (text) {
      clues.push(privateClue(player.id, text, {
        category: "haunted",
        priority: getPriority("haunted")
      }));
    }
  }

  return clues;
}

function buildSyntheticObservationFact(room, rng) {
  const alive = room.players.filter(player => player.isAlive);
  const player = pick(alive, rng);
  const places = [
    ...Object.values(POI_CONFIG.definitions).map(poi => poi.displayName),
    ...Object.values(ROAD_NAMES)
  ];
  const directions = Object.values(ROAD_DIRECTIONS);

  return {
    place: pick(places, rng) || "uma região do bairro",
    direction: pick(directions, rng) || "entorno",
    players: player ? [player] : []
  };
}

function getFallbackRealPlace(room, rng = Math.random) {
  const places = [];

  const victim = room.lastVictims?.[0];
  if (victim?.name) places.push(`casa de ${victim.name}`);

  for (const poi of Object.values(POI_CONFIG.definitions || {})) {
    if (poi?.displayName) places.push(poi.displayName);
  }

  for (const player of room.players || []) {
    if (player?.name) places.push(`casa de ${player.name}`);
  }

  return pick(places, rng) || "uma região do bairro";
}

function getFallbackRealDirection(rng = Math.random) {
  return pick(Object.values(ROAD_DIRECTIONS), rng) || "entorno";
}

function getVisitorsForRegionDetailed(room, regionAction) {
  const regionPoi = getActionTargetPoi(regionAction);
  const regionTarget = getActionTargetPlayer(room, regionAction);

  return Object.values(room.nightActions || {})
    .filter(action => actionLeavesHome(action))
    .filter(action => !action.suppressesClues)
    .map(action => ({ action, player: getPlayerById(room, action.actorId) }))
    .filter(item => item.player)
    .filter(({ action }) => {
      const traceRoads = getActionTraceRoadCodes(room, action);

      if (regionPoi) {
        const regionRoads = regionPoi.nearRoads || [];
        return action.targetPoiCode === regionPoi.code || traceRoads.some(road => regionRoads.includes(road));
      }

      if (regionTarget) {
        const regionRoads = getPlayerSlot(regionTarget).homeRoads || [];
        return action.targetPlayerId === regionTarget.id || traceRoads.some(road => regionRoads.includes(road));
      }

      return false;
    });
}

function getVisitorsForRegion(room, regionAction) {
  return getVisitorsForRegionDetailed(room, regionAction).map(item => item.player);
}

function getPotentialObservers(room, action) {
  const traceRoads = getActionTraceRoadCodes(room, action);

  return room.players
    .filter(player => player.isAlive && player.id !== action.actorId)
    .filter(player => isPlayerAwake(room, player))
    .filter(player => {
      const slot = getPlayerSlot(player);
      return slot.homeRoads.some(road => traceRoads.includes(road));
    });
}

function getActionTraceRoadCodes(room, action) {
  const roads = new Set(getActionPathData(room, action).roadCodes || []);

  for (const road of getTargetRegionRoads(room, action)) {
    roads.add(road);
  }

  return [...roads];
}

function isPlayerAwake(room, player) {
  const action = room.nightActions?.[player.id];
  return Boolean(action && isAwakeAction(action));
}

function uniquePlayers(players) {
  const seen = new Set();
  const result = [];

  for (const player of players || []) {
    if (!player?.id || seen.has(player.id)) continue;
    seen.add(player.id);
    result.push(player);
  }

  return result;
}

function shuffleForClues(players, rng = Math.random) {
  const copy = [...(players || [])];

  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }

  return copy;
}

function normalizePlayers(players) {
  return (players || [])
    .filter(Boolean)
    .map(player => ({ id: player.id || player.name, name: player.name || String(player) }))
    .filter(player => player.name);
}

function renderInlineTemplate(text, data) {
  return String(text || "").replace(/\{([^}]+)\}/g, (_, key) => {
    const normalized = String(key || "").trim();
    return data[normalized] ?? data[normalized.replace(/\s+(.)/g, (_, letter) => letter.toUpperCase())] ?? `{${key}}`;
  });
}

function pick(items, rng = Math.random) {
  const list = (items || []).filter(item => item !== undefined && item !== null);
  if (list.length <= 0) return null;
  return list[Math.floor(rng() * list.length)];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  resolveNightClues,
  buildJournalistPublicClue,
  getMovementDetailsForRegion,
  buildRegionObservationClue,
  renderObservationClue,
  getEffectiveClueScore
};
