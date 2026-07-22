const CONFIG = require("../config");
const {
  ACTION_CLASS,
  ACTION_INTENT,
  TARGET_TYPE,
  MICROGAME_CATEGORY
} = require("../constants");

function withMicrogame(action) {
  const microgame = CONFIG.microgame.byCategory[action.microgameCategory] || CONFIG.microgame.byCategory[MICROGAME_CATEGORY.NONE];

  return {
    ...action,
    microgamePool: [...microgame.pool],
    microgameTimeLimit: microgame.timeLimit,
    microgameDifficulty: microgame.difficulty
  };
}

const ACTION_DEFINITIONS = {
  sleep: withMicrogame({
    id: "sleep",
    actionClass: ACTION_CLASS.REST,
    intent: ACTION_INTENT.NONE,
    label: "Dormir ◈",
    description: "Recupera 1 energia.",
    energyCost: 0,
    energyGain: CONFIG.energy.sleepGain,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.RECOVERY,
    skipsMicrogame: true,
    implemented: true,
    leavesHome: false
  }),

  stayHomeAwake: withMicrogame({
    id: "stayHomeAwake",
    actionClass: ACTION_CLASS.STAY_HOME_AWAKE,
    intent: ACTION_INTENT.NEUTRAL,
    label: "Ficar em casa acordado ◆",
    description: "Tenta perceber movimentos perto da sua casa.",
    energyCost: CONFIG.energy.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.WATCH,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: false
  }),

  goOutToPoi: withMicrogame({
    id: "goOutToPoi",
    actionClass: ACTION_CLASS.VISIT_POI,
    intent: ACTION_INTENT.NEUTRAL,
    label: "Sair a noite ◆◆",
    description: "Escolha um local para observar.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.POI,
    microgameCategory: MICROGAME_CATEGORY.WATCH,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  killPlayer: withMicrogame({
    id: "killPlayer",
    actionClass: ACTION_CLASS.KILL_PLAYER,
    intent: ACTION_INTENT.HOSTILE,
    label: "Assassinar ◆",
    description: "Escolha uma vítima.",
    energyCost: CONFIG.energy.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.VIOLENCE,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  sabotage: withMicrogame({
    id: "sabotage",
    actionClass: ACTION_CLASS.SABOTAGE,
    intent: ACTION_INTENT.DECEPTIVE,
    label: "Sabotar ◆◆",
    description: "Sorteia uma sabotagem contra o bairro.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.INVASION,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  stalkPoi: withMicrogame({
    id: "stalkPoi",
    actionClass: ACTION_CLASS.AMBUSH_POI,
    intent: ACTION_INTENT.HOSTILE,
    label: "Espreitar ◆◆",
    description: "Escolha um local. Mata uma pessoa voltando de lá, se houver.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.POI,
    microgameCategory: MICROGAME_CATEGORY.VIOLENCE,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  obsessorMark: withMicrogame({
    id: "obsessorMark",
    actionClass: ACTION_CLASS.OBSESSOR_MARK,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Marcar ◆◆",
    description: "Visita um jogador discretamente. Na próxima noite ele morrerá sem deixar pistas.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.RITUAL,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  mediumSensePresence: withMicrogame({
    id: "mediumSensePresence",
    actionClass: ACTION_CLASS.MEDIUM_SENSE_REGION,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Sentir presença ◆◆",
    description: "Escolha uma casa ou local. Tenta perceber rastros espirituais recentes.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.REGION,
    microgameCategory: MICROGAME_CATEGORY.RITUAL,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  investigateRegion: withMicrogame({
    id: "investigateRegion",
    actionClass: ACTION_CLASS.DETECT_REGION,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Investigar região ◆◆",
    description: "Escolha uma casa ou local. Receba informações sobre movimentações.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.REGION,
    microgameCategory: MICROGAME_CATEGORY.INVESTIGATION,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  protectPlayer: withMicrogame({
    id: "protectPlayer",
    actionClass: ACTION_CLASS.PROTECT_PLAYER,
    intent: ACTION_INTENT.BENIGN,
    label: "Proteger ◆◆",
    description: "Protege um jogador ou a si mesmo contra um ataque.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    allowSelfTarget: true,
    defaultTargetSelf: true,
    microgameCategory: MICROGAME_CATEGORY.WATCH,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  publishRegionClue: withMicrogame({
    id: "publishRegionClue",
    actionClass: ACTION_CLASS.JOURNALIST_REPORT,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Publicar pista ◆◆",
    description: "Escolha um local. Na manhã seguinte, uma pista daquela região é compartilhada publicamente.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.REGION,
    microgameCategory: MICROGAME_CATEGORY.INVESTIGATION,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  vigilanteKill: withMicrogame({
    id: "vigilanteKill",
    actionClass: ACTION_CLASS.VIGILANTE_KILL,
    intent: ACTION_INTENT.HOSTILE,
    label: "Executar ◆◆",
    description: "Escolha uma vítima. Se for inocente, gera pistas graves.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.VIOLENCE,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  plantEvidence: withMicrogame({
    id: "plantEvidence",
    actionClass: ACTION_CLASS.PLANT_EVIDENCE,
    intent: ACTION_INTENT.DECEPTIVE,
    label: "Enquadrar ◆◆",
    description: "Cria uma pista média contra seu alvo sorteado.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.MANIPULATION,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  possessedKill: withMicrogame({
    id: "possessedKill",
    actionClass: ACTION_CLASS.POSSESSED_KILL,
    intent: ACTION_INTENT.HOSTILE,
    label: "Assassinar ◆",
    description: "Escolha uma vítima.",
    energyCost: CONFIG.energy.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.VIOLENCE,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  possessedCondemn: withMicrogame({
    id: "possessedCondemn",
    actionClass: ACTION_CLASS.POSSESSED_CONDEMN,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Condenar ◆",
    description: "Uso único. Transforma um jogador em Condenado.",
    energyCost: CONFIG.energy.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.RITUAL,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  possessedSynergy: withMicrogame({
    id: "possessedSynergy",
    actionClass: ACTION_CLASS.POSSESSED_SYNERGY,
    intent: ACTION_INTENT.NEUTRAL,
    label: "Sinergia",
    description: "Por 2 noites, recebe informação privada sobre a atividade do aliado condenado/possuído.",
    energyCost: 0,
    energyGain: 0,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.RITUAL,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: false
  }),

  lithomancerGuess: withMicrogame({
    id: "lithomancerGuess",
    actionClass: ACTION_CLASS.LITHOMANCER_GUESS,
    intent: ACTION_INTENT.HOSTILE,
    label: "Vaticínio ◆◆",
    description: "Escolha uma vítima e chute o papel dela. Se acertar, ela morre sem pistas; se errar, você morre.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.RITUAL,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  bountyKill: withMicrogame({
    id: "bountyKill",
    actionClass: ACTION_CLASS.BOUNTY_KILL,
    intent: ACTION_INTENT.HOSTILE,
    label: "Eliminar ◆◆",
    description: "Escolha uma vítima. Você vence se eliminar seu alvo.",
    energyCost: CONFIG.energy.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.VIOLENCE,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  bountyInvestigateRegion: withMicrogame({
    id: "bountyInvestigateRegion",
    actionClass: ACTION_CLASS.DETECT_REGION,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Investigar região ◆◆",
    description: "Escolha uma casa ou local. Procura movimentos que ajudem a localizar seu alvo.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.REGION,
    microgameCategory: MICROGAME_CATEGORY.INVESTIGATION,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  metamorphDisguise: withMicrogame({
    id: "metamorphDisguise",
    actionClass: ACTION_CLASS.METAMORPH_DISGUISE,
    intent: ACTION_INTENT.DECEPTIVE,
    label: "Roubar aparência ◆◆",
    description: "Futuro: assume a aparência de um jogador por tempo limitado.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.MANIPULATION,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  illusionistPlantClue: withMicrogame({
    id: "illusionistPlantClue",
    actionClass: ACTION_CLASS.ILLUSIONIST_PLANT_CLUE,
    intent: ACTION_INTENT.DECEPTIVE,
    label: "Plantar ilusão ◆◆",
    description: "Futuro: cria uma pista falsa usando a mesma sintaxe de uma pista real.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.REGION,
    microgameCategory: MICROGAME_CATEGORY.MANIPULATION,
    skipsMicrogame: false,
    implemented: false,
    leavesHome: true
  }),

  occultistCurse: withMicrogame({
    id: "occultistCurse",
    actionClass: ACTION_CLASS.OCCULTIST_CURSE,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Maldição ◆◆",
    description: "Futuro: aplica cansaço ou efeito sobrenatural em um jogador.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.RITUAL,
    skipsMicrogame: false,
    implemented: false,
    leavesHome: true
  }),

  hypnotistSleep: withMicrogame({
    id: "hypnotistSleep",
    actionClass: ACTION_CLASS.HYPNOTIST_SLEEP,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Sono forçado ◆◆",
    description: "Futuro: força um jogador a dormir na próxima noite.",
    energyCost: CONFIG.energy.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.MANIPULATION,
    skipsMicrogame: false,
    implemented: false,
    leavesHome: true
  }),

  thiefRob: withMicrogame({
    id: "thiefRob",
    actionClass: ACTION_CLASS.THIEF_ROB,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Roubar ◆",
    description: "Futuro: o valor roubado será decidido dentro do minigame específico.",
    energyCost: CONFIG.energy.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.INVASION,
    skipsMicrogame: false,
    implemented: false,
    leavesHome: true
  }),

  cultistRitualStep: withMicrogame({
    id: "cultistRitualStep",
    actionClass: ACTION_CLASS.CULTIST_RITUAL_STEP,
    intent: ACTION_INTENT.INTRUSIVE,
    label: "Preparar ritual ◆",
    description: "Complete uma etapa do ritual no local correto.",
    energyCost: CONFIG.energy.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.POI,
    microgameCategory: MICROGAME_CATEGORY.RITUAL,
    skipsMicrogame: false,
    implemented: true,
    leavesHome: true
  }),

  none: withMicrogame({
    id: "none",
    actionClass: ACTION_CLASS.NONE,
    intent: ACTION_INTENT.NONE,
    label: "—",
    description: "Sem ação secundária.",
    energyCost: 0,
    energyGain: 0,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.NONE,
    skipsMicrogame: true,
    implemented: false,
    leavesHome: false
  })
};

function getActionDefinition(actionId) {
  return ACTION_DEFINITIONS[actionId] || null;
}

module.exports = {
  ACTION_DEFINITIONS,
  getActionDefinition
};
