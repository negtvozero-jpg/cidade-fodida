const {
  MICROGAME_SCORE,
  MICROGAME_CATEGORY,
  MICROGAME_ID,
  EFFECT_KEY,
  SABOTAGE_KEY
} = require("./constants");

const CONFIG = {
  server: {
    port: process.env.PORT || 3000
  },

  debug: {
    enabled: true,
    actions: true,
    events: true,
    clues: true,
    effects: true,
    journalist: true,
    roles: true,
    validation: true,
    simulation: false
  },

  room: {
    maxPlayers: 12,
    minPlayersToStart: 2,
    codeLength: 3,
    heartbeatMs: 25000
  },

  phase: {
    firstDaySeconds: 20,
    daySeconds: 60,
    nightSeconds: 60,
    dayResultSeconds: 15,
    nightResultSeconds: 15,
    votingOpensAtProgress: 60
  },

  player: {
    defaultNamePrefix: "Jogador",
    initialEnergy: 2,
    maxEnergy: 3,
    minEnergy: 0
  },

  energy: {
    action1Cost: 1,
    action2Cost: 2,
    sleepGain: 1
  },

  microgame: {
    score: {
      min: 0,
      max: 4,
      defaultPass: MICROGAME_SCORE.GOOD,
      defaultFail: MICROGAME_SCORE.CRITICAL_FAIL,
      skipped: MICROGAME_SCORE.CRITICAL_SUCCESS
    },

    scoreLabels: {
      0: "falha crítica",
      1: "sucesso",
      2: "sucesso médio",
      3: "sucesso bom",
      4: "sucesso crítico"
    },

    byCategory: {
      [MICROGAME_CATEGORY.NONE]: {
        pool: [MICROGAME_ID.NONE],
        timeLimit: 0,
        difficulty: 0
      },
      [MICROGAME_CATEGORY.INVESTIGATION]: {
        pool: [MICROGAME_ID.GAME_1],
        timeLimit: 8,
        difficulty: 1
      },
      [MICROGAME_CATEGORY.VIOLENCE]: {
        pool: [MICROGAME_ID.GAME_3],
        timeLimit: 7,
        difficulty: 1
      },
      [MICROGAME_CATEGORY.RITUAL]: {
        pool: [MICROGAME_ID.GAME_2],
        timeLimit: 8,
        difficulty: 1
      },
      [MICROGAME_CATEGORY.MANIPULATION]: {
        pool: [MICROGAME_ID.GAME_1, MICROGAME_ID.GAME_2],
        timeLimit: 8,
        difficulty: 1
      },
      [MICROGAME_CATEGORY.INVASION]: {
        pool: [MICROGAME_ID.GAME_2, MICROGAME_ID.GAME_3],
        timeLimit: 7,
        difficulty: 1
      },
      [MICROGAME_CATEGORY.WATCH]: {
        pool: [MICROGAME_ID.GAME_1],
        timeLimit: 8,
        difficulty: 1
      },
      [MICROGAME_CATEGORY.RECOVERY]: {
        pool: [MICROGAME_ID.NONE],
        timeLimit: 0,
        difficulty: 0
      }
    },

    sabotageDifficultyBonus: 1
  },

  clues: {
    maxPrivateCluesPerPlayerPerNight: 2,
    maxPublicCluesPerNight: 2,
    homeIntrusionMinimumScore: 1,
    vigilanteBackfireMinimumScore: 3,

    // A pista agora é gerada por um núcleo único de observação.
    // A informação pode ser real, falsa ou plantada; a frase base não revela isso.
    scoreRules: {
      defaultScore: 2,
      scoreZeroNoClueChance: 0.45,
      hauntedSyntheticScore: 1,
      penalties: {
        blackout: -2,
        paranoia: -1,
        haunted: -2
      },
      profileBias: {
        generic: 0,
        ambient: 0,
        incidental: -1,
        journalist: 0,
        investigation: 1,
        medium: 0,
        plantedEvidence: 0,
        vigilanteBackfire: 1,
        hauntedSynthetic: 0
      }
    },

    categoryPriority: {
      ownAction: 100,
      ownHome: 95,
      missedHome: 92,
      protected: 92,
      roleResult: 90,
      marked: 88,
      plantedEvidence: 86,
      vigilanteBackfire: 85,
      bounty: 82,
      targetHome: 76,
      targetPoi: 70,
      routePoi: 55,
      routeRoad: 45,
      watchQuiet: 30,
      haunted: 40,
      generic: 10
    },

    templateVariables: {
      "{place}": "Local/região principal da pista.",
      "{detail}": "Detalhe construído pela ação, como jogadores vistos.",
      "{player}": "Jogador citado pela pista.",
      "{players}": "Lista de jogadores citados.",
      "{playersVerb}": "Verbo flexionado para lista de jogadores.",
      "{direction}": "Direção aproximada da movimentação.",
      "{actor}": "Autor da ação.",
      "{targetPlayer}": "Jogador alvo.",
      "{target player}": "Alias de {targetPlayer}.",
      "{targetRole}": "Papel do alvo.",
      "{crimeScene}": "Cena ou região do crime.",
      "{crime scene}": "Alias de {crimeScene}.",
      "{adjacentCrimeSceneRoad}": "Rua adjacente à cena do crime.",
      "{adjacent crime scene road}": "Alias de {adjacentCrimeSceneRoad}.",
      "{actionPath}": "Caminho provável do autor da ação.",
      "{action path}": "Alias de {actionPath}.",
      "{actionPathPartial}": "Trecho parcial do caminho provável.",
      "{action path partial}": "Alias de {actionPathPartial}.",
      "{actionApproachRoad}": "Última rua antes do destino.",
      "{action approach road}": "Alias de {actionApproachRoad}.",
      "{actionApproachDirection}": "Direção aproximada de chegada.",
      "{action approach direction}": "Alias de {actionApproachDirection}.",
      "{effect}": "Nome de efeito recebido pelo jogador.",
      "{poi}": "POI relacionado."
    },

    // Escala central de precisão.
    // 0: nenhuma pista, pista falsa ou confusa.
    // 1: pista vaga.
    // 2: movimentação sem direção.
    // 3: movimentação com noção de direção.
    // 4: reconhecimento de jogador(es).
      observationTemplates: {
      normal: {
        0: [
          "Você não conseguiu interpretar direito o que percebeu em {place}.",
          "Algo pareceu estranho em {place}, mas nada fechava."
        ],
        1: [
          "Você sentiu que talvez tenha havido movimentação em {place}.",
          "Parecia possível que alguém tivesse passado por {place}."
        ],
        2: [
          "Você percebeu movimentação em {place}.",
          "Houve sinais de atividade em {place}."
        ],
        3: [
          "Você percebeu movimentação vindo do {direction}, perto de {place}.",
          "Houve atividade em {place}, com sinais vindos do {direction}."
        ],
        4: [
          "{players} {playersVerb} em {place}.",
          "Você reconheceu {players} em {place}."
        ]
      },
      supernatural: {
        0: [
          "Você sentiu uma presença sem forma em {place}.",
          "Algo assombrou sua percepção em {place}, mas nada fazia sentido."
        ],
        1: [
          "Você sentiu uma presença rondando {place}.",
          "Parecia haver uma sombra passando por {place}."
        ],
        2: [
          "Você ouviu passos estranhos em {place}.",
          "Uma movimentação quase sobrenatural passou por {place}."
        ],
        3: [
          "Você ouviu algo vindo do {direction}, perto de {place}.",
          "Uma sombra pareceu se mover do {direction} para {place}."
        ],
        4: [
          "Você reconheceu {players} entre as sombras de {place}.",
          "{players} {playersVerb} como vultos em {place}."
        ]
      },
      publicNormal: {
        0: [
          "Nada confiável foi apurado em {place}.",
          "Os sinais em {place} não fecharam."
        ],
        1: [
          "Talvez tenha havido movimentação em {place}.",
          "Parecia possível que alguém tivesse passado por {place}."
        ],
        2: [
          "Houve movimentação em {place}.",
          "Houve sinais de atividade em {place}."
        ],
        3: [
          "Houve movimentação vindo do {direction}, perto de {place}.",
          "Houve atividade em {place}, com sinais vindos do {direction}."
        ],
        4: [
          "{players} {playersVerb} em {place}.",
          "{players} {playersVerb} em {place}."
        ]
      },
      publicSupernatural: {
        0: [
          "Os sinais estranhos em {place} não fecharam.",
          "Nada confiável foi apurado entre as sombras de {place}."
        ],
        1: [
          "Parecia haver uma presença rondando {place}.",
          "Talvez uma sombra tenha passado por {place}."
        ],
        2: [
          "Houve passos estranhos em {place}.",
          "Uma movimentação quase sobrenatural passou por {place}."
        ],
        3: [
          "Algo pareceu vir do {direction}, perto de {place}.",
          "Uma sombra pareceu se mover do {direction} para {place}."
        ],
        4: [
          "{players} {playersVerb} entre as sombras de {place}.",
          "{players} {playersVerb} como vultos em {place}."
        ]
      }
    },

    templates: {
      ownStayHomeAwake: [
        "Você ficou em casa acordado, mas não percebeu nada confiável."
      ],
      ownVisitPoi: [
        "Você foi até {place} e observou a região."
      ],
      ownKill: [
        "Você foi até a casa de {targetPlayer}."
      ],
      protectedAttack: [
        "Algo tentou atingir {targetPlayer}, mas a proteção segurou o ataque."
      ],
      journalistPublished: [
        "Relato do jornalista sobre {place}: {detail}"
      ],
      bountyTargetRole: [
        "Seu alvo tem o papel: {targetRole}."
      ],
      obsessorMarked: [
        "Você marcou {targetPlayer}. A morte virá sem deixar pistas na próxima noite."
      ],
      obsessorVictimMarked: [
        "Você sentiu que algo ficou preso em você durante a noite."
      ],
      sabotageBlackoutStarted: [
        "As luzes do bairro foram apagadas. As pistas ficarão mais fracas até alguém passar uma noite em {poi}."
      ],
      sabotageMicrogameDifficultyStarted: [
        "Algo perturbou o bairro. Os próximos microgames ficarão mais difíceis por uma noite."
      ],
      sabotageCurseStarted: [
        "Uma assombração caiu sobre parte do bairro. Alguns jogadores receberão pistas confusas e sobrenaturais."
      ],
      blackoutRepaired: [
        "As luzes do bairro foram restauradas em {poi}."
      ],
      hauntedRemoved: [
        "A assombração sobre {player} foi removida em {poi}."
      ]
    }
  },
  effects: {
    failedKillAtEmptyHomeAppliesParanoia: true,

    [EFFECT_KEY.PARANOIA]: {
      id: EFFECT_KEY.PARANOIA,
      label: "Paranoia",
      privateMessage: "Você está com paranoia. Suas pistas nestas noites virão mais confusas."
    },
    [EFFECT_KEY.HAUNTED]: {
      id: EFFECT_KEY.HAUNTED,
      label: "Assombrado",
      privateMessage: "Você está assombrado. Suas pistas podem vir com sinais sobrenaturais e menos precisão. Vá à igreja para tentar limpar o efeito."
    }
  },

  sabotages: {
    repairDelayNights: 1,
    pool: [
      SABOTAGE_KEY.BLACKOUT,
      SABOTAGE_KEY.MICROGAME_DIFFICULTY,
      SABOTAGE_KEY.CURSE
    ],
    [SABOTAGE_KEY.BLACKOUT]: {
      id: SABOTAGE_KEY.BLACKOUT,
      label: "Apagão",
      repairPoiCode: "red",
      canRepairAfterNights: 1
    },
    [SABOTAGE_KEY.MICROGAME_DIFFICULTY]: {
      id: SABOTAGE_KEY.MICROGAME_DIFFICULTY,
      label: "Pressão",
      durationNights: 1
    },
    [SABOTAGE_KEY.CURSE]: {
      id: SABOTAGE_KEY.CURSE,
      label: "Assombração",
      affectedPlayerCount: 2,
      repairPoiCode: "purple"
    }
  }
};


