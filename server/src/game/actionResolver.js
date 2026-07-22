const CONFIG = require("../config");
const { ACTION_COMMAND, ACTION_CLASS, ALIGNMENT, WINNER, ROLE_KEY, SABOTAGE_KEY, MICROGAME_SCORE, EFFECT_KEY, TARGET_TYPE } = require("../constants");
const { ACTION_DEFINITIONS } = require("../data/actions");
const { ROLE_DEFINITIONS } = require("../data/roles");
const { addEffect } = require("../data/effects");
const { getPoiByCode, POI_CONFIG, ROAD_DIRECTIONS } = require("../data/map");
const { getAlivePlayers, findPlayer } = require("./roomManager");
const { actionLeavesHome, applySabotage, processRepairs } = require("./effectResolver");
const { getSabotagePool } = require("../data/sabotages");
const { resolveNightClues } = require("../clues/clueGenerator");
const { pick, shuffle } = require("./roleAssigner");
const {
  isPossessedLineagePlayer,
  turnPlayerIntoCondemned,
  promoteCondemnedIfNeeded,
  activateSynergy,
  decrementSynergy
} = require("./possessedLineage");
const { debugLog } = require("../debug");

const DIRECT_IMPOSTOR_ALLY_BLOCKED_ACTION_CLASSES = new Set([
  ACTION_CLASS.KILL_PLAYER,
  ACTION_CLASS.OBSESSOR_MARK,
  ACTION_CLASS.LITHOMANCER_GUESS
]);

const AREA_IMPOSTOR_ALLY_BLOCKED_ACTION_CLASSES = new Set([
  ACTION_CLASS.AMBUSH_POI
]);

function isDirectImpostorAllyBlockedAction(action = {}) {
  return DIRECT_IMPOSTOR_ALLY_BLOCKED_ACTION_CLASSES.has(action.actionClass);
}

function isAreaImpostorAllyBlockedAction(action = {}) {
  return AREA_IMPOSTOR_ALLY_BLOCKED_ACTION_CLASSES.has(action.actionClass);
}

function isImpostorAlly(actor, target) {
  return actor?.alignment === ALIGNMENT.IMPOSTOR && target?.alignment === ALIGNMENT.IMPOSTOR;
}

function canTargetDeadPlayerForAction(action = {}) {
  return action.targetType === TARGET_TYPE.REGION && (
    action.id === "investigateRegion" ||
    action.id === "mediumSensePresence"
  );
}

function resolveSubmittedTargetPlayer(room, payload = {}) {
  const targetId = String(payload.targetPlayerId || "");
  if (targetId) {
    const byId = findPlayer(room, targetId);
    if (byId) return byId;
  }

  const targetIndex = Number(payload.targetPlayerIndex || -1);
  if (targetIndex > 0) {
    return room.players.find(player => Number(player.index) === targetIndex) || null;
  }

  return null;
}

function getValidTargetPlayersForAction(room, actor, action = {}) {
  if (!room || !actor || !action) return [];

  const targetType = action.targetType || TARGET_TYPE.NONE;

  if (targetType !== TARGET_TYPE.PLAYER && targetType !== TARGET_TYPE.REGION) {
    return [];
  }

  return room.players.filter(target => {
    if (!target?.isAlive && !canTargetDeadPlayerForAction(action)) return false;

    if (!action.allowSelfTarget && target.id === actor.id) {
      return false;
    }

    if (targetType === TARGET_TYPE.PLAYER && isDirectImpostorAllyBlockedAction(action) && isImpostorAlly(actor, target)) {
      return false;
    }

    if (targetType === TARGET_TYPE.PLAYER && action.actionClass === ACTION_CLASS.POSSESSED_KILL && isPossessedLineagePlayer(actor) && isPossessedLineagePlayer(target)) {
      return false;
    }

    if (targetType === TARGET_TYPE.PLAYER && action.actionClass === ACTION_CLASS.POSSESSED_CONDEMN && isPossessedLineagePlayer(target)) {
      return false;
    }

    return true;
  });
}

