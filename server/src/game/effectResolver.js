const CONFIG = require("../config");
const { EFFECT_KEY, SABOTAGE_KEY, ACTION_CLASS } = require("../constants");
const { addEffect, removeEffect, hasEffect } = require("../data/effects");
const { getPoiByCode } = require("../data/map");
const { templateFromGroup } = require("../clues/clueTemplates");
const { debugLog } = require("../debug");

function applySabotage(room, sabotageId, actor, rng = Math.random) {
  if (sabotageId === SABOTAGE_KEY.BLACKOUT) {
    const repairPoiCode = CONFIG.sabotages[SABOTAGE_KEY.BLACKOUT].repairPoiCode;

    room.sabotages[SABOTAGE_KEY.BLACKOUT] = {
      id: SABOTAGE_KEY.BLACKOUT,
      active: true,
      actorId: actor.id,
      startedNight: room.dayNumber,
      repairPoiCode,
      canRepairFromNight: room.dayNumber + Number(CONFIG.sabotages[SABOTAGE_KEY.BLACKOUT].canRepairAfterNights || 1)
    };

    room.nightResultAnnouncements.push(templateFromGroup("sabotageBlackoutStarted", {
      poi: getPoiByCode(repairPoiCode)?.displayName || repairPoiCode
    }, rng));

    debugLog("effects", "blackout started", {
      actor: actor.name,
      repairPoiCode,
      canRepairFromNight: room.sabotages[SABOTAGE_KEY.BLACKOUT].canRepairFromNight
    });

    return;
  }

  if (sabotageId === SABOTAGE_KEY.MICROGAME_DIFFICULTY) {
    room.sabotages[SABOTAGE_KEY.MICROGAME_DIFFICULTY] = {
      id: SABOTAGE_KEY.MICROGAME_DIFFICULTY,
      active: true,
      actorId: actor.id,
      startedNight: room.dayNumber,
      activeNight: room.dayNumber + 1,
      expiresAfterNight: room.dayNumber + Number(CONFIG.sabotages[SABOTAGE_KEY.MICROGAME_DIFFICULTY].durationNights || 1)
    };

    room.nightResultAnnouncements.push(templateFromGroup("sabotageMicrogameDifficultyStarted", {}, rng));

    debugLog("effects", "microgame difficulty sabotage started", {
      actor: actor.name,
      activeNight: room.sabotages[SABOTAGE_KEY.MICROGAME_DIFFICULTY].activeNight,
      expiresAfterNight: room.sabotages[SABOTAGE_KEY.MICROGAME_DIFFICULTY].expiresAfterNight
    });

    return;
  }

  if (sabotageId === SABOTAGE_KEY.CURSE) {
    const count = Number(CONFIG.sabotages[SABOTAGE_KEY.CURSE].affectedPlayerCount || 2);
    const candidates = shuffle(room.players.filter(player => player.isAlive && player.id !== actor.id), rng).slice(0, count);
    const repairPoiCode = CONFIG.sabotages[SABOTAGE_KEY.CURSE].repairPoiCode;

    for (const player of candidates) {
      addEffect(player, EFFECT_KEY.HAUNTED, { startedNight: room.dayNumber, source: SABOTAGE_KEY.CURSE, repairPoiCode });
    }

    room.sabotages[SABOTAGE_KEY.CURSE] = {
      id: SABOTAGE_KEY.CURSE,
      active: true,
      actorId: actor.id,
      startedNight: room.dayNumber,
      repairPoiCode,
      affectedPlayerIds: candidates.map(player => player.id)
    };

    room.nightResultAnnouncements.push(templateFromGroup("sabotageCurseStarted", {}, rng));

    debugLog("effects", "haunting sabotage started", {
      actor: actor.name,
      repairPoiCode,
      affectedPlayers: candidates.map(player => player.name)
    });
  }
}

function processRepairs(room, actions, events, rng = Math.random) {
  repairBlackout(room, actions, events, rng);
  removeCurses(room, actions, events, rng);
  expireSabotages(room);
}

function repairBlackout(room, actions, events, rng = Math.random) {
  const blackout = room.sabotages[SABOTAGE_KEY.BLACKOUT];
  if (!blackout?.active) return;
  if (room.dayNumber < Number(blackout.canRepairFromNight || 0)) return;

  const repairedBy = actions.find(action => {
    return action.targetPoiCode === blackout.repairPoiCode && actionLeavesHome(action);
  });

  if (!repairedBy) return;

  blackout.active = false;
  blackout.repairedNight = room.dayNumber;

  const poiName = getPoiByCode(blackout.repairPoiCode)?.displayName || blackout.repairPoiCode;
  const text = templateFromGroup("blackoutRepaired", { poi: poiName }, rng);

  room.nightResultAnnouncements.push(text);
  events.push({ type: "sabotage_repaired", sabotageId: SABOTAGE_KEY.BLACKOUT, text });

  debugLog("effects", "blackout repaired", {
    repairedBy: repairedBy.actorName || repairedBy.actorId,
    poi: poiName
  });
}