// ============================================================
// AJUSTES DE UTILIDADE DAS PISTAS
// ============================================================
// scoreBias controla a utilidade geral das pistas sem mexer nos microgames:
// -2 = muito social/confuso; -1 = social; 0 = normal; +1 = mais informativo; +2 = muito informativo.
CONFIG.clues.utility = {
  scoreBias: 0
};

// Pistas quando a informação útil é que o dono ficou em casa.
CONFIG.clues.observationTemplates.normalOwnerAtHome = {
  0: [
    "Você não conseguiu concluir se havia alguém em {place}.",
    "Os sinais em {place} não deixaram claro se alguém ficou por ali."
  ],
  1: [
    "Alguém parecia estar em {place}.",
    "Parecia haver alguém em {place}, mas não dava para saber quem."
  ],
  2: [
    "Havia sinais de presença em {place}.",
    "Alguém estava em {place}, mas você não conseguiu reconhecer quem."
  ],
  3: [
    "Você percebeu que {place} parecia ocupada durante a noite.",
    "Havia sinais fortes de que alguém ficou em {place}."
  ],
  4: [
    "Você viu que {player} não saiu de casa.",
    "Você confirmou que {player} ficou em casa durante a noite."
  ]
};

CONFIG.clues.observationTemplates.publicNormalOwnerAtHome = {
  0: [
    "Não foi possível concluir se havia alguém em {place}.",
    "Os sinais em {place} não deixaram claro se alguém ficou por ali."
  ],
  1: [
    "Alguém parecia estar em {place}.",
    "Parecia haver alguém em {place}, mas não dava para saber quem."
  ],
  2: [
    "Havia sinais de presença em {place}.",
    "Alguém estava em {place}, sem identificação clara."
  ],
  3: [
    "{place} parecia ocupada durante a noite.",
    "Havia sinais fortes de que alguém ficou em {place}."
  ],
  4: [
    "{player} não saiu de casa.",
    "Foi confirmado que {player} ficou em casa durante a noite."
  ]
};