function getValidTargetPlayerIdsForAction(room, actor, action = {}) {
  return getValidTargetPlayersForAction(room, actor, action).map(player => player.id);
}

function getValidTargetPlayerIndexesForAction(room, actor, action = {}) {
  return getValidTargetPlayersForAction(room, actor, action).map(player => Number(player.index));
}

function validateSubmittedTarget(room, actor, action = {}, payload = {}) {
  const targetType = action.targetType || TARGET_TYPE.NONE;

  if (targetType !== TARGET_TYPE.PLAYER && targetType !== TARGET_TYPE.REGION) {
    return { ok: true, target: null };
  }

  const target = resolveSubmittedTargetPlayer(room, payload);

  if (!target) {
    if (targetType === TARGET_TYPE.REGION && (payload.targetPoiCode || Number(payload.targetPoiIndex || -1) > 0)) {
      return { ok: true, target: null };
    }

    return { ok: false, error: "INVALID_TARGET", target: null };
  }

  const validIds = new Set(getValidTargetPlayerIdsForAction(room, actor, action));

  if (!validIds.has(target.id)) {
    if (target.id === actor.id && !action.allowSelfTarget) {
      return { ok: false, error: "INVALID_SELF_TARGET", target };
    }

    if (isDirectImpostorAllyBlockedAction(action) && isImpostorAlly(actor, target)) {
      return { ok: false, error: "INVALID_IMPOSTOR_ALLY_TARGET", target };
    }

    return { ok: false, error: "INVALID_TARGET", target };
  }

  return { ok: true, target };
}

function normalizeRoleGuess(rawGuess) {
  const value = normalizeText(rawGuess);
  if (!value) return null;

  for (const role of Object.values(ROLE_DEFINITIONS)) {
    if (!role?.id) continue;
    const aliases = [
      role.id,
      role.name,
      role.name?.replace(/\s+/g, ""),
      role.name?.replace(/\s+/g, "-")
    ];

    if (aliases.some(alias => normalizeText(alias) === value)) {
      return role;
    }
  }

  return null;
}

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function getResolvedActionsForPlayer(room, player) {
  const role = ROLE_DEFINITIONS[player.roleId] || ROLE_DEFINITIONS[ROLE_KEY.RESIDENT];
  const result = {};

  for (const [slot, actionId] of Object.entries(role.actionSlots || {})) {
    const resolvedActionId = player.roleId === ROLE_KEY.POSSESSED && slot === "action2" && player.hasUsedCondemn
      ? "possessedSynergy"
      : actionId;
    const action = ACTION_DEFINITIONS[resolvedActionId] || ACTION_DEFINITIONS.none;
    result[slot] = serializeActionForSnapshot(room, action, player, slot);
  }

  return {
    action1: result.action1 || serializeActionForSnapshot(room, ACTION_DEFINITIONS.stayHomeAwake, player, "action1"),
    action2: result.action2 || serializeActionForSnapshot(room, ACTION_DEFINITIONS.none, player, "action2"),
    sleep: result.sleep || serializeActionForSnapshot(room, ACTION_DEFINITIONS.sleep, player, "sleep")
  };
}

function serializeActionForSnapshot(room, action, player, slot) {
  const difficultyBonus = isDifficultySabotageActiveForRoom(room) && !action.skipsMicrogame
    ? CONFIG.microgame.sabotageDifficultyBonus
    : 0;

  return {
    slot,
    id: action.id,
    actionClass: action.actionClass,
    intent: action.intent,
    label: action.label,
    description: action.description,
    energyCost: action.energyCost,
    energyGain: action.energyGain,
    targetType: action.targetType,
    allowSelfTarget: Boolean(action.allowSelfTarget),
    defaultTargetSelf: Boolean(action.defaultTargetSelf),
    microgameCategory: action.microgameCategory,
    microgamePool: action.microgamePool,
    microgameTimeLimit: action.microgameTimeLimit,
    microgameDifficulty: Number(action.microgameDifficulty || 0) + difficultyBonus,
    validTargetPlayerIds: getValidTargetPlayerIdsForAction(room, player, action),
    validTargetPlayerIndexes: getValidTargetPlayerIndexesForAction(room, player, action),
    implemented: action.implemented !== false,
    skipsMicrogame: Boolean(action.skipsMicrogame),
    leavesHome: Boolean(action.leavesHome)
  };
}

