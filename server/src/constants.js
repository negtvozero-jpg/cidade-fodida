const PORT = process.env.PORT || 3000;

const FIRST_DAY_SECONDS = 20;
const DAY_SECONDS = 60;
const NIGHT_SECONDS = 60;

const DAY_RESULT_SECONDS = 15;
const NIGHT_RESULT_SECONDS = 15;

const MAX_PLAYERS = 12;
const MIN_PLAYERS_TO_START = 2;

const PHASE = {
  LOBBY: 0,
  DAY: 1,
  NIGHT: 2,
  GAME_OVER: 3,
  NIGHT_RESULT: 4,
  DAY_RESULT: 5
};

const ALIGNMENT = {
  NONE: 0,
  INNOCENT: 1,
  IMPOSTOR: 2,
  NEUTRAL: 3
};

// Alias legado para não quebrar arquivos/clientes antigos.
// Em código novo, use ALIGNMENT para não misturar papel com alinhamento.
const ROLE = ALIGNMENT;

const ROLE_KEY = {
  RESIDENT: "resident",
  DETECTIVE: "detective",
  UNICORN: "unicorn",
  JOURNALIST: "journalist",
  VIGILANTE: "vigilante",

  KILLER: "killer",
  STALKER: "stalker",

  JOKER: "joker",
  INSTIGATOR: "instigator",
  POSSESSED: "possessed"
};

const WINNER = {
  NONE: 0,
  INNOCENTS: 1,
  IMPOSTORS: 2,
  NEUTRAL: 3
};

// ROLE_TEXT é mantido como alias editável/compatível no final do arquivo.
// A fonte principal de papéis agora é ROLE_DEFINITIONS.

const VOTE_TYPE = {
  PLAYER: "player",
  SKIP: "skip"
};

const TARGET_TYPE = {
  NONE: "none",
  PLAYER: "player",
  POI: "poi",
  REGION: "region"
};

const ACTION_COMMAND = {
  NONE: "none",
  ACTION_1: "action1",
  ACTION_2: "action2",
  SLEEP: "sleep",
  CONFIRM: "confirm",
  CANCEL: "cancel",
  SKIP: "skip",
  CLEAR_SELECTION: "clearSelection",
  PASS: "pass",
  FAIL: "fail"
};

const ACTION_CLASS = {
  REST: "rest",
  STAY_HOME_AWAKE: "stayHomeAwake",
  VISIT_POI: "visitPoi",
  VISIT_PLAYER: "visitPlayer",
  VISIT_REGION: "visitRegion",
  AFFECT_PLAYER_REMOTE: "affectPlayerRemote",
  AFFECT_REGION_REMOTE: "affectRegionRemote",
  CREATE_FALSE_TRACE: "createFalseTrace",
  DETECT_REGION: "detectRegion",
  PROTECT_PLAYER: "protectPlayer",
  JOURNALIST_REPORT: "journalistReport",
  AMBUSH_POI: "ambushPoi",
  PLANT_EVIDENCE: "plantEvidence",
  SABOTAGE: "sabotage"
};

const ACTION_INTENT = {
  NONE: "none",
  NEUTRAL: "neutral",
  BENIGN: "benign",
  HOSTILE: "hostile",
  INTRUSIVE: "intrusive",
  DECEPTIVE: "deceptive"
};

const MICROGAME_CATEGORY = {
  NONE: "none",
  ATTENTION: "attention",
  MOVEMENT: "movement",
  APPROACH: "approach",
  CONTROL: "control",
  ASSASSINATION: "assassination"
};

const MICROGAME_ID = {
  NONE: "none",
  GAME_1: "game1",
  GAME_2: "game2",
  GAME_3: "game3"
};

