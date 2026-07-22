const CONFIG = require("../config");

function getEffectDefinition(effectId) {
  return CONFIG.effects[effectId] || null;
}

function hasEffect(player, effectId) {
  return Array.isArray(player.effects) && player.effects.some(effect => effect.id === effectId);
}

function addEffect(player, effectId, data = {}) {
  if (!player.effects) player.effects = [];

  const existing = player.effects.find(effect => effect.id === effectId);

  if (existing) {
    Object.assign(existing, data);
    return existing;
  }

  const effect = {
    id: effectId,
    startedNight: data.startedNight || 0,
    expiresAfterNight: data.expiresAfterNight || null,
    ...data
  };

  player.effects.push(effect);
  return effect;
}

function removeEffect(player, effectId) {
  if (!Array.isArray(player.effects)) return;
  player.effects = player.effects.filter(effect => effect.id !== effectId);
}

function getEffectLabels(player) {
  return (player.effects || [])
    .map(effect => getEffectDefinition(effect.id)?.label || effect.id)
    .filter(Boolean);
}

function getEffectMessages(player) {
  return (player.effects || [])
    .map(effect => getEffectDefinition(effect.id)?.privateMessage || "")
    .filter(Boolean);
}

module.exports = {
  getEffectDefinition,
  hasEffect,
  addEffect,
  removeEffect,
  getEffectLabels,
  getEffectMessages
};