function submitActivityResult(room, player, payload = {}) {
  if (!room || !player) {
    return { ok: false, error: "INVALID_CONTEXT" };
  }

  if (!player.isAlive) {
    return { ok: false, error: "PLAYER_DEAD" };
  }

  const slot = String(payload.actionCommand || "");
  const actions = getResolvedActionsForPlayer(room, player);
  const actionDefinition = actions[slot];

  if (!actionDefinition || actionDefinition.implemented === false) {
    return { ok: false, error: "ACTION_NOT_AVAILABLE" };
  }

  if (room.nightActions[player.id]) {
    return { ok: false, error: "ACTION_ALREADY_SUBMITTED" };
  }

  const targetValidation = validateSubmittedTarget(room, player, actionDefinition, payload);

  if (!targetValidation.ok) {
    debugLog("validation", "activity target rejected", {
      roomCode: room.roomCode,
      actor: player.name,
      actorRole: player.roleName,
      actorAlignment: player.alignment,
      actionId: actionDefinition.id,
      actionClass: actionDefinition.actionClass,
      target: targetValidation.target?.name || String(payload.targetPlayerId || payload.targetPlayerIndex || ""),
      targetRole: targetValidation.target?.roleName || "",
      targetAlignment: targetValidation.target?.alignment ?? "",
      error: targetValidation.error
    });

    return { ok: false, error: targetValidation.error };
  }

  const guessedRole = actionDefinition.actionClass === ACTION_CLASS.LITHOMANCER_GUESS
    ? normalizeRoleGuess(payload.guessedRoleId || payload.guessedRoleKey || payload.guessedRoleName)
    : null;
  const theftValue = actionDefinition.actionClass === ACTION_CLASS.THIEF_ROB
    ? clamp(Math.round(Number(payload.theftValue || 0)), 0, 3)
    : 0;

  if (actionDefinition.actionClass === ACTION_CLASS.LITHOMANCER_GUESS && !guessedRole) {
    return { ok: false, error: "INVALID_ROLE_GUESS" };
  }

  const energyCost = Number(actionDefinition.energyCost || 0);

  if (player.energy < energyCost) {
    return { ok: false, error: "INSUFFICIENT_ENERGY" };
  }

  const microgameScore = normalizeMicrogameScore(payload, actionDefinition);
  const success = microgameScore > MICROGAME_SCORE.CRITICAL_FAIL;

  player.energy = clamp(
    Number(player.energy || 0) - energyCost + Number(actionDefinition.energyGain || 0),
    CONFIG.player.minEnergy,
    player.maxEnergy
  );

  const action = {
    ...actionDefinition,
    actorId: player.id,
    actorName: player.name,
    actionCommand: slot,
    targetType: actionDefinition.targetType,
    targetPlayerId: targetValidation.target?.id || String(payload.targetPlayerId || ""),
    targetPlayerIndex: targetValidation.target?.index ?? Number(payload.targetPlayerIndex || -1),
    targetPlayerName: targetValidation.target?.name || resolveTargetPlayerName(room, payload.targetPlayerId),
    targetPoiIndex: Number(payload.targetPoiIndex || -1),
    targetPoiCode: String(payload.targetPoiCode || ""),
    targetPoiType: String(payload.targetPoiType || "none"),
    targetPoiName: resolveTargetPoiName(payload.targetPoiCode),
    guessedRoleId: guessedRole?.id || "",
    guessedRoleName: guessedRole?.name || "",
    theftValue,
    resultCommand: String(payload.resultCommand || ACTION_COMMAND.PASS),
    skippedMicrogame: Boolean(payload.skippedMicrogame),
    microgameScore,
    microgameId: String(payload.microgameId || "none"),
    microgameSeed: Number(payload.microgameSeed || 0),
    success,
    submittedAt: Date.now()
  };

  debugLog("actions", "activity submitted", {
    roomCode: room.roomCode,
    actor: player.name,
    actionId: action.id,
    actionClass: action.actionClass,
    targetPlayer: action.targetPlayerName,
    targetPoi: action.targetPoiCode,
    microgameScore: action.microgameScore,
    success: action.success,
    energy: player.energy,
    maxEnergy: player.maxEnergy
  });

  if (!action.success && action.actionClass !== ACTION_CLASS.REST) {
    room.nightActions[player.id] = action;
    return {
      ok: true,
      energy: player.energy,
      maxEnergy: player.maxEnergy,
      warning: "MICROGAME_CRITICAL_FAIL"
    };
  }

  if (action.actionClass === ACTION_CLASS.PLANT_EVIDENCE && player.neutralTargetId) {
    action.targetPlayerId = player.neutralTargetId;
    action.targetPlayerName = resolveTargetPlayerName(room, player.neutralTargetId);
  }

  room.nightActions[player.id] = action;

  return {
    ok: true,
    energy: player.energy,
    maxEnergy: player.maxEnergy
  };
}