const MICROGAME_CONFIG = {
  [MICROGAME_CATEGORY.NONE]: {
    pool: [MICROGAME_ID.NONE],
    timeLimit: 0,
    difficulty: 0
  },

  [MICROGAME_CATEGORY.ATTENTION]: {
    pool: [MICROGAME_ID.GAME_1],
    timeLimit: 8,
    difficulty: 1
  },

  [MICROGAME_CATEGORY.MOVEMENT]: {
    pool: [MICROGAME_ID.GAME_2],
    timeLimit: 8,
    difficulty: 1
  },

  [MICROGAME_CATEGORY.APPROACH]: {
    pool: [MICROGAME_ID.GAME_3],
    timeLimit: 7,
    difficulty: 1
  },

  [MICROGAME_CATEGORY.CONTROL]: {
    pool: [MICROGAME_ID.GAME_1, MICROGAME_ID.GAME_2, MICROGAME_ID.GAME_3],
    timeLimit: 8,
    difficulty: 1
  },

  [MICROGAME_CATEGORY.ASSASSINATION]: {
    pool: [MICROGAME_ID.GAME_3],
    timeLimit: 7,
    difficulty: 1
  }
};

const CLUE_VISIBILITY = {
  PUBLIC: "public",
  PRIVATE: "private"
};

const PLAYER_CONFIG = {
  defaultNamePrefix: "Jogador",
  initialEnergy: 2,
  maxEnergy: 3,
  minEnergy: 0
};

const ENERGY_CONFIG = {
  action1Cost: 1,
  action2Cost: 2,
  sleepGain: 1
};

const POI_CONFIG = {
  codes: ["purple", "green", "yellow", "blue", "red"],

  definitions: {
    purple: {
      index: 1,
      code: "purple",
      poiType: "purple",
      visibleName: "igreja",
      displayName: "Igreja",
      anchorNode: "h1v1",
      nearNodes: ["h1v1", "h1v2", "h2v1"],
      nearRoads: ["h1", "v1"]
    },

    green: {
      index: 2,
      code: "green",
      poiType: "green",
      visibleName: "mercado",
      displayName: "Mercado",
      anchorNode: "h2v3",
      nearNodes: ["h1v3", "h2v3", "h3v3"],
      nearRoads: ["h2", "v3"]
    },

    yellow: {
      index: 3,
      code: "yellow",
      poiType: "yellow",
      visibleName: "praça",
      displayName: "Praça",
      anchorNode: "h2v2",
      nearNodes: ["h2v2", "h3v2", "h2v3", "h3v3"],
      nearRoads: ["h2", "h3", "v2", "v3"]
    },

    blue: {
      index: 4,
      code: "blue",
      poiType: "blue",
      visibleName: "Barzinho",
      displayName: "Barzinho",
      anchorNode: "h4v2",
      nearNodes: ["h3v1", "h3v2", "h4v2"],
      nearRoads: ["h3", "h4", "v2"]
    },

    red: {
      index: 5,
      code: "red",
      poiType: "red",
      visibleName: "viela da ENEL",
      displayName: "Viela da ENEL",
      anchorNode: "h4v3",
      nearNodes: ["h3v3", "h4v3"],
      nearRoads: ["h3", "h4", "v3"]
    }
  }
};

const SABOTAGE_TYPE = {
  BLACKOUT: "blackout",
  MICROGAME_DIFFICULTY_UP: "microgameDifficultyUp",
  CURSE: "curse"
};

const SABOTAGE_CONFIG = {
  types: [
    SABOTAGE_TYPE.BLACKOUT,
    SABOTAGE_TYPE.MICROGAME_DIFFICULTY_UP,
    SABOTAGE_TYPE.CURSE
  ],

  blackout: {
    repairPoiCode: "red",
    repairDelayNights: 1
  },

  microgameDifficultyUp: {
    difficultyBonus: 1,
    durationNights: 1
  },

  curse: {
    cursedPlayerCount: 2,
    repairPoiCode: "purple"
  }
};

