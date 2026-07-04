export const STARTING_BINDINGS = [
  { type: "string", name: "playerName", state: "playerName" },
  { type: "string", name: "roomCode", state: "roomCode" }
];

export const VILLAGE_BINDINGS = [
  { type: "string", name: "roomCode", state: "roomCode" },
  { type: "string", name: "playersData", state: "playersData" },

  // POIs / pontos de interesse.
  { type: "string", name: "poisData", state: "poisData" },

  { type: "number", name: "playerCount", state: "playerCount" },
  { type: "number", name: "localPlayerIndex", state: "playerIndex" },

  { type: "enum", name: "phase", state: "phaseEnum" },
  { type: "number", name: "dayNumber", state: "dayNumber" },

  { type: "number", name: "phaseTimeRemaining", state: "phaseTimeRemaining" },
  { type: "number", name: "phaseTimeTotal", state: "phaseTimeTotal" },
  { type: "number", name: "phaseProgress", state: "phaseProgress" },

  { type: "string", name: "publicMessage", state: "publicMessage" },

  // Seleção de casas/jogadores.
  { type: "boolean", name: "selectionEnabled", state: "selectionEnabled" },
  { type: "number", name: "selectedPlayerIndex", state: "localSelectedPlayerIndex" },

  // Seleção de POIs.
  { type: "boolean", name: "poiSelectionEnabled", state: "poiSelectionEnabled" },
  { type: "number", name: "selectedPoiIndex", state: "localSelectedPoiIndex" },
  { type: "string", name: "selectedPoiCode", state: "localSelectedPoiCode" },
  { type: "enum", name: "selectedPoiType", state: "localSelectedPoiType" },

  { type: "number", name: "skipVoteCount", state: "skipVoteCount" },
  { type: "number", name: "submittedVoteCount", state: "submittedVoteCount" },
  { type: "number", name: "eligibleVoteCount", state: "eligibleVoteCount" },

  { type: "boolean", name: "hasVictim", state: "hasVictim" },
  { type: "number", name: "lastVictimIndex", state: "lastVictimIndex" },
  { type: "string", name: "lastVictimName", state: "lastVictimName" },

  { type: "boolean", name: "hasDayResult", state: "hasDayResult" },
  { type: "boolean", name: "hasVotedOut", state: "hasVotedOut" },
  { type: "number", name: "lastVotedOutIndex", state: "lastVotedOutIndex" },
  { type: "string", name: "lastVotedOutName", state: "lastVotedOutName" },

  { type: "boolean", name: "hasNightResult", state: "hasNightResult" },

  { type: "enum", name: "winner", state: "winnerEnum" },
  { type: "string", name: "gameOverMessage", state: "gameOverMessage" }
];

export const PLAYER_BINDINGS = [
  { type: "enum", name: "phase", state: "phaseEnum" },

  // Mantido por compatibilidade enquanto o Rive ainda tiver esse bind.
  { type: "string", name: "playerId", state: "playerId" },

  { type: "number", name: "playerIndex", state: "playerIndex" },
  { type: "string", name: "playerName", state: "playerName" },

  { type: "boolean", name: "isHost", state: "isHost" },
  { type: "boolean", name: "isAlive", state: "isAlive" },

  // Mantido por enquanto. Pode ser removido depois se o Rive não usar.
  { type: "boolean", name: "isImpostor", state: "isImpostor" },

  { type: "string", name: "roleName", state: "roleName" },
  { type: "string", name: "roleMessage", state: "roleMessage" },

  // Fonte única de CTA/narrativa: server/src/messages.js.
  { type: "string", name: "privateMessage", state: "privateMessage" },

  { type: "boolean", name: "canStartGame", state: "canStartGame" },

  { type: "enum", name: "interactionMode", state: "interactionMode" },

  // Energia.
  { type: "number", name: "energy", state: "energy" },
  { type: "number", name: "maxEnergy", state: "maxEnergy" },

  // Botões/descrições de ações disponíveis.
  { type: "string", name: "action1Label", state: "action1Label" },
  { type: "string", name: "action2Label", state: "action2Label" },
  { type: "string", name: "action1Description", state: "action1Description" },
  { type: "string", name: "action2Description", state: "action2Description" },

  // Atividade pendente.
  { type: "boolean", name: "hasPendingAction", state: "hasPendingAction" },
  { type: "boolean", name: "pendingActionNeedsTarget", state: "pendingActionNeedsTarget" },
  { type: "boolean", name: "canConfirmAction", state: "canConfirmAction" },

  { type: "string", name: "selectedActionId", state: "selectedActionId" },
  { type: "string", name: "selectedActionLabel", state: "selectedActionLabel" },
  { type: "string", name: "selectedActionDescription", state: "selectedActionDescription" },

  // Alvo atual da atividade.
  { type: "enum", name: "selectedTargetType", state: "selectedTargetType" },
  { type: "boolean", name: "hasSelectedTarget", state: "hasSelectedTarget" },
  { type: "number", name: "selectedTargetIndex", state: "selectedTargetIndex" },
  { type: "string", name: "selectedTargetName", state: "selectedTargetName" },

  { type: "boolean", name: "hasSkipped", state: "hasSkipped" }
];

export const MICROGAME_BINDINGS = [
  { type: "enum", name: "microGameId", state: "microGameId" },
  { type: "enum", name: "microGameCategory", state: "microGameCategory" },
  { type: "enum", name: "microGameState", state: "microGameState" },

  { type: "number", name: "seed", state: "microgameSeed" },
  { type: "number", name: "timeLimit", state: "microgameTimeLimit" },
  { type: "number", name: "difficulty", state: "microgameDifficulty" }

  // Não coloque actionCommand/actionTrigger aqui.
  // Eles são canal de saída do microgame para o JS:
  // pass/fail devem ser lidos pelo listener, não sobrescritos por applyBindings().
];