function resolveNight(room, rng = Math.random) {
  debugLog("events", "resolve night start", {
    roomCode: room.roomCode,
    dayNumber: room.dayNumber,
    actionCount: Object.keys(room.nightActions || {}).length
  });

  room.nightEvents = [];
  room.nightResultAnnouncements = [];
  room.lastNightPrivateCluesByPlayerId = {};
  room.lastPublishedPublicClues = [];
  room.lastNightPublicText = [];
  room.hasNightResult = true;
  room.hasVictim = false;
  room.lastVictims = [];
  room.lastVictimIndex = -1;
  room.lastVictimName = "";

  const actions = Object.values(room.nightActions || {});

  processRepairs(room, actions, room.nightEvents, rng);
  processDelayedDeaths(room, room.nightEvents);
  processProtectionsAndKills(room, actions, room.nightEvents, rng);
  processSpecialActions(room, actions, room.nightEvents, rng);
  promoteCondemnedIfNeeded(room, room.nightEvents);

  debugLog("events", "night events resolved", {
    roomCode: room.roomCode,
    events: room.nightEvents.map(event => ({
      type: event.type,
      actorId: event.actorId,
      targetId: event.targetId,
      sabotageId: event.sabotageId
    }))
  });

  const clueResult = resolveNightClues({
    room,
    actions,
    events: room.nightEvents,
    rng
  });

  room.lastNightPrivateCluesByPlayerId = clueResult.privateByPlayerId;
  room.privateCluesByPlayerId = clueResult.privateByPlayerId;
  room.lastPublishedPublicClues = clueResult.publicClues;
  decrementSynergy(room);

  debugLog("clues", "night clues resolved", {
    roomCode: room.roomCode,
    privateByPlayerId: clueResult.privateByPlayerId,
    publicClues: clueResult.publicClues
  });

  room.lastNightPublicText = [
    ...room.lastPublishedPublicClues,
    ...room.nightResultAnnouncements
  ].filter(Boolean);

  finalizeVictimSummary(room);
  room.nightActions = {};
}

function processDelayedDeaths(room, events) {
  const remaining = [];

  for (const delayed of room.delayedDeaths || []) {
    if (Number(delayed.dueNight) > Number(room.dayNumber)) {
      remaining.push(delayed);
      continue;
    }

    const target = findPlayer(room, delayed.targetId);
    const actor = findPlayer(room, delayed.actorId);

    if (!target || !target.isAlive) {
      continue;
    }

    if (actor && isImpostorAlly(actor, target)) {
      debugLog("validation", "delayed obsessor death blocked against impostor ally", {
        actor: actor.name,
        actorRole: actor.roleName,
        target: target.name,
        targetRole: target.roleName
      });
      continue;
    }

    killPlayer(room, target, {
      killerId: actor?.id || delayed.actorId,
      killerName: actor?.name || "alguém",
      cause: "obsessor_mark",
      silent: true
    });
    killLinkedLawyers(room, target, events, { source: "obsessor_mark", silent: true });

    events.push({
      type: "player_killed",
      silent: true,
      targetId: target.id,
      actorId: actor?.id || delayed.actorId,
      cause: "obsessor_mark"
    });
  }

  room.delayedDeaths = remaining;
}