CONFIG.clues.observationTemplates.supernaturalOwnerAtHome = {
  0: [
    "As sombras em {place} não deixaram claro se havia alguém ali.",
    "Algo assombrou sua percepção sobre {place}."
  ],
  1: [
    "Parecia haver uma presença parada em {place}.",
    "Uma sombra parecia ocupar {place}, mas não dava para saber quem era."
  ],
  2: [
    "Havia sinais de presença em {place}, como se alguém ou algo tivesse ficado ali.",
    "Você sentiu uma presença presa a {place}."
  ],
  3: [
    "{place} parecia ocupada por uma presença durante a noite.",
    "As sombras indicavam que alguém ficou em {place}."
  ],
  4: [
    "Você reconheceu que {player} permaneceu em casa entre as sombras.",
    "Você viu que {player} permaneceu em casa como um vulto imóvel."
  ]
};

CONFIG.clues.observationTemplates.publicSupernaturalOwnerAtHome = {
  0: [
    "As sombras em {place} não deixaram claro se havia alguém ali.",
    "Nada confiável foi apurado sobre a presença em {place}."
  ],
  1: [
    "Parecia haver uma presença parada em {place}.",
    "Uma sombra parecia ocupar {place}, mas não dava para saber quem era."
  ],
  2: [
    "Havia sinais de presença em {place}, como se alguém ou algo tivesse ficado ali.",
    "Uma presença parecia presa a {place}."
  ],
  3: [
    "{place} parecia ocupada por uma presença durante a noite.",
    "As sombras indicavam que alguém ficou em {place}."
  ],
  4: [
    "{player} foi reconhecido permanecendo em casa entre as sombras.",
    "{player} permaneceu em casa como um vulto imóvel."
  ]
};