const ACTION_DEFINITIONS = {
  sleep: {
    id: "sleep",
    actionClass: ACTION_CLASS.REST,
    intent: ACTION_INTENT.NONE,
    label: "Dormir ◈",
    description: "Recupera 1 energia.",
    energyCost: 0,
    energyGain: ENERGY_CONFIG.sleepGain,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.NONE,
    implemented: true,
    skipsMicrogame: true
  },

  stayHomeAwake: {
    id: "stayHomeAwake",
    actionClass: ACTION_CLASS.STAY_HOME_AWAKE,
    intent: ACTION_INTENT.NEUTRAL,
    label: "Ficar em casa acordado ◆",
    description: "Passa a noite acordado e talvez receba pistas locais.",
    energyCost: ENERGY_CONFIG.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.ATTENTION,
    implemented: true,
    skipsMicrogame: false
  },

  goOutToPoi: {
    id: "goOutToPoi",
    actionClass: ACTION_CLASS.VISIT_POI,
    intent: ACTION_INTENT.NEUTRAL,
    label: "Sair ◆◆",
    description: "Passe a noite em algum ponto de interesse.",
    energyCost: ENERGY_CONFIG.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.POI,
    microgameCategory: MICROGAME_CATEGORY.MOVEMENT,
    implemented: true,
    skipsMicrogame: false
  },

  killPlayer: {
    id: "killPlayer",
    actionClass: ACTION_CLASS.VISIT_PLAYER,
    intent: ACTION_INTENT.HOSTILE,
    label: "Assassinar ◆",
    description: "Escolha uma vitima para matar.",
    energyCost: ENERGY_CONFIG.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.APPROACH,
    implemented: true,
    skipsMicrogame: false
  },

  vigilanteKill: {
    id: "vigilanteKill",
    actionClass: ACTION_CLASS.VISIT_PLAYER,
    intent: ACTION_INTENT.HOSTILE,
    label: "Executar ◆◆",
    description: "Escolha uma vítima para matar.",
    energyCost: ENERGY_CONFIG.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.APPROACH,
    implemented: true,
    skipsMicrogame: false
  },

  possessedKill: {
    id: "possessedKill",
    actionClass: ACTION_CLASS.VISIT_PLAYER,
    intent: ACTION_INTENT.HOSTILE,
    label: "Matar ◆",
    description: "Escolha uma vítima para matar.",
    energyCost: ENERGY_CONFIG.action1Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    microgameCategory: MICROGAME_CATEGORY.APPROACH,
    implemented: true,
    skipsMicrogame: false
  },

  investigateRegion: {
    id: "investigateRegion",
    actionClass: ACTION_CLASS.DETECT_REGION,
    intent: ACTION_INTENT.BENIGN,
    label: "Investigar região ◆◆",
    description: "Escolha uma casa ou ponto de interesse e receba pistas.",
    energyCost: ENERGY_CONFIG.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.REGION,
    microgameCategory: MICROGAME_CATEGORY.ATTENTION,
    implemented: true,
    skipsMicrogame: false
  },

  protectPlayer: {
    id: "protectPlayer",
    actionClass: ACTION_CLASS.PROTECT_PLAYER,
    intent: ACTION_INTENT.BENIGN,
    label: "Proteger ◆◆",
    description: "Protege um jogador ou si mesmo contra um ataque.",
    energyCost: ENERGY_CONFIG.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.PLAYER,
    allowSelfTarget: true,
    defaultTargetSelf: true,
    microgameCategory: MICROGAME_CATEGORY.CONTROL,
    implemented: true,
    skipsMicrogame: false
  },

  publishRegionClue: {
    id: "publishRegionClue",
    actionClass: ACTION_CLASS.JOURNALIST_REPORT,
    intent: ACTION_INTENT.BENIGN,
    label: "Investigar local ◆◆",
    description: "Escolha uma casa ou ponto de interesse, uma pista daquela região será publicada pela manhã.",
    energyCost: ENERGY_CONFIG.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.REGION,
    microgameCategory: MICROGAME_CATEGORY.ATTENTION,
    implemented: true,
    skipsMicrogame: false
  },

  stalkPoi: {
    id: "stalkPoi",
    actionClass: ACTION_CLASS.AMBUSH_POI,
    intent: ACTION_INTENT.HOSTILE,
    label: "Emboscar ◆◆",
    description: "Mate alguém voltando de um ponto de interesse selecionado.",
    energyCost: ENERGY_CONFIG.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.POI,
    microgameCategory: MICROGAME_CATEGORY.APPROACH,
    implemented: true,
    skipsMicrogame: false
  },

  plantEvidence: {
    id: "plantEvidence",
    actionClass: ACTION_CLASS.PLANT_EVIDENCE,
    intent: ACTION_INTENT.DECEPTIVE,
    label: "Enquadrar ◆◆",
    description: "Planta uma prova falsa contra um alvo.",
    energyCost: ENERGY_CONFIG.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.CONTROL,
    implemented: true,
    skipsMicrogame: false
  },

  sabotage: {
    id: "sabotage",
    actionClass: ACTION_CLASS.SABOTAGE,
    intent: ACTION_INTENT.DECEPTIVE,
    label: "Sabotar ◆◆",
    description: "Sorteia uma sabotagem contra o bairro.",
    energyCost: ENERGY_CONFIG.action2Cost,
    energyGain: 0,
    targetType: TARGET_TYPE.NONE,
    microgameCategory: MICROGAME_CATEGORY.CONTROL,
    implemented: true,
    skipsMicrogame: false
  }
};