function removeCurses(room, actions, events, rng = Math.random) {
  const curse = room.sabotages[SABOTAGE_KEY.CURSE];
  const repairPoiCode = curse?.repairPoiCode || CONFIG.sabotages[SABOTAGE_KEY.CURSE].repairPoiCode;

  for (const action of actions) {
    if (action.targetPoiCode !== repairPoiCode || !actionLeavesHome(action)) {
      continue;
    }

    const player = room.players.find(item => item.id === action.actorId);
    if (!player || !hasEffect(player, EFFECT_KEY.HAUNTED)) {
      continue;
    }

    removeEffect(player, EFFECT_KEY.HAUNTED);

    const poiName = getPoiByCode(repairPoiCode)?.displayName || repairPoiCode;
    const text = templateFromGroup("hauntedRemoved", { player: player.name, poi: poiName }, rng);

    room.nightResultAnnouncements.push(text);
    events.push({ type: "curse_removed", playerId: player.id, text });

    debugLog("effects", "haunting removed", {
      player: player.name,
      poi: poiName
    });
  }

  if (curse?.active) {
    const anyCursed = room.players.some(player => hasEffect(player, EFFECT_KEY.HAUNTED));
    if (!anyCursed) curse.active = false;
  }
}

function expireSabotages(room) {
  const difficulty = room.sabotages[SABOTAGE_KEY.MICROGAME_DIFFICULTY];

  if (difficulty?.active && room.dayNumber > Number(difficulty.expiresAfterNight || 0)) {
    difficulty.active = false;
  }
}

function isBlackoutActive(room) {
  return Boolean(room.sabotages[SABOTAGE_KEY.BLACKOUT]?.active);
}

function isMicrogameDifficultyActive(room) {
  const sabotage = room.sabotages[SABOTAGE_KEY.MICROGAME_DIFFICULTY];
  return Boolean(sabotage?.active && Number(sabotage.activeNight) === Number(room.dayNumber));
}

function getActivePublicEffectReminders(room) {
  const reminders = [];

  const blackout = room.sabotages[SABOTAGE_KEY.BLACKOUT];
  if (blackout?.active) {
    const poiName = getPoiByCode(blackout.repairPoiCode)?.displayName || blackout.repairPoiCode;
    if (room.dayNumber >= Number(blackout.canRepairFromNight || 0)) {
      reminders.push(`Apagão ativo. Alguém precisa passar a noite em ${poiName} para consertar.`);
    } else {
      reminders.push(`Apagão ativo. Poderá ser consertado na próxima noite em ${poiName}.`);
    }
  }

  const difficulty = room.sabotages[SABOTAGE_KEY.MICROGAME_DIFFICULTY];
  if (difficulty?.active) {
    reminders.push("Os microgames estão mais difíceis por uma noite.");
  }

  const curse = room.sabotages[SABOTAGE_KEY.CURSE];
  if (curse?.active) {
    const poiName = getPoiByCode(curse.repairPoiCode)?.displayName || curse.repairPoiCode;
    reminders.push(`Assombração ativa. Jogadores assombrados podem tentar limpar o efeito em ${poiName}.`);
  }

  return reminders;
}

function actionLeavesHome(action) {
  return Boolean(action.leavesHome) || [
    ACTION_CLASS.VISIT_POI,
    ACTION_CLASS.VISIT_PLAYER,
    ACTION_CLASS.DETECT_REGION,
    ACTION_CLASS.MEDIUM_SENSE_REGION,
    ACTION_CLASS.PROTECT_PLAYER,
    ACTION_CLASS.JOURNALIST_REPORT,
    ACTION_CLASS.KILL_PLAYER,
    ACTION_CLASS.VIGILANTE_KILL,
    ACTION_CLASS.POSSESSED_KILL,
    ACTION_CLASS.POSSESSED_CONDEMN,
    ACTION_CLASS.LITHOMANCER_GUESS,
    ACTION_CLASS.BOUNTY_KILL,
    ACTION_CLASS.AMBUSH_POI,
    ACTION_CLASS.PLANT_EVIDENCE,
    ACTION_CLASS.METAMORPH_DISGUISE,
    ACTION_CLASS.ILLUSIONIST_PLANT_CLUE,
    ACTION_CLASS.OCCULTIST_CURSE,
    ACTION_CLASS.HYPNOTIST_SLEEP,
    ACTION_CLASS.THIEF_ROB,
    ACTION_CLASS.CULTIST_RITUAL_STEP,
    ACTION_CLASS.SABOTAGE,
    ACTION_CLASS.OBSESSOR_MARK
  ].includes(action.actionClass);
}

function shuffle(array, rng = Math.random) {
  const copy = [...array];
  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

module.exports = {
  applySabotage,
  processRepairs,
  isBlackoutActive,
  isMicrogameDifficultyActive,
  getActivePublicEffectReminders,
  actionLeavesHome
};