function processProtectionsAndKills(room, actions, events, rng) {
  const protectedIds = new Set(
    actions
      .filter(action => action.success && action.actionClass === ACTION_CLASS.PROTECT_PLAYER)
      .map(action => action.targetPlayerId || action.actorId)
      .filter(Boolean)
  );

  const killClasses = new Set([
    ACTION_CLASS.KILL_PLAYER,
    ACTION_CLASS.VIGILANTE_KILL,
    ACTION_CLASS.POSSESSED_KILL,
    ACTION_CLASS.BOUNTY_KILL
  ]);

  for (const action of actions) {
    if (!action.success || !killClasses.has(action.actionClass)) {
      continue;
    }

    const target = findPlayer(room, action.targetPlayerId);
    const actor = findPlayer(room, action.actorId);

    if (!target || !actor || !target.isAlive) {
      continue;
    }

    if (isDirectImpostorAllyBlockedAction(action) && isImpostorAlly(actor, target)) {
      debugLog("validation", "night kill blocked against impostor ally", {
        actor: actor.name,
        actorRole: actor.roleName,
        target: target.name,
        targetRole: target.roleName,
        actionClass: action.actionClass
      });
      continue;
    }

    if (action.actionClass === ACTION_CLASS.POSSESSED_KILL && isPossessedLineagePlayer(actor) && isPossessedLineagePlayer(target)) {
      debugLog("validation", "possessed lineage kill blocked against ally", {
        actor: actor.name,
        actorRole: actor.roleName,
        target: target.name,
        targetRole: target.roleName
      });
      continue;
    }

    const targetAction = room.nightActions[target.id];

    if (targetAction && actionLeavesHome(targetAction)) {
      events.push({
        type: "target_not_home",
        action,
        actorId: actor.id,
        actorName: actor.name,
        targetId: target.id,
        targetName: target.name,
        targetActionClass: targetAction.actionClass
      });

      debugLog("events", "kill missed because target left home", {
        actor: actor.name,
        target: target.name,
        targetActionClass: targetAction.actionClass
      });

      if (CONFIG.effects.failedKillAtEmptyHomeAppliesParanoia) {
        addEffect(target, EFFECT_KEY.PARANOIA, {
          startedNight: room.dayNumber,
          source: "failed_home_kill",
          actorId: actor.id
        });

        debugLog("effects", "paranoia applied after empty-home attack", {
          target: target.name,
          actor: actor.name,
          source: "failed_home_kill"
        });
      }

      continue;
    }

    if (protectedIds.has(target.id)) {
      events.push({ type: "protected_attack", action, actorId: actor.id, targetId: target.id });
      continue;
    }

    killPlayer(room, target, {
      killerId: actor.id,
      killerName: actor.name,
      cause: action.actionClass,
      actionId: action.id,
      scenePlayerId: target.id
    });
    killLinkedLawyers(room, target, events, { source: action.actionClass });

    events.push({ type: "player_killed", action, actorId: actor.id, targetId: target.id, cause: action.actionClass });

    debugLog("events", "player killed", {
      actor: actor.name,
      actorRole: actor.roleName,
      actorAlignment: actor.alignment,
      target: target.name,
      targetRole: target.roleName,
      targetAlignment: target.alignment,
      cause: action.actionClass
    });

    if (action.actionClass === ACTION_CLASS.VIGILANTE_KILL && target.alignment === ALIGNMENT.INNOCENT) {
      events.push({
        type: "vigilante_killed_innocent",
        action,
        actorId: actor.id,
        actorName: actor.name,
        targetId: target.id,
        targetName: target.name,
        crimeScene: `casa de ${target.name}`
      });
    }

    if (action.actionClass === ACTION_CLASS.BOUNTY_KILL && actor.neutralTargetId === target.id) {
      actor.hasWonNeutral = true;
      room.winner = WINNER.NEUTRAL;
      room.neutralWinnerId = actor.id;
      room.neutralWinnerName = actor.name;
      events.push({ type: "bounty_target_killed", action, actorId: actor.id, targetId: target.id });
    }
  }

  for (const action of actions) {
    if (!action.success || action.actionClass !== ACTION_CLASS.AMBUSH_POI) continue;
    resolveAmbushPoi(room, action, protectedIds, events, rng);
  }
}