// Pistas quando a informação é ausência de atividade observável.
CONFIG.clues.observationTemplates.normalNoActivity = {
  0: [
    "Você não conseguiu concluir nada sobre {place}.",
    "Nada em {place} pareceu confiável o bastante para interpretar."
  ],
  1: [
    "Você não percebeu nada confiável em {place}.",
    "Não deu para saber se houve movimentação em {place}."
  ],
  2: [
    "Você não percebeu movimentação clara em {place}.",
    "Não havia sinais claros de atividade em {place}."
  ],
  3: [
    "Você não notou movimentação relevante em {place}.",
    "{place} pareceu quieta durante a noite."
  ],
  4: [
    "Você observou bem {place} e não notou movimentação visível.",
    "{place} pareceu quieta mesmo depois de uma noite inteira de atenção."
  ]
};

CONFIG.clues.observationTemplates.publicNormalNoActivity = {
  0: [
    "Nada confiável foi apurado em {place}.",
    "Os sinais em {place} não permitiram conclusão."
  ],
  1: [
    "Não deu para saber se houve movimentação em {place}.",
    "Não houve sinal confiável sobre {place}."
  ],
  2: [
    "Não havia sinais claros de atividade em {place}.",
    "Não foi percebida movimentação clara em {place}."
  ],
  3: [
    "Não foi notada movimentação relevante em {place}.",
    "{place} pareceu quieta durante a noite."
  ],
  4: [
    "Não foi notada movimentação visível em {place}.",
    "{place} pareceu quieta durante a noite."
  ]
};

CONFIG.clues.observationTemplates.supernaturalNoActivity = {
  0: [
    "As sombras não deixaram nada claro em {place}.",
    "Algo confundiu completamente sua percepção em {place}."
  ],
  1: [
    "Você só sentiu silêncio estranho em {place}.",
    "Não deu para saber se havia algo real em {place}."
  ],
  2: [
    "Você não percebeu passos claros em {place}, apenas ecos estranhos.",
    "{place} parecia quieta, mas pesada."
  ],
  3: [
    "Você não notou movimentação real em {place}, só uma presença distante.",
    "As sombras em {place} ficaram paradas durante a noite."
  ],
  4: [
    "Você observou {place} entre as sombras e não viu movimentação real.",
    "Você confirmou que nenhum vulto real se moveu por {place}."
  ]
};

CONFIG.clues.observationTemplates.publicSupernaturalNoActivity = {
  0: [
    "As sombras não deixaram nada claro em {place}.",
    "Nada confiável foi apurado entre as sombras de {place}."
  ],
  1: [
    "Só havia um silêncio estranho em {place}.",
    "Não deu para saber se havia algo real em {place}."
  ],
  2: [
    "Não houve passos claros em {place}, apenas ecos estranhos.",
    "{place} parecia quieta, mas pesada."
  ],
  3: [
    "Não foi notada movimentação real em {place}, só uma presença distante.",
    "As sombras em {place} ficaram paradas durante a noite."
  ],
  4: [
    "Não houve movimentação real em {place}.",
    "Nenhum vulto real se moveu por {place}."
  ]
};

module.exports = CONFIG;
