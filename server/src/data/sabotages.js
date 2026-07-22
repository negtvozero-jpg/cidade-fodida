const CONFIG = require("../config");
const { SABOTAGE_KEY } = require("../constants");

function getSabotageDefinition(id) {
  return CONFIG.sabotages[id] || null;
}

function getSabotagePool() {
  return [...CONFIG.sabotages.pool];
}

function createSabotageState(id, room, actorId) {
  const definition = getSabotageDefinition(id);

  if (!definition) return null;

  if (id === SABOTAGE_KEY.BLACKOUT) {
    return {
      id,
      active: true,
      actorId,
      startedNight: room.dayNumber,
      repairPoiCode: definition.repairPoiCode,
      canRepairFromNight: room.dayNumber + Number(definition.canRepairAfterNights || 1)
    };
  }

  if (id === SABOTAGE_KEY.MICROGAME_DIFFICULTY) {
    return {
      id,
      active: true,
      actorId,
      startedNight: room.dayNumber,
      activeNight: room.dayNumber + 1,
      expiresAfterNight: room.dayNumber + Number(definition.durationNights || 1)
    };
  }

  if (id === SABOTAGE_KEY.CURSE) {
    return {
      id,
      active: true,
      actorId,
      startedNight: room.dayNumber,
      repairPoiCode: definition.repairPoiCode,
      affectedPlayerIds: []
    };
  }

  return {
    id,
    active: true,
    actorId,
    startedNight: room.dayNumber
  };
}

module.exports = {
  getSabotageDefinition,
  getSabotagePool,
  createSabotageState
};