function processSpecialActions(room, actions, events, rng) {
  for (const action of actions) {
    if (!action.success) continue;

    if (action.actionClass === ACTION_CLASS.SABOTAGE) {
      const sabotageId = pick(getSabotagePool(), rng);
      const actor = findPlayer(room, action.actorId);
      if (sabotageId && actor) {
        applySabotage(room, sabotageId, actor, rng);
        events.push({ type: "sabotage_started", action, sabotageId, actorId: actor.id });
      }
    }

    if (action.actionClass === ACTION_CLASS.OBSESSOR_MARK) {
      const target = findPlayer(room, action.targetPlayerId);
      const actor = findPlayer(room, action.actorId);
      if (target?.isAlive && actor && isImpostorAlly(actor, target)) {
        debugLog("validation", "obsessor mark blocked against impostor ally", {
          actor: actor.name,
          actorRole: actor.roleName,
          target: target.name,
          targetRole: target.roleName
        });
        continue;
      }

      if (target?.isAlive) {
        room.delayedDeaths.push({
          targetId: target.id,
          actorId: action.actorId,
          dueNight: room.dayNumber + 1,
          silent: true
        });
        events.push({ type: "obsessor_marked", action, actorId: action.actorId, targetId: target.id });
      }
    }

    if (action.actionClass === ACTION_CLASS.CULTIST_RITUAL_STEP) {
      const actor = findPlayer(room, action.actorId);
      if (!actor?.isAlive) continue;

      const ritualPath = Array.isArray(actor.cultistRitualPoiCodes) ? actor.cultistRitualPoiCodes : [];
      const progress = Number(actor.cultistRitualProgress || 0);
      const expectedPoiCode = ritualPath[progress] || "";
      const chosenPoiCode = String(action.targetPoiCode || "");
      const correctPoi = expectedPoiCode && chosenPoiCode === expectedPoiCode;

      if (!correctPoi) {
        events.push({
          type: "cultist_ritual_wrong_poi",
          action,
          actorId: actor.id,
          expectedPoiCode,
          chosenPoiCode
        });
        continue;
      }

      actor.cultistRitualProgress = progress + 1;

      events.push({
        type: "cultist_ritual_progress",
        action,
        actorId: actor.id,
        ritualProgress: actor.cultistRitualProgress,
        ritualGoal: 4,
        poiCode: chosenPoiCode
      });

      if (actor.cultistRitualProgress >= 4) {
        actor.hasWonNeutral = true;
        room.winner = WINNER.NEUTRAL;
        room.neutralWinnerId = actor.id;
        room.neutralWinnerName = actor.name;
        events.push({ type: "cultist_ritual_completed", action, actorId: actor.id });
      }
    }

    if (action.actionClass === ACTION_CLASS.LITHOMANCER_GUESS) {
      const actor = findPlayer(room, action.actorId);
      const target = findPlayer(room, action.targetPlayerId);

      if (!actor?.isAlive || !target?.isAlive) continue;

      const guessedRoleId = String(action.guessedRoleId || "");
      const correctGuess = guessedRoleId && target.roleId === guessedRoleId;

      if (correctGuess) {
        action.suppressesClues = true;
        killPlayer(room, target, {
          killerId: actor.id,
          killerName: actor.name,
          cause: ACTION_CLASS.LITHOMANCER_GUESS,
          actionId: action.id,
          scenePlayerId: target.id,
          silent: true
        });
        killLinkedLawyers(room, target, events, { source: ACTION_CLASS.LITHOMANCER_GUESS, silent: true });
        events.push({
          type: "lithomancer_correct",
          action,
          actorId: actor.id,
          targetId: target.id,
          guessedRoleId,
          silent: true
        });
        continue;
      }

      killPlayer(room, actor, {
        cause: "lithomancer_backfire",
        actionId: action.id,
        scenePlayerId: actor.id
      });
      killLinkedLawyers(room, actor, events, { source: "lithomancer_backfire" });
      events.push({
        type: "lithomancer_backfire",
        action,
        actorId: actor.id,
        targetId: target.id,
        guessedRoleId
      });
    }

    if (action.actionClass === ACTION_CLASS.POSSESSED_CONDEMN) {
      const actor = findPlayer(room, action.actorId);
      const target = findPlayer(room, action.targetPlayerId);

      if (actor?.isAlive && target?.isAlive && turnPlayerIntoCondemned(room, actor, target)) {
        events.push({
          type: "possessed_condemned",
          action,
          actorId: actor.id,
          targetId: target.id,
          targetName: target.name,
          previousRoleName: target.previousRoleName,
          previousAlignment: target.previousAlignment
        });
      }
    }

    if (action.actionClass === ACTION_CLASS.POSSESSED_SYNERGY) {
      const actor = findPlayer(room, action.actorId);
      if (actor?.isAlive && activateSynergy(actor, 2)) {
        events.push({
          type: "possessed_synergy",
          action,
          actorId: actor.id
        });
      }
    }

    if (action.actionClass === ACTION_CLASS.DETECT_REGION) {
      events.push({ type: "detective_result", action, actorId: action.actorId });
    }

    if (action.actionClass === ACTION_CLASS.MEDIUM_SENSE_REGION) {
      events.push({ type: "medium_result", action, actorId: action.actorId });
    }

    if (action.actionClass === ACTION_CLASS.JOURNALIST_REPORT) {
      events.push({ type: "journalist_publish", action, actorId: action.actorId });
    }

    if (action.actionClass === ACTION_CLASS.PLANT_EVIDENCE) {
      const actor = findPlayer(room, action.actorId);
      const target = findPlayer(room, actor?.neutralTargetId);
      if (actor && target) {
        const observers = shuffle(
          getAlivePlayers(room)
            .filter(player => player.id !== actor.id && player.id !== target.id)
            .filter(player => isPlayerAwake(room, player)),
          rng
        ).slice(0, 2);
        const fabricatedScene = pickFabricatedCrimeScene(room, rng);
        events.push({
          type: "planted_evidence",
          action,
          actorId: actor.id,
          framedPlayerId: target.id,
          framedPlayerName: target.name,
          observerIds: observers.map(player => player.id),
          crimeScene: fabricatedScene.place,
          adjacentCrimeSceneDirection: fabricatedScene.direction
        });
      }
    }
  }
}