const ROLE_DEFINITIONS = {
  resident: {
    id: ROLE_KEY.RESIDENT,
    name: "Morador",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Sobreviva e descubra quem é o impostor.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "goOutToPoi",
      sleep: "sleep"
    }
  },

  detective: {
    id: ROLE_KEY.DETECTIVE,
    name: "Detetive",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Investigue regiões pra receber pistas.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "investigateRegion",
      sleep: "sleep"
    }
  },

  unicorn: {
    id: ROLE_KEY.UNICORN,
    name: "Unicórnio",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Proteja alguém ou si mesmo contra ataques durante a noite.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "protectPlayer",
      sleep: "sleep"
    }
  },

  journalist: {
    id: ROLE_KEY.JOURNALIST,
    name: "Jornalista",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Escolha uma região e revele publicamente uma pista pela manhã.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "publishRegionClue",
      sleep: "sleep"
    }
  },

  vigilante: {
    id: ROLE_KEY.VIGILANTE,
    name: "Vigilante",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Escolha uma vítima durante a noite. Se matar um inocente, deixará pistas graves.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "vigilanteKill",
      sleep: "sleep"
    }
  },

  killer: {
    id: ROLE_KEY.KILLER,
    name: "Assassino",
    alignment: ALIGNMENT.IMPOSTOR,
    roleMessage: "Mate em casa ou sabote o bairro.",
    actionSlots: {
      action1: "killPlayer",
      action2: "sabotage",
      sleep: "sleep"
    }
  },

  stalker: {
    id: ROLE_KEY.STALKER,
    name: "Espreitador",
    alignment: ALIGNMENT.IMPOSTOR,
    roleMessage: "Mate em casa ou espere alguém voltar de um local.",
    actionSlots: {
      action1: "killPlayer",
      action2: "stalkPoi",
      sleep: "sleep"
    }
  },

  joker: {
    id: ROLE_KEY.JOKER,
    name: "Coringa",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Você vence se for eliminado por votação.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "goOutToPoi",
      sleep: "sleep"
    }
  },

  instigator: {
    id: ROLE_KEY.INSTIGATOR,
    name: "Instigador",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Faça seu alvo ser eliminado por votação.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "plantEvidence",
      sleep: "sleep"
    }
  },

  possessed: {
    id: ROLE_KEY.POSSESSED,
    name: "Possuído",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Elimine inocentes e impostores para vencer sozinho.",
    actionSlots: {
      action1: "possessedKill",
      sleep: "sleep"
    }
  }
};


