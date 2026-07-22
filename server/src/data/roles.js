const { ALIGNMENT, ROLE_KEY } = require("../constants");

const ROLE_DEFINITIONS = {
  [ROLE_KEY.RESIDENT]: {
    id: ROLE_KEY.RESIDENT,
    name: "Morador",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Sobreviva, observe o bairro e descubra quem está mentindo.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "goOutToPoi",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.DETECTIVE]: {
    id: ROLE_KEY.DETECTIVE,
    name: "Detetive",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Investigue regiões e compare pistas com os outros jogadores.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "investigateRegion",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.MEDIUM]: {
    id: ROLE_KEY.MEDIUM,
    name: "Medium",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Sinta rastros espirituais sem receber respostas completas.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "mediumSensePresence",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.UNICORN]: {
    id: ROLE_KEY.UNICORN,
    name: "Unicórnio",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Proteja alguém durante a noite, inclusive você mesmo.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "protectPlayer",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.JOURNALIST]: {
    id: ROLE_KEY.JOURNALIST,
    name: "Jornalista",
    alignment: ALIGNMENT.INNOCENT,
    roleMessage: "Publique pistas de uma região para todos verem.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "publishRegionClue",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.VIGILANTE]: {
    id: ROLE_KEY.VIGILANTE,
    name: "Vigilante",
    alignment: ALIGNMENT.INNOCENT,
    minPlayers: 8,
    roleMessage: "Você pode executar uma vítima, mas erros contra inocentes deixam rastros graves.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "vigilanteKill",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.KILLER]: {
    id: ROLE_KEY.KILLER,
    name: "Assassino",
    alignment: ALIGNMENT.IMPOSTOR,
    roleMessage: "Mate à noite ou sabote o bairro para enfraquecer as pistas.",
    actionSlots: {
      action1: "killPlayer",
      action2: "sabotage",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.STALKER]: {
    id: ROLE_KEY.STALKER,
    name: "Espreitador",
    alignment: ALIGNMENT.IMPOSTOR,
    roleMessage: "Mate em casa ou embosque pessoas voltando de um POI.",
    actionSlots: {
      action1: "killPlayer",
      action2: "stalkPoi",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.OBSESSOR]: {
    id: ROLE_KEY.OBSESSOR,
    name: "Obsessor",
    alignment: ALIGNMENT.IMPOSTOR,
    roleMessage: "Mate diretamente ou marque alguém para morrer depois sem deixar pistas.",
    actionSlots: {
      action1: "killPlayer",
      action2: "obsessorMark",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.METAMORPH]: {
    id: ROLE_KEY.METAMORPH,
    name: "Metamorfo",
    alignment: ALIGNMENT.IMPOSTOR,
    roleMessage: "Mate como impostor. Seu disfarce visual será uma habilidade específica futura.",
    actionSlots: {
      action1: "killPlayer",
      action2: "metamorphDisguise",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.ILLUSIONIST]: {
    id: ROLE_KEY.ILLUSIONIST,
    name: "Ilusionista",
    alignment: ALIGNMENT.IMPOSTOR,
    roleMessage: "Mate como impostor. Suas ilusões futuras criarão pistas falsas com sintaxe real.",
    actionSlots: {
      action1: "killPlayer",
      action2: "illusionistPlantClue",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.OCCULTIST]: {
    id: ROLE_KEY.OCCULTIST,
    name: "Ocultista",
    alignment: ALIGNMENT.IMPOSTOR,
    roleMessage: "Mate como impostor. Suas maldições futuras agirão como controle sobrenatural.",
    actionSlots: {
      action1: "killPlayer",
      action2: "occultistCurse",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.HYPNOTIST]: {
    id: ROLE_KEY.HYPNOTIST,
    name: "Hipnotizador",
    alignment: ALIGNMENT.IMPOSTOR,
    roleMessage: "Mate como impostor. Sua hipnose futura mexerá com sono e agência.",
    actionSlots: {
      action1: "killPlayer",
      action2: "hypnotistSleep",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.LITHOMANCER]: {
    id: ROLE_KEY.LITHOMANCER,
    name: "Litomante",
    alignment: ALIGNMENT.IMPOSTOR,
    minPlayers: 8,
    roleMessage: "Mate como impostor. Seu Vaticínio chuta o papel de alguém: se acertar, mata sem pistas; se errar, você morre.",
    actionSlots: {
      action1: "killPlayer",
      action2: "lithomancerGuess",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.JOKER]: {
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

  [ROLE_KEY.INSTIGATOR]: {
    id: ROLE_KEY.INSTIGATOR,
    name: "Instigador",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Faça seu alvo sorteado ser eliminado por votação.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "plantEvidence",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.LAWYER]: {
    id: ROLE_KEY.LAWYER,
    name: "Advogado",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Você tem um cliente secreto. Se ele morrer, você morre junto; se ele vencer, você vence junto.",
    actionSlots: {
      action1: "stayHomeAwake",
      action2: "goOutToPoi",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.POSSESSED]: {
    id: ROLE_KEY.POSSESSED,
    name: "Possuído",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Assassine, condene alguém à sua linhagem e sobreviva ao colapso da partida.",
    actionSlots: {
      action1: "possessedKill",
      action2: "possessedCondemn",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.CONDEMNED]: {
    id: ROLE_KEY.CONDEMNED,
    name: "Condenado",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Você foi condenado. Vença junto da linhagem do Possuído.",
    actionSlots: {
      action1: "possessedKill",
      action2: "possessedSynergy",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.BOUNTY_HUNTER]: {
    id: ROLE_KEY.BOUNTY_HUNTER,
    name: "Caçador de Recompensas",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Você recebe apenas o papel do seu alvo. Elimine-o para vencer.",
    actionSlots: {
      action1: "bountyKill",
      action2: "investigateRegion",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.THIEF]: {
    id: ROLE_KEY.THIEF,
    name: "Ladrão",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Papel cadastrado para patch futuro. O valor roubado será decidido no minigame próprio.",
    disabled: true,
    actionSlots: {
      action1: "thiefRob",
      action2: "none",
      sleep: "sleep"
    }
  },

  [ROLE_KEY.CULTIST]: {
    id: ROLE_KEY.CULTIST,
    name: "Cultista",
    alignment: ALIGNMENT.NEUTRAL,
    roleMessage: "Complete 4 etapas de ritual em POIs específicos.",
    actionSlots: {
      action1: "cultistRitualStep",
      action2: "none",
      sleep: "sleep"
    }
  }
};

module.exports = {
  ROLE_DEFINITIONS
};