function resolveAmbushPoi(room, action, protectedIds, events, rng) {
  const actor = findPlayer(room, action.actorId);
  if (!actor) return;

  const candidates = Object.values(room.nightActions || {})
    .filter(candidateAction => candidateAction.actorId !== actor.id)
    .filter(candidateAction => candidateAction.targetPoiCode === action.targetPoiCode)
    .filter(candidateAction => actionLeavesHome(candidateAction))
    .map(candidateAction => findPlayer(room, candidateAction.actorId))
    .filter(player => player?.isAlive)
    .filter(player => !(isAreaImpostorAllyBlockedAction(action) && isImpostorAlly(actor, player)));

  const target = pick(candidates, rng);
  if (!target) return;

  if (protectedIds.has(target.id)) {
    events.push({ type: "protected_attack", action, actorId: actor.id, targetId: target.id });
    return;
  }

  killPlayer(room, target, {
    killerId: actor.id,
    killerName: actor.name,
    cause: ACTION_CLASS.AMBUSH_POI,
    actionId: action.id,
    scenePoiCode: action.targetPoiCode
  });
  killLinkedLawyers(room, target, events, { source: ACTION_CLASS.AMBUSH_POI });

  events.push({ type: "player_killed", action, actorId: actor.id, targetId: target.id, cause: ACTION_CLASS.AMBUSH_POI });

  debugLog("events", "ambush killed player", {
    actor: actor.name,
    actorRole: actor.roleName,
    target: target.name,
    targetRole: target.roleName,
    targetPoiCode: action.targetPoiCode
  });
}