const ROLE_TEXT = Object.fromEntries(
  Object.entries(ROLE_DEFINITIONS).map(([roleKey, role]) => [
    roleKey,
    {
      name: role.name,
      message: role.roleMessage
    }
  ])
);

function buildActivityDefinitionsFromRoles() {
  const result = {};

  for (const [roleKey, role] of Object.entries(ROLE_DEFINITIONS)) {
    result[roleKey] = {};

    for (const [slot, actionId] of Object.entries(role.actionSlots || {})) {
      const action = ACTION_DEFINITIONS[actionId];

      if (action) {
        result[roleKey][slot] = {
          ...action
        };
      }
    }
  }

  return result;
}

// Alias compatível com o client/main atual.
// Fonte principal: ACTION_DEFINITIONS + ROLE_DEFINITIONS.
const ACTIVITY_DEFINITIONS = buildActivityDefinitionsFromRoles();

function edge(from, to, road) {
  return { from, to, road };
}

const CLUE_CONFIG = {
  roads: {
    h1: { visibleName: "rua xique xique" },
    h2: { visibleName: "rua dos gays" },
    h3: { visibleName: "rua das lesbicas" },
    h4: { visibleName: "rua catapimbas" },

    v1: { visibleName: "rua Zero" },
    v2: { visibleName: "rua dos beta" },
    v3: { visibleName: "rua dos alfa" }
  },

  playerSlots: {
    p1: { homeNode: "h1v1", homeRoads: ["h1", "v1"], zoneName: "região noroeste" },
    p2: { homeNode: "h1v2", homeRoads: ["h1", "v2"], zoneName: "região norte" },
    p3: { homeNode: "h2v1", homeRoads: ["h2", "v1"], zoneName: "região oeste" },
    p4: { homeNode: "h2v2", homeRoads: ["h2", "v2"], zoneName: "região central" },
    p5: { homeNode: "h3v2", homeRoads: ["h3", "v2"], zoneName: "região centro-sul" },
    p6: { homeNode: "h3v3", homeRoads: ["h3", "v3"], zoneName: "região leste" },
    p7: { homeNode: "h4v2", homeRoads: ["h4", "v2"], zoneName: "região sul" },
    p8: { homeNode: "h4v3", homeRoads: ["h4", "v3"], zoneName: "região sudeste" },
    p9: { homeNode: "h3v1", homeRoads: ["h3", "v1"], zoneName: "região sudoeste" },
    p10: { homeNode: "h1v3", homeRoads: ["h1", "v3"], zoneName: "região nordeste" },
    p11: { homeNode: "h4v2", homeRoads: ["h4", "v2"], zoneName: "região sul" },
    p12: { homeNode: "h4v3", homeRoads: ["h4", "v3"], zoneName: "região sudeste" }
  },

  graphEdges: [
    edge("h1v1", "h1v2", "h1"),
    edge("h1v2", "h1v3", "h1"),
    edge("h2v1", "h2v2", "h2"),
    edge("h2v2", "h2v3", "h2"),
    edge("h3v1", "h3v2", "h3"),
    edge("h3v2", "h3v3", "h3"),
    edge("h4v2", "h4v3", "h4"),
    edge("h1v1", "h2v1", "v1"),
    edge("h2v1", "h3v1", "v1"),
    edge("h1v2", "h2v2", "v2"),
    edge("h2v2", "h3v2", "v2"),
    edge("h3v2", "h4v2", "v2"),
    edge("h1v3", "h2v3", "v3"),
    edge("h2v3", "h3v3", "v3"),
    edge("h3v3", "h4v3", "v3")
  ],

  microgameResultScore: {
    pass: 78,
    fail: 28,
    skipped: 100
  },

  microgameQuality: {
    goodMin: 75,
    mediumMin: 45
  },

  clueSelection: {
    selectedClueCountByMicrogameQuality: {
      good: 2,
      medium: 2,
      bad: 3
    },

    // Filtro final por jogador/noite.
    // Mantém o privateMessage curto: em geral, 1 pista da própria ação
    // + 1 pista externa importante.
    maxCluesPerPlayerPerNight: 2,
    maxSameCategoryPerPlayer: 1,
    maxSamePlacePerPlayer: 1,

    // Prioridades editáveis. Quanto maior, maior a chance da pista sobreviver
    // ao corte quando um jogador receber pistas demais.
    categoryPriority: {
      quiet: 100,
      ownAction: 100,
      ownHome: 95,
      missedHome: 92,
      protected: 92,
      specialAction: 90,
      vigilanteGrave: 88,
      plantedEvidence: 85,
      sabotage: 80,
      curse: 60,
      targetHome: 75,
      targetPoi: 70,
      routePoi: 55,
      routeRoad: 45,
      fallback: 10
    }
  },

  publication: {
    // Pistas não são públicas por padrão.
    // No futuro, ações como jornalista podem publicar pistas preenchendo estes arrays.
    defaultPublicCluesEnabled: false,
    publicClueActionIds: [],
    publicClueActionClasses: []
  },

  // Referência das variáveis que podem ser usadas em templates de pistas.
  // Elas são opcionais: você pode usar só as que fizerem sentido em cada frase.
  templateVariables: {
    place: "Lugar/região principal da pista.",
    detail: "Resumo de movimentação confirmado pelo sistema.",
    player: "Jogador enquadrado, alvo ou citado pela pista.",
    targetPlayer: "Mesmo valor de {player}, quando a frase precisar deixar claro que é o alvo.",
    actor: "Jogador que realizou a ação, quando for seguro revelar.",
    crimeScene: "Área onde houve ataque, morte ou movimentação suspeita.",
    adjacentCrimeSceneRoad: "Rua próxima à área do crime.",
    impostorPath: "Rota provável associada ao ataque, quando disponível.",
    impostorPathPartial: "Trecho parcial/ambíguo da rota associada ao ataque.",
    targetHome: "Região da casa do jogador citado.",
    poi: "Ponto de interesse citado.",
    road: "Rua citada.",
    actionPath: "Caminho completo provável do autor da ação.",
    "action path": "Alias de {actionPath}.",

    actionPathPartial: "Trecho parcial do caminho provável do autor da ação.",
    "action path partial": "Alias de {actionPathPartial}.",

    actionApproachRoad: "Última rua do caminho antes do destino.",
    "action approach road": "Alias de {actionApproachRoad}.",

    actionApproachDirection: "Direção aproximada de onde a ação veio.",
    "action approach direction": "Alias de {actionApproachDirection}.",

    actionOriginRoad: "Primeira rua do caminho do autor.",
    "action origin road": "Alias de {actionOriginRoad}.",

    crimeSceneRoads: "Lista curta de ruas próximas à área do crime.",
    "crime scene roads": "Alias de {crimeSceneRoads}.",

    targetRegion: "Região/casa/ponto de interesse usado como alvo da ação.",
    "target region": "Alias de {targetRegion}.",

    regionOwnerStatus: "Frase curta dizendo se o dono da casa investigada estava ou não em casa.",
    "region owner status": "Alias de {regionOwnerStatus}.",

    regionVisitors: "Frase curta com outros jogadores que passaram pela região investigada.",
    "region visitors": "Alias de {regionVisitors}.",

    players: "Lista de jogadores citados em uma pista.",
  },

  templates: {
    quietNight: [
      "Você dormiu tranquilamente."
    ],

    ownHomeObservation: [
      "Você ficou atento e ouviu passos perto da sua casa.",
      "Você percebeu uma movimentação confusa perto da sua casa."
    ],

    originZone: [
      "Houve movimento em {place}.",
      "Alguém parece ter saído de {place}."
    ],

    routeRoad: [
      "Alguém passou por {place}.",
      "Movimento foi ouvido em {place}."
    ],

    routePoi: [
      "Algo foi notado perto de {place}.",
      "Uma presença passou perto de {place}."
    ],

    targetHome: [
      "Movimento foi percebido perto da casa de {player}.",
      "Algo aconteceu perto da casa de {player}."
    ],

    targetPoi: [
      "Você percebeu movimento perto de {place}.",
      "Você encontrou sinais recentes perto de {place}."
    ],

    actionPrivateVisitPoi: [
      "Você foi até {place} e notou sinais de atividade por ali."
    ],

    actionPrivateVisitPlayer: [
      "Você visitou {player}."
    ],

    // Usado quando uma ação chega à casa de alguém e o alvo não está lá.
    // Não diferencia ação benigna/maligna: o gerador de pistas não usa intenção.
    missedHomeAttack: [
      "Alguém passou pela sua casa durante a noite. Você nota passos vindo de {actionApproachDirection}"
    ],

    protectedAttack: [
      "Um ataque contra você foi impedido durante a noite."
    ],


    // Usado pela investigação de uma casa/região de jogador.
    // Permite diferenciar o dono estar em casa ou ter saído.
    detectiveRegionOwnerPresent: [
      "{targetPlayer} parecia estar em casa naquela noite."
    ],

    detectiveRegionOwnerAbsent: [
      "{targetPlayer} não parecia estar em casa naquela noite."
    ],

    detectiveRegionVisitorsSingle: [
      "{players} foi avistado naquela região."
    ],

    detectiveRegionVisitorsMany: [
      "{players} foram vistos naquela região."
    ],
    detectiveRegion: [
      "Você investigou {place}: {detail}"
    ],

    journalistPublished: [
      "Relato do jornalista sobre {place}: {detail}"
    ],

    plantedEvidence: [
      "{player} passou perto de {crimeScene}.",
      "{player} passou por {adjacentCrimeSceneRoad}.",
      "{player} foi visto em {impostorPathPartial}."
    ],

    plantedEvidenceActor: [
      "Você plantou uma pista falsa contra {player}."
    ],

    vigilanteKilledInnocent: [
      "Pistas graves apontam que {actor} passou por {crimeScene}.",
      "Há sinais fortes de que {actor} esteve perto de {targetHome}."
    ],

    sabotageBlackoutStarted: [
      "As luzes do bairro foram apagadas."
    ],

    sabotageMicrogameDifficultyStarted: [
      "Algo deixou as ações da próxima noite mais difíceis."
    ],

    sabotageCurseStarted: [
      "Uma maldição caiu sobre parte do bairro."
    ],

    blackoutWeakenedClue: [
      "A falta de luz tornou suas observações confusas.",
      "Você percebeu movimentação durante o apagão, mas não conseguiu confirmar detalhes."
    ],

    curseTrueClue: [
      "Você viu um fantasma repetindo uma pista: {clue}",
      "Entre assombrações, uma imagem pareceu revelar: {clue}"
    ],

    curseFalseClue: [
      "Você viu um fantasma em {place}, mas não sabe se era real.",
      "Uma assombração parecia atravessar {place}."
    ],

    curseRemoved: [
      "A maldição sobre você parece ter sido removida."
    ],

    blackoutRepaired: [
      "Você passou a noite na Viela da ENEL e as luzes parecem voltar ao normal."
    ],

    noUsefulClue: [
      "A noite passou sem pistas claras para você."
    ]
  }
};

module.exports = {
  PORT,
  ROLE_TEXT,
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
  ACTION_INTENT,
  MICROGAME_CATEGORY,
  MICROGAME_ID,
  MICROGAME_CONFIG,
  CLUE_VISIBILITY,
  PLAYER_CONFIG,
  ENERGY_CONFIG,
  POI_CONFIG,
  SABOTAGE_TYPE,
  SABOTAGE_CONFIG,
  ACTION_DEFINITIONS,
  ROLE_DEFINITIONS,
  ACTIVITY_DEFINITIONS,
  CLUE_CONFIG
};