function killPlayer(room, target, info = {}) {
  target.isAlive = false;
  target.publicStatus = info.cause === "votedOut" ? "votedOut" : "nightDead";
  target.deathInfo = {
    ...info,
    night: room.dayNumber
  };
  room.hasVictim = true;
  room.lastVictims.push({ id: target.id, index: target.index, name: target.name, ...info });
}

function killLinkedLawyers(room, client, events = [], info = {}) {
  if (!room || !client) return [];

  const killed = [];
  let queue = [client];
  const processedClientIds = new Set();

  while (queue.length > 0) {
    const deadClient = queue.shift();
    if (!deadClient?.id || processedClientIds.has(deadClient.id)) continue;
    processedClientIds.add(deadClient.id);

    const lawyers = (room.players || [])
      .filter(player => player.isAlive)
      .filter(player => player.roleId === ROLE_KEY.LAWYER)
      .filter(player => player.neutralTargetId === deadClient.id);

    for (const lawyer of lawyers) {
      killPlayer(room, lawyer, {
        cause: "lawyer_client_death",
        linkedClientId: deadClient.id,
        linkedClientName: deadClient.name,
        source: info.source || deadClient.deathInfo?.cause || "client_death",
        scenePlayerId: lawyer.id,
        silent: Boolean(info.silent)
      });

      killed.push(lawyer);
      queue.push(lawyer);
      events.push({
        type: "lawyer_client_death",
        targetId: lawyer.id,
        targetName: lawyer.name,
        clientId: deadClient.id,
        clientName: deadClient.name,
        source: info.source || deadClient.deathInfo?.cause || "client_death",
        silent: Boolean(info.silent)
      });
    }
  }

  return killed;
}

function finalizeVictimSummary(room) {
  if (room.lastVictims.length > 0) {
    room.hasVictim = true;
    room.lastVictimIndex = room.lastVictims[0].index;
    room.lastVictimName = room.lastVictims.map(victim => victim.name).join(", ");
  }
}

function normalizeMicrogameScore(payload, actionDefinition) {
  if (actionDefinition.skipsMicrogame || payload.skippedMicrogame) {
    return CONFIG.microgame.score.skipped;
  }

  const explicitScore = Number(payload.microgameScore);
  if (Number.isFinite(explicitScore)) {
    return clamp(Math.round(explicitScore), CONFIG.microgame.score.min, CONFIG.microgame.score.max);
  }

  if (String(payload.resultCommand) === ACTION_COMMAND.FAIL) {
    return CONFIG.microgame.score.defaultFail;
  }

  return CONFIG.microgame.score.defaultPass;
}

function resolveTargetPlayerName(room, targetPlayerId) {
  return findPlayer(room, targetPlayerId)?.name || "";
}

function resolveTargetPoiName(code) {
  return getPoiByCode(code)?.displayName || "";
}

function pickFabricatedCrimeScene(room, rng = Math.random) {
  const places = [];

  const victim = room.lastVictims?.[0];
  if (victim?.name) {
    places.push(`casa de ${victim.name}`);
  }

  for (const poi of Object.values(POI_CONFIG.definitions || {})) {
    if (poi?.displayName) places.push(poi.displayName);
  }

  for (const player of room.players || []) {
    if (player?.name) places.push(`casa de ${player.name}`);
  }

  return {
    place: pick(places, rng) || "uma região do bairro",
    direction: pick(Object.values(ROAD_DIRECTIONS), rng) || "entorno"
  };
}

function isPlayerAwake(room, player) {
  const action = room.nightActions?.[player.id];
  return Boolean(action && action.actionClass !== ACTION_CLASS.REST);
}

function isDifficultySabotageActiveForRoom(room) {
  return require("./effectResolver").isMicrogameDifficultyActive(room);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  getResolvedActionsForPlayer,
  serializeActionForSnapshot,
  submitActivityResult,
  resolveNight,
  killPlayer,
  killLinkedLawyers,
  actionLeavesHome,
  getValidTargetPlayersForAction,
  getValidTargetPlayerIdsForAction,
  getValidTargetPlayerIndexesForAction,
  validateSubmittedTarget
};
