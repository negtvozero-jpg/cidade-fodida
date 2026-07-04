import { encodePlayersData } from "./playersData.js";
import { setupViewportHandling, updateViewportHeight } from "./viewport.js";
import { vibrateStarting, vibrateGlobal } from "./vibration.js";

import {
  STARTING_BINDINGS,
  VILLAGE_BINDINGS,
  PLAYER_BINDINGS
} from "./rive/bindings.js";

import {
  applyBindings,
  getVMNumber,
  getVMEnum,
  setVMNumber,
  setVMEnum,
  setVMBoolean,
  setVMString
} from "./rive/vm.js";

// Configurações de jogo vêm do snapshot privado enviado pelo servidor.
const TARGET_TYPE = {
  NONE: "none",
  PLAYER: "player",
  POI: "poi",
  REGION: "region"
};

const MICROGAME_ID = {
  NONE: "none",
  GAME_1: "game1",
  GAME_2: "game2",
  GAME_3: "game3"
};

const RIVE_SRC = "./game.riv";

const ARTBOARD_STARTING = "Starting";
const ARTBOARD_VILLAGE = "Village";
const ARTBOARD_PLAYER = "Player";
const STATE_MACHINE = "State Machine 1";

const MICROGAME_ARTBOARDS = {
  [MICROGAME_ID.GAME_1]: "Game1",
  [MICROGAME_ID.GAME_2]: "Game2",
  [MICROGAME_ID.GAME_3]: "Game3"
};

const PHASE = {
  LOBBY: 0,
  DAY: 1,
  NIGHT: 2,
  GAME_OVER: 3,
  NIGHT_RESULT: 4,
  DAY_RESULT: 5
};

const EDIT_MODE = {
  NONE: "",
  PLAYER_NAME: "playerName",
  ROOM_CODE: "roomCode"
};

const PHASE_ENUM = {
  [PHASE.LOBBY]: "lobby",
  [PHASE.DAY]: "day",
  [PHASE.NIGHT]: "night",
  [PHASE.GAME_OVER]: "gameOver",
  [PHASE.NIGHT_RESULT]: "nightResult",
  [PHASE.DAY_RESULT]: "dayResult"
};

const WINNER_ENUM = {
  0: "none",
  1: "innocents",
  2: "impostors",
  3: "neutral"
};

const INTERACTION_MODE = {
  NONE: "none",
  VOTE: "vote",
  VICTIM: "victim",
  POI: "poi"
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

const MICROGAME_STATE = {
  IDLE: "idle",
  RUNNING: "running",
  FINISHED: "finished"
};

const POI_CODES = ["purple", "green", "yellow", "blue", "red"];

const POI_NAMES = {
  purple: "Igreja",
  green: "Mercado",
  yellow: "Praça",
  blue: "Poço",
  red: "Viela"
};

const riveRuntime = window.rive;
const ioRuntime = window.io;

let socket = null;

let startingRive = null;
let villageRive = null;
let playerRive = null;
let microgameRive = null;

let startingVM = null;
let villageVM = null;
let playerVM = null;
let microgameVM = null;

let startingTriggersBound = false;
let playerTriggersBound = false;
let microgameTriggersBound = false;

let activeEditMode = EDIT_MODE.NONE;
let pendingActivity = null;
let activeMicrogameArtboard = "";

const clientState = {
  screen: "starting",
  hasReceivedSnapshot: false,

  roomCode: "",
  playerId: "",
  playerIndex: 0,
  playerName: "",
  isHost: false,

  players: [],
  playerCount: 0,

  phase: PHASE.LOBBY,
  dayNumber: 0,

  phaseTimeRemaining: 0,
  phaseTimeTotal: 0,
  phaseProgress: 0,

  publicMessage: "",
  privateMessage: "",

  roleName: "",
  roleMessage: "",

  action1Label: "",
  action2Label: "",
  action1Description: "",
  action2Description: "",

  actions: {
    action1: null,
    action2: null,
    sleep: null
  },

  isImpostor: false,
  isAlive: true,

  energy: 0,
  maxEnergy: 0,

  canStartGame: false,
  canChooseVictim: false,

  hasVictim: false,
  lastVictimIndex: -1,
  lastVictimName: "",

  skipVoteCount: 0,
  submittedVoteCount: 0,
  eligibleVoteCount: 0,

  hasDayResult: false,
  hasVotedOut: false,
  lastVotedOutIndex: -1,
  lastVotedOutName: "",

  hasNightResult: false,

  winner: 0,
  gameOverMessage: "",

  hasSelectedVictim: false,
  selectedVictimIndex: -1,
  selectedVictimName: "",

  canVote: false,
  hasVoted: false,
  votedTargetIndex: -1,
  votedTargetName: "",
  votedSkip: false,

  hasSelectedTarget: false,
  selectedTargetIndex: -1,
  selectedTargetName: "",

  localSelectedPlayerIndex: -1,

  localSelectedPoiIndex: -1,
  localSelectedPoiCode: "",
  localSelectedPoiType: "none",

  pois: POI_CODES.map((code, index) => ({
    index: index + 1,
    code,
    poiType: code,
    status: "normal",
    selectionEnabled: true,
    name: POI_NAMES[code] || code
  }))
};

const els = {
  startingScreen: document.getElementById("starting-screen"),
  gameScreen: document.getElementById("game-screen"),

  startingCanvas: document.getElementById("startingCanvas"),
  villageCanvas: document.getElementById("villageCanvas"),
  playerCanvas: document.getElementById("playerCanvas"),
  microgameLayer: document.getElementById("microgame-layer"),
  microgameCanvas: document.getElementById("microgameCanvas"),

  hiddenTextInput: document.getElementById("hiddenTextInput")
};

boot();

function boot() {
  bindDOM();
  setupViewportHandling(resizeAllRive);
  connectSocket();

  loadStartingRive();
  loadVillageRive();
  loadPlayerRive();

  startSelectionPolling();
  startHeartbeat();
}

function connectSocket() {
  socket = ioRuntime();

  socket.on("connect", () => {
    console.log("[SOCKET] conectado:", socket.id);
    applyClientStateToRive();
  });

  socket.on("disconnect", () => {
    console.log("[SOCKET] desconectado");
    applyClientStateToRive();
  });

  socket.on("connect_error", error => {
    console.warn("[SOCKET] connect_error:", error);
  });

  socket.on("room:snapshot", snapshot => {
    console.log("[SOCKET] room:snapshot", snapshot);
    applySnapshot(snapshot);
  });
}

function loadStartingRive() {
  startingRive = new riveRuntime.Rive({
    src: RIVE_SRC,
    canvas: els.startingCanvas,
    artboard: ARTBOARD_STARTING,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
    layout: new riveRuntime.Layout({
      fit: riveRuntime.Fit.Contain,
      alignment: riveRuntime.Alignment.TopCenter
    }),
    onLoad: () => {
      startingRive.resizeDrawingSurfaceToCanvas();
      startingVM = startingRive.viewModelInstance;

      bindStartingTriggers();
      applyClientStateToRive();

      requestAnimationFrame(resizeAllRive);
      setTimeout(resizeAllRive, 100);
    }
  });
}

function loadVillageRive() {
  villageRive = new riveRuntime.Rive({
    src: RIVE_SRC,
    canvas: els.villageCanvas,
    artboard: ARTBOARD_VILLAGE,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
    layout: new riveRuntime.Layout({
      fit: riveRuntime.Fit.Contain,
      alignment: riveRuntime.Alignment.TopCenter
    }),
    onLoad: () => {
      villageRive.resizeDrawingSurfaceToCanvas();
      villageVM = villageRive.viewModelInstance;

      applyClientStateToRive();

      requestAnimationFrame(resizeAllRive);
      setTimeout(resizeAllRive, 100);
    }
  });
}

function loadPlayerRive() {
  playerRive = new riveRuntime.Rive({
    src: RIVE_SRC,
    canvas: els.playerCanvas,
    artboard: ARTBOARD_PLAYER,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
    layout: new riveRuntime.Layout({
      fit: riveRuntime.Fit.Contain,
      alignment: riveRuntime.Alignment.TopCenter
    }),
    onLoad: () => {
      playerRive.resizeDrawingSurfaceToCanvas();
      playerVM = playerRive.viewModelInstance;

      bindPlayerTriggers();
      applyClientStateToRive();

      requestAnimationFrame(resizeAllRive);
      setTimeout(resizeAllRive, 100);
    }
  });
}

function loadMicrogameRive(microgameId) {
  if (!els.microgameCanvas) {
    console.warn("[MICROGAME] #microgameCanvas não existe no HTML.");
    hideMicrogameLayer();
    return;
  }

  const artboard = MICROGAME_ARTBOARDS[microgameId];

  if (!artboard) {
    console.warn("[MICROGAME] artboard não configurado para:", microgameId);
    hideMicrogameLayer();
    return;
  }

  if (microgameRive && activeMicrogameArtboard === artboard) {
    syncPendingActivityToMicrogameVM();
    return;
  }

  try {
    if (microgameRive && typeof microgameRive.cleanup === "function") {
      microgameRive.cleanup();
    }
  } catch (error) {
    console.warn("[MICROGAME] erro ao limpar instância anterior:", error);
  }

  microgameRive = null;
  microgameVM = null;
  microgameTriggersBound = false;
  activeMicrogameArtboard = artboard;

  microgameRive = new riveRuntime.Rive({
    src: RIVE_SRC,
    canvas: els.microgameCanvas,
    artboard,
    stateMachines: STATE_MACHINE,
    autoplay: true,
    autoBind: true,
    layout: new riveRuntime.Layout({
      fit: riveRuntime.Fit.Contain,
      alignment: riveRuntime.Alignment.TopCenter
    }),
    onLoad: () => {
      microgameRive.resizeDrawingSurfaceToCanvas();
      microgameVM = microgameRive.viewModelInstance;

      bindMicrogameTriggers();
      syncPendingActivityToMicrogameVM();

      requestAnimationFrame(resizeAllRive);
      setTimeout(resizeAllRive, 100);
    }
  });
}

function resizeAllRive() {
  if (startingRive) startingRive.resizeDrawingSurfaceToCanvas();
  if (villageRive) villageRive.resizeDrawingSurfaceToCanvas();
  if (playerRive) playerRive.resizeDrawingSurfaceToCanvas();
  if (microgameRive) microgameRive.resizeDrawingSurfaceToCanvas();
}

function showMicrogameLayer() {
  if (!els.microgameLayer) return;

  els.microgameLayer.classList.add("is-open");
  els.microgameLayer.setAttribute("aria-hidden", "false");

  requestAnimationFrame(resizeAllRive);
  setTimeout(resizeAllRive, 100);
}

function hideMicrogameLayer() {
  if (!els.microgameLayer) return;

  els.microgameLayer.classList.remove("is-open");
  els.microgameLayer.setAttribute("aria-hidden", "true");

  requestAnimationFrame(resizeAllRive);
}

function bindStartingTriggers() {
  if (!startingVM || startingTriggersBound) return;

  bindTrigger(startingVM, "editPlayerNameTrigger", () => {
    vibrateStarting("EDIT_FIELD");
    openPlayerNameEditor();
  });

  bindTrigger(startingVM, "editRoomCodeTrigger", () => {
    vibrateStarting("EDIT_FIELD");
    openRoomCodeEditor();
  });

  bindTrigger(startingVM, "createRoomTrigger", () => {
    vibrateStarting("ROOM_ACTION");
    handleCreateRoom();
  });

  bindTrigger(startingVM, "joinRoomTrigger", () => {
    vibrateStarting("ROOM_ACTION");
    handleJoinRoom();
  });

  startingTriggersBound = true;
}

function bindPlayerTriggers() {
  if (!playerVM || playerTriggersBound) return;

  bindTrigger(playerVM, "startTrigger", handleStartGameFromRive);
  bindTrigger(playerVM, "actionTrigger", handleActionTriggerFromRive);

  playerTriggersBound = true;
}

function bindMicrogameTriggers() {
  if (!microgameVM || microgameTriggersBound) return;

  bindTrigger(microgameVM, "actionTrigger", handleMicrogameActionTriggerFromRive);

  microgameTriggersBound = true;
}

function handleMicrogameActionTriggerFromRive() {
  const command = getVMEnum(microgameVM, "actionCommand", ACTION_COMMAND.NONE);

  console.log("[RIVE] microgame actionCommand:", command);

  if (command === ACTION_COMMAND.PASS || command === ACTION_COMMAND.FAIL) {
    handleMicrogameResult(command);
  }

  setVMEnum(microgameVM, "actionCommand", ACTION_COMMAND.NONE);
}

function bindTrigger(vm, triggerName, callback) {
  try {
    const trigger = vm.trigger(triggerName);

    if (!trigger) {
      console.warn(`[RIVE] Trigger não encontrado: ${triggerName}`);
      return;
    }

    trigger.on(() => {
      console.log(`[RIVE] Trigger recebido: ${triggerName}`);
      callback();
    });

    console.log(`[RIVE] Trigger conectado: ${triggerName}`);
  } catch (error) {
    console.warn(`[RIVE] Erro ao conectar trigger ${triggerName}:`, error);
  }
}

function handleActionTriggerFromRive() {
  const command = getVMEnum(playerVM, "actionCommand", ACTION_COMMAND.NONE);

  console.log("[RIVE] actionCommand:", command);

  if (command === ACTION_COMMAND.ACTION_1) {
    beginPendingActivity(ACTION_COMMAND.ACTION_1);
  }

  if (command === ACTION_COMMAND.ACTION_2) {
    beginPendingActivity(ACTION_COMMAND.ACTION_2);
  }

  if (command === ACTION_COMMAND.SLEEP) {
    beginPendingActivity(ACTION_COMMAND.SLEEP);
  }

  if (command === ACTION_COMMAND.CONFIRM) {
    confirmPendingActivity();
  }

  if (command === ACTION_COMMAND.CANCEL) {
    clearPendingActivity();
  }

  if (command === ACTION_COMMAND.SKIP) {
    handleSkipFromRive();
  }

  if (command === ACTION_COMMAND.CLEAR_SELECTION) {
    if (pendingActivity) {
      clearPendingActivity();
    } else {
      handleClearSelectionFromRive();
    }
  }

  setVMEnum(playerVM, "actionCommand", ACTION_COMMAND.NONE);
}


function beginPendingActivity(actionCommand) {
  if (clientState.phase !== PHASE.NIGHT) {
    console.warn("[ACTIVITY] ação recusada: não está na fase NIGHT.");
    return;
  }

  if (!clientState.isAlive) {
    console.warn("[ACTIVITY] ação recusada: jogador morto.");
    return;
  }

  const definition = getConfiguredAction(actionCommand);

  if (!definition) {
    console.warn("[ACTIVITY] ação sem definição no snapshot:", actionCommand);
    return;
  }

  if (definition.implemented === false) {
    console.warn("[ACTIVITY] ação não implementada:", definition.id || actionCommand);
    return;
  }

  const energyCost = Number(definition.energyCost || 0);

  if (energyCost > getCurrentEnergy()) {
    console.warn("[ACTIVITY] ação recusada: energia insuficiente.");
    return;
  }

  clearPendingActivity();

  pendingActivity = {
    actionCommand,
    actionId: definition.id || actionCommand,
    actionClass: definition.actionClass || "unknown",

    label: definition.label || actionCommand,
    description: definition.description || "",

    energyCost,
    energyGain: Number(definition.energyGain || 0),

    targetType: definition.targetType || TARGET_TYPE.NONE,
    allowSelfTarget: Boolean(definition.allowSelfTarget),
    defaultTargetSelf: Boolean(definition.defaultTargetSelf),

    targetPlayerIndex: -1,
    targetPlayerId: "",
    targetPlayerName: "",

    targetPoiIndex: -1,
    targetPoiCode: "",
    targetPoiType: "none",
    targetPoiName: "",

    microgameCategory: definition.microgameCategory || "none",
    microgamePool: Array.isArray(definition.microgamePool)
      ? [...definition.microgamePool]
      : [MICROGAME_ID.NONE],
    microgameTimeLimit: Number(definition.microgameTimeLimit || 0),
    microgameDifficulty: Number(definition.microgameDifficulty || 0),
    microgameId: MICROGAME_ID.NONE,
    seed: 0,
    timeLimit: 0,
    difficulty: 0,

    skipsMicrogame: Boolean(definition.skipsMicrogame),
    submitted: false
  };

  writeVillageSelectedPlayerIndex(-1);
  writeVillageSelectedPoi(-1, "", "none");

  if (
    pendingActivity.targetType === TARGET_TYPE.PLAYER &&
    pendingActivity.allowSelfTarget &&
    pendingActivity.defaultTargetSelf
  ) {
    pendingActivity.targetPlayerIndex = Number(clientState.playerIndex || -1);
    pendingActivity.targetPlayerId = String(clientState.playerId || "");
    pendingActivity.targetPlayerName = String(clientState.playerName || "Você");
  }

  syncPendingActivityToRive();
  applyClientStateToRive();
}

function confirmPendingActivity() {
  if (!pendingActivity) {
    console.warn("[ACTIVITY] confirmação sem atividade pendente.");
    return;
  }

  if (pendingActivity.submitted) {
    return;
  }

  if (pendingActivity.targetType === TARGET_TYPE.PLAYER && pendingActivity.targetPlayerIndex < 1) {
    console.warn("[ACTIVITY] confirmação recusada: jogador alvo ausente.");
    return;
  }

  if (pendingActivity.targetType === TARGET_TYPE.POI && !pendingActivity.targetPoiCode) {
    console.warn("[ACTIVITY] confirmação recusada: POI alvo ausente.");
    return;
  }

  if (
    pendingActivity.targetType === TARGET_TYPE.REGION &&
    pendingActivity.targetPlayerIndex < 1 &&
    !pendingActivity.targetPoiCode
  ) {
    console.warn("[ACTIVITY] confirmação recusada: região alvo ausente.");
    return;
  }

  if (pendingActivity.skipsMicrogame) {
    submitActivityResult(ACTION_COMMAND.PASS, true);
    return;
  }

  startMicrogameForPendingActivity();
}

function startMicrogameForPendingActivity() {
  if (!pendingActivity) return;

  const seed = makeActivitySeed();
  const microgamePool = Array.isArray(pendingActivity.microgamePool)
    ? pendingActivity.microgamePool
    : [];

  const microgameId = pickFromArray(microgamePool, seed);

  pendingActivity.seed = seed;
  pendingActivity.microgameId = microgameId;
  pendingActivity.timeLimit = Number(pendingActivity.microgameTimeLimit || 0);
  pendingActivity.difficulty = Number(pendingActivity.microgameDifficulty || 0);

  showMicrogameLayer();
  loadMicrogameRive(microgameId);
  syncPendingActivityToRive();
  syncPendingActivityToMicrogameVM();
}

function handleMicrogameResult(command) {
  if (!pendingActivity) {
    resetMicrogameVM();
    return;
  }

  submitActivityResult(command, false);
}

function submitActivityResult(resultCommand, skippedMicrogame) {
  if (!pendingActivity) return;

  if (pendingActivity.submitted) {
    console.warn("[ACTIVITY] resultado ignorado: atividade já enviada.");
    return;
  }

  pendingActivity.submitted = true;

  const payload = {
    roomCode: clientState.roomCode,
    playerId: clientState.playerId,

    actionId: pendingActivity.actionId,
    actionCommand: pendingActivity.actionCommand,
    actionClass: pendingActivity.actionClass,

    targetType: pendingActivity.targetType,

    targetPlayerIndex: pendingActivity.targetPlayerIndex,
    targetPlayerId: pendingActivity.targetPlayerId,

    targetPoiIndex: pendingActivity.targetPoiIndex,
    targetPoiCode: pendingActivity.targetPoiCode,
    targetPoiType: pendingActivity.targetPoiType,

    microgameCategory: pendingActivity.microgameCategory,
    microgameId: pendingActivity.microgameId,
    microgameSeed: pendingActivity.seed,
    microgameTimeLimit: pendingActivity.timeLimit,
    microgameDifficulty: pendingActivity.difficulty,

    resultCommand,
    skippedMicrogame: Boolean(skippedMicrogame)
  };

  console.log("[ACTIVITY] enviando resultado:", payload);

  const activityForSubmission = pendingActivity;

  if (!socket || !socket.connected) {
    console.warn("[SOCKET] ainda não conectado.");
    applyLocalEnergyChange(activityForSubmission);
    finishActivityLocally(resultCommand);
    return;
  }

  let finishedLocally = false;

  const finishOnce = () => {
    if (finishedLocally) return;
    finishedLocally = true;
    finishActivityLocally(resultCommand);
  };

  const ackTimeoutId = window.setTimeout(() => {
    console.warn("[ACTIVITY] sem ack do servidor para game:submitActivityResult; finalizando localmente.");
    applyLocalEnergyChange(activityForSubmission);
    finishOnce();
  }, 600);

  socket.emit("game:submitActivityResult", payload, response => {
    window.clearTimeout(ackTimeoutId);

    if (!response || !response.ok) {
      console.warn("[ACTIVITY] erro no resultado:", response?.error || "sem resposta/erro");

      if (pendingActivity) {
        pendingActivity.submitted = false;
      }

      hideMicrogameLayer();
      applyClientStateToRive();
      return;
    }

    if (typeof response.energy === "number") {
      clientState.energy = response.energy;
    } else {
      applyLocalEnergyChange(activityForSubmission);
    }

    if (typeof response.maxEnergy === "number") {
      clientState.maxEnergy = response.maxEnergy;
    }

    finishOnce();
  });
}

function finishActivityLocally(resultCommand) {
  if (resultCommand === ACTION_COMMAND.PASS) {
  }

  if (resultCommand === ACTION_COMMAND.FAIL) {
  }

  if (microgameVM) {
    setVMEnum(microgameVM, "microGameState", MICROGAME_STATE.FINISHED);
  }

  hideMicrogameLayer();

  setTimeout(() => {
    clearPendingActivity();
    applyClientStateToRive();
  }, 250);
}

function clearPendingActivity(_options = {}) {
  pendingActivity = null;

  hideMicrogameLayer();

  writeVillageSelectedPlayerIndex(-1);
  writeVillageSelectedPoi(-1, "", "none");

  if (playerVM) {
    setVMString(playerVM, "selectedActionId", "");
    setVMString(playerVM, "selectedActionLabel", "");
    setVMString(playerVM, "selectedActionDescription", "");

    setVMString(playerVM, "activityPrompt", "");

    setVMBoolean(playerVM, "hasPendingAction", false);
    setVMBoolean(playerVM, "pendingActionNeedsTarget", false);
    setVMBoolean(playerVM, "canConfirmAction", false);

    setVMEnum(playerVM, "selectedTargetType", TARGET_TYPE.NONE);
    setVMNumber(playerVM, "selectedTargetIndex", -1);
    setVMString(playerVM, "selectedTargetName", "");
    setVMBoolean(playerVM, "hasSelectedTarget", false);
  }

  resetMicrogameVM();
}

function syncPendingActivityToRive() {
  if (!playerVM || !pendingActivity) return;

  const needsTarget = pendingActivity.targetType !== TARGET_TYPE.NONE;
  const hasPlayerTarget = pendingActivity.targetPlayerIndex > 0;
  const hasPoiTarget = pendingActivity.targetPoiCode !== "";
  const hasTarget =
    pendingActivity.targetType === TARGET_TYPE.NONE ||
    hasPlayerTarget ||
    hasPoiTarget;

  const targetIndex =
    hasPlayerTarget
      ? pendingActivity.targetPlayerIndex
      : hasPoiTarget
        ? pendingActivity.targetPoiIndex
        : -1;

  const targetName =
    hasPlayerTarget
      ? pendingActivity.targetPlayerName
      : hasPoiTarget
        ? pendingActivity.targetPoiName
        : "";

  const displayedTargetType =
    pendingActivity.targetType === TARGET_TYPE.REGION
      ? (hasPlayerTarget ? TARGET_TYPE.PLAYER : TARGET_TYPE.POI)
      : pendingActivity.targetType;

  setVMString(playerVM, "selectedActionId", pendingActivity.actionId);
  setVMString(playerVM, "selectedActionLabel", pendingActivity.label);
  setVMString(playerVM, "selectedActionDescription", pendingActivity.description);

  setVMBoolean(playerVM, "hasPendingAction", true);
  setVMBoolean(playerVM, "pendingActionNeedsTarget", needsTarget);
  setVMBoolean(playerVM, "canConfirmAction", hasTarget && !pendingActivity.submitted);

  setVMEnum(playerVM, "selectedTargetType", displayedTargetType);
  setVMNumber(playerVM, "selectedTargetIndex", targetIndex);
  setVMString(playerVM, "selectedTargetName", targetName);
  setVMBoolean(playerVM, "hasSelectedTarget", needsTarget && hasTarget);
}

function syncPendingActivityToMicrogameVM() {
  if (!microgameVM || !pendingActivity) return;

  setVMEnum(microgameVM, "microGameId", pendingActivity.microgameId || MICROGAME_ID.NONE);
  setVMEnum(microgameVM, "microGameCategory", pendingActivity.microgameCategory || "none");
  setVMEnum(
    microgameVM,
    "microGameState",
    pendingActivity.submitted
      ? MICROGAME_STATE.FINISHED
      : pendingActivity.microgameId !== MICROGAME_ID.NONE
        ? MICROGAME_STATE.RUNNING
        : MICROGAME_STATE.IDLE
  );

  setVMNumber(microgameVM, "seed", pendingActivity.seed || 0);
  setVMNumber(microgameVM, "timeLimit", pendingActivity.timeLimit || 0);
  setVMNumber(microgameVM, "difficulty", pendingActivity.difficulty || 0);
  setVMEnum(microgameVM, "actionCommand", ACTION_COMMAND.NONE);
}

function resetMicrogameVM() {
  if (!microgameVM) return;

  setVMEnum(microgameVM, "microGameId", MICROGAME_ID.NONE);
  setVMEnum(microgameVM, "microGameCategory", "none");
  setVMEnum(microgameVM, "microGameState", MICROGAME_STATE.IDLE);
  setVMNumber(microgameVM, "seed", 0);
  setVMNumber(microgameVM, "timeLimit", 0);
  setVMNumber(microgameVM, "difficulty", 0);
  setVMEnum(microgameVM, "actionCommand", ACTION_COMMAND.NONE);
}

function setActivityPrompt(message) {
  // Intencionalmente não escreve em privateMessage/publicMessage.
  // Mensagens narrativas e CTAs devem vir exclusivamente do servidor via messages.js.
  // Mantido como helper defensivo caso algum patch antigo chame a função.
  if (message) {
    console.log("[ACTIVITY] prompt local ignorado:", message);
  }
}

function applyLocalEnergyChange(activity) {
  if (!activity) return;

  clientState.energy = clamp(
    clientState.energy - Number(activity.energyCost || 0) + Number(activity.energyGain || 0),
    0,
    clientState.maxEnergy
  );
}

function handleNightCommandFromRive(command) {
  if (!socket || !socket.connected) {
    console.warn("[SOCKET] ainda não conectado.");
    return;
  }

  if (clientState.phase !== PHASE.NIGHT) {
    console.warn("[ACTION] comando noturno fora da noite:", command);
    return;
  }

  socket.emit("game:submitNightCommand", {
    roomCode: clientState.roomCode,
    playerId: clientState.playerId,
    command
  }, response => {
    if (!response || !response.ok) {
      console.warn("[ACTION] erro no comando noturno:", response?.error || "erro");
      return;
    }

    console.log("[ACTION] comando noturno enviado:", command);
  });
}

function handleSkipFromRive() {
  const interactionMode = getInteractionMode();

  if (interactionMode !== INTERACTION_MODE.VOTE) {
    console.warn("[ACTION] skip só é válido durante votação.");
    return;
  }

  if (!socket || !socket.connected) {
    console.warn("[SOCKET] ainda não conectado.");
    return;
  }

  if (!clientState.canVote) {
    console.warn("[VOTE] você não pode votar agora.");
    return;
  }

  writeVillageSelectedPlayerIndex(-1);

  clientState.hasSelectedTarget = false;
  clientState.selectedTargetIndex = -1;
  clientState.selectedTargetName = "";
  clientState.votedSkip = true;

  setVMBoolean(playerVM, "hasSelectedTarget", false);
  setVMNumber(playerVM, "selectedTargetIndex", -1);
  setVMString(playerVM, "selectedTargetName", "");
  setVMBoolean(playerVM, "hasSkipped", true);

  socket.emit("game:submitVote", {
    roomCode: clientState.roomCode,
    playerId: clientState.playerId,
    targetId: "",
    voteSkip: true
  }, response => {
    if (!response || !response.ok) {
      console.warn("[VOTE] erro ao votar para pular:", response?.error || "erro");
      return;
    }

    console.log("[VOTE] voto para pular enviado.");
  });
}

function handleClearSelectionFromRive() {
  const interactionMode = getInteractionMode();

  writeVillageSelectedPlayerIndex(-1);

  clientState.hasSelectedTarget = false;
  clientState.selectedTargetIndex = -1;
  clientState.selectedTargetName = "";
  clientState.votedSkip = false;

  setVMBoolean(playerVM, "hasSelectedTarget", false);
  setVMNumber(playerVM, "selectedTargetIndex", -1);
  setVMString(playerVM, "selectedTargetName", "");
  setVMBoolean(playerVM, "hasSkipped", false);

  if (!socket || !socket.connected) {
    console.warn("[SOCKET] ainda não conectado.");
    return;
  }

  socket.emit("game:clearSelection", {
    roomCode: clientState.roomCode,
    playerId: clientState.playerId,
    interactionMode
  }, response => {
    if (!response || !response.ok) {
      console.warn("[ACTION] erro ao limpar seleção:", response?.error || "erro");
      return;
    }

    console.log("[ACTION] seleção limpa.");
  });
}

function submitSelectedTargetImmediately(target) {
  const interactionMode = getInteractionMode();

  if (interactionMode === INTERACTION_MODE.VOTE) {
    submitVoteTarget(target);
    return;
  }

  if (interactionMode === INTERACTION_MODE.VICTIM) {
    submitVictimTarget(target);
    return;
  }

  console.warn("[ACTION] nenhum modo aceita alvo agora.");
}

function submitVoteTarget(target) {
  if (!socket || !socket.connected) {
    console.warn("[SOCKET] ainda não conectado.");
    return;
  }

  if (!clientState.canVote) {
    console.warn("[VOTE] você não pode votar agora.");
    return;
  }

  clientState.votedSkip = false;

  setVMBoolean(playerVM, "hasSkipped", false);

  socket.emit("game:submitVote", {
    roomCode: clientState.roomCode,
    playerId: clientState.playerId,
    targetId: target.id,
    voteSkip: false
  }, response => {
    if (!response || !response.ok) {
      console.warn("[VOTE] erro ao votar:", response?.error || "erro");
      return;
    }

    console.log("[VOTE] voto atualizado:", target.name);
  });
}

function submitVictimTarget(target) {
  if (!socket || !socket.connected) {
    console.warn("[SOCKET] ainda não conectado.");
    return;
  }

  if (!clientState.canChooseVictim) {
    console.warn("[GAME] você não pode escolher vítima agora.");
    return;
  }

  socket.emit("game:submitVictim", {
    roomCode: clientState.roomCode,
    playerId: clientState.playerId,
    victimId: target.id
  }, response => {
    if (!response || !response.ok) {
      console.warn("[GAME] erro ao enviar vítima:", response?.error || "erro");
      return;
    }

    console.log("[GAME] vítima atualizada:", target.name);
  });
}

function applySnapshot(snapshot) {
  const publicState = snapshot.public;
  const privateState = snapshot.private;

  const hadReceivedSnapshot = clientState.hasReceivedSnapshot;
  const previousPhase = clientState.phase;
  const previousIsAlive = clientState.isAlive;
  const previousPlayerId = clientState.playerId;

  clientState.roomCode = publicState.roomCode;

  clientState.players = publicState.players || [];
  clientState.playerCount = publicState.playerCount || clientState.players.length;

  clientState.phase = publicState.phase;
  clientState.dayNumber = publicState.dayNumber;

  clientState.phaseTimeRemaining = publicState.phaseTimeRemaining;
  clientState.phaseTimeTotal = publicState.phaseTimeTotal;
  clientState.phaseProgress = publicState.phaseProgress;

  clientState.publicMessage = publicState.publicMessage || "";

  clientState.skipVoteCount = Number(publicState.skipVoteCount || 0);
  clientState.submittedVoteCount = Number(publicState.submittedVoteCount || 0);
  clientState.eligibleVoteCount = Number(publicState.eligibleVoteCount || 0);

  clientState.hasDayResult = Boolean(publicState.hasDayResult);
  clientState.hasVotedOut = Boolean(publicState.hasVotedOut);
  clientState.lastVotedOutIndex = Number(publicState.lastVotedOutIndex ?? -1);
  clientState.lastVotedOutName = publicState.lastVotedOutName || "";

  clientState.hasNightResult = Boolean(publicState.hasNightResult);

  clientState.hasVictim = Boolean(publicState.hasVictim);
  clientState.lastVictimIndex = Number(publicState.lastVictimIndex ?? -1);
  clientState.lastVictimName = publicState.lastVictimName || "";

  clientState.winner = Number(publicState.winner || 0);
  clientState.gameOverMessage = publicState.gameOverMessage || "";

  clientState.playerId = privateState.playerId;
  clientState.playerIndex = privateState.playerIndex;
  clientState.playerName = privateState.playerName;
  clientState.isHost = Boolean(privateState.isHost);

  clientState.roleName = privateState.roleName || "";
  clientState.roleMessage = privateState.roleMessage || "";

  clientState.action1Label = privateState.action1Label || "";
  clientState.action2Label = privateState.action2Label || "";
  clientState.action1Description = privateState.action1Description || "";
  clientState.action2Description = privateState.action2Description || "";
  clientState.actions = normalizeSnapshotActions(privateState.actions);

  clientState.isImpostor = Boolean(privateState.isImpostor);
  clientState.isAlive = Boolean(privateState.isAlive);

  clientState.energy = Number(privateState.energy ?? privateState.currentEnergy ?? clientState.energy);
  clientState.maxEnergy = Number(privateState.maxEnergy ?? clientState.maxEnergy);

  if (Array.isArray(publicState.pois)) {
    clientState.pois = publicState.pois.map((poi, arrayIndex) => ({
      index: Number(poi.index ?? arrayIndex + 1),
      code: String(poi.code ?? POI_CODES[arrayIndex] ?? ""),
      poiType: String(poi.poiType ?? poi.code ?? POI_CODES[arrayIndex] ?? "none"),
      status: String(poi.status ?? poi.poiStatus ?? "normal"),
      selectionEnabled: Boolean(poi.selectionEnabled ?? true),
      name: String(poi.name ?? POI_NAMES[poi.code] ?? poi.code ?? "")
    }));
  }

  clientState.canStartGame = Boolean(privateState.canStartGame);
  clientState.canChooseVictim = Boolean(privateState.canChooseVictim);

  clientState.hasSelectedVictim = Boolean(privateState.hasSelectedVictim);
  clientState.selectedVictimIndex = Number(privateState.selectedVictimIndex ?? -1);
  clientState.selectedVictimName = privateState.selectedVictimName || "";

  clientState.canVote = Boolean(privateState.canVote);
  clientState.hasVoted = Boolean(privateState.hasVoted);
  clientState.votedTargetIndex = Number(privateState.votedTargetIndex ?? -1);
  clientState.votedTargetName = privateState.votedTargetName || "";
  clientState.votedSkip = Boolean(privateState.votedSkip);

  clientState.privateMessage = privateState.privateMessage || "";

  const localPlayerJustDied =
    hadReceivedSnapshot &&
    previousPlayerId === privateState.playerId &&
    previousIsAlive === true &&
    clientState.isAlive === false;

  if (localPlayerJustDied) {
    vibrateGlobal("PLAYER_DEATH");
  }

  handlePhaseChange(previousPhase, clientState.phase);

  showGameScreen();
  applyClientStateToRive();

  clientState.hasReceivedSnapshot = true;
}

function handlePhaseChange(previousPhase, currentPhase) {
  if (currentPhase === previousPhase) {
    return;
  }

  writeVillageSelectedPlayerIndex(-1);
  writeVillageSelectedPoi(-1, "", "none");
  clearLocalTargetSelection();
  clearPendingActivity();

  if (currentPhase === PHASE.DAY) {
    vibrateGlobal("DAY_START");
  }

  if (currentPhase === PHASE.NIGHT) {
    vibrateGlobal("NIGHT_START");
  }

  if (currentPhase === PHASE.DAY_RESULT) {
    vibrateGlobal("DAY_RESULT");
  }

  if (currentPhase === PHASE.NIGHT_RESULT) {
    vibrateGlobal("NIGHT_RESULT");
  }

  if (currentPhase === PHASE.GAME_OVER) {
    vibrateGlobal("GAME_OVER");
  }
}

function applyClientStateToRive() {
  const interactionMode = getInteractionMode();
  const targetState = getTargetStateFromServer();

  const derivedState = {
    ...clientState,

    phaseEnum: PHASE_ENUM[clientState.phase] || "lobby",
    winnerEnum: WINNER_ENUM[clientState.winner] || "none",

    playersData: encodePlayersData(clientState.players),
    poisData: encodePoisData(clientState.pois),

    interactionMode,
    selectionEnabled:
      interactionMode === INTERACTION_MODE.VOTE ||
      interactionMode === INTERACTION_MODE.VICTIM ||
      pendingActivity?.targetType === TARGET_TYPE.REGION,
    poiSelectionEnabled:
      interactionMode === INTERACTION_MODE.POI ||
      pendingActivity?.targetType === TARGET_TYPE.REGION,

    hasSelectedTarget: targetState.hasSelectedTarget,
    selectedTargetIndex: targetState.selectedTargetIndex,
    selectedTargetName: targetState.selectedTargetName,

    hasSkipped: targetState.hasSkipped,

    action1Label: getConfiguredActionLabel(ACTION_COMMAND.ACTION_1) || clientState.action1Label,
    action2Label: getConfiguredActionLabel(ACTION_COMMAND.ACTION_2) || clientState.action2Label,
    action1Description: getConfiguredActionDescription(ACTION_COMMAND.ACTION_1) || clientState.action1Description,
    action2Description: getConfiguredActionDescription(ACTION_COMMAND.ACTION_2) || clientState.action2Description
  };

  applyBindings(startingVM, STARTING_BINDINGS, derivedState);
  applyBindings(villageVM, VILLAGE_BINDINGS, derivedState);
  applyBindings(playerVM, PLAYER_BINDINGS, derivedState);

  setVMString(villageVM, "poisData", derivedState.poisData);
  setVMBoolean(villageVM, "poiSelectionEnabled", derivedState.poiSelectionEnabled);
  setVMNumber(villageVM, "selectedPoiIndex", clientState.localSelectedPoiIndex);
  setVMString(villageVM, "selectedPoiCode", clientState.localSelectedPoiCode);
  setVMEnum(villageVM, "selectedPoiType", clientState.localSelectedPoiType || "none");

  setVMNumber(playerVM, "energy", clientState.energy);
  setVMNumber(playerVM, "maxEnergy", clientState.maxEnergy);
  setVMString(playerVM, "action1Label", derivedState.action1Label);
  setVMString(playerVM, "action2Label", derivedState.action2Label);
  setVMString(playerVM, "action1Description", derivedState.action1Description);
  setVMString(playerVM, "action2Description", derivedState.action2Description);

  syncVillageSelectionFromServer(targetState, interactionMode);
  syncPendingActivityToRive();
  syncPendingActivityToMicrogameVM();
}

function getInteractionMode() {
  if (pendingActivity?.targetType === TARGET_TYPE.PLAYER) {
    return INTERACTION_MODE.VICTIM;
  }

  if (pendingActivity?.targetType === TARGET_TYPE.POI) {
    return INTERACTION_MODE.POI;
  }

  if (pendingActivity?.targetType === TARGET_TYPE.REGION) {
    return INTERACTION_MODE.POI;
  }

  if (clientState.canVote) {
    return INTERACTION_MODE.VOTE;
  }

  return INTERACTION_MODE.NONE;
}

function getTargetStateFromServer() {
  if (pendingActivity) {
    const hasPlayerTarget = pendingActivity.targetPlayerIndex > 0;
    const hasPoiTarget = pendingActivity.targetPoiCode !== "";

    return {
      hasSelectedTarget: hasPlayerTarget || hasPoiTarget,
      selectedTargetIndex: hasPlayerTarget
        ? pendingActivity.targetPlayerIndex
        : hasPoiTarget
          ? pendingActivity.targetPoiIndex
          : -1,
      selectedTargetName: hasPlayerTarget
        ? pendingActivity.targetPlayerName
        : hasPoiTarget
          ? pendingActivity.targetPoiName
          : "",
      hasSkipped: false
    };
  }

  if (clientState.canVote) {
    if (clientState.votedSkip) {
      return {
        hasSelectedTarget: false,
        selectedTargetIndex: -1,
        selectedTargetName: "",
        hasSkipped: true
      };
    }

    if (clientState.hasVoted && clientState.votedTargetIndex > 0) {
      return {
        hasSelectedTarget: true,
        selectedTargetIndex: clientState.votedTargetIndex,
        selectedTargetName: clientState.votedTargetName,
        hasSkipped: false
      };
    }
  }

  return {
    hasSelectedTarget: false,
    selectedTargetIndex: -1,
    selectedTargetName: "",
    hasSkipped: false
  };
}

function syncVillageSelectionFromServer(targetState, interactionMode) {
  if (!villageVM) return;
  if (pendingActivity) return;

  if (interactionMode === INTERACTION_MODE.NONE) {
    writeVillageSelectedPlayerIndex(-1);
    return;
  }

  if (targetState.hasSkipped) {
    writeVillageSelectedPlayerIndex(-1);
    return;
  }

  if (targetState.hasSelectedTarget) {
    writeVillageSelectedPlayerIndex(targetState.selectedTargetIndex);
    return;
  }

  writeVillageSelectedPlayerIndex(-1);
}

function handleCreateRoom() {
  if (!socket || !socket.connected) {
    console.warn("[SOCKET] ainda não conectado.");
    return;
  }

  const playerName = sanitizePlayerName(clientState.playerName);

  socket.emit("room:create", { playerName }, response => {
    if (!response || !response.ok) {
      console.warn("[SERVER] erro ao criar sala:", response?.error || "erro");
      return;
    }

    clientState.roomCode = response.roomCode;
    clientState.playerId = response.playerId;

    applyClientStateToRive();
  });
}

function handleJoinRoom() {
  if (!socket || !socket.connected) {
    console.warn("[SOCKET] ainda não conectado.");
    return;
  }

  const playerName = sanitizePlayerName(clientState.playerName);
  const roomCode = sanitizeRoomCode(clientState.roomCode);

  if (!roomCode) {
    console.warn("[SERVER] código da sala vazio.");
    return;
  }

  socket.emit("room:join", { roomCode, playerName }, response => {
    if (!response || !response.ok) {
      console.warn("[SERVER] erro ao entrar:", response?.error || "erro");
      return;
    }

    clientState.roomCode = response.roomCode;
    clientState.playerId = response.playerId;

    applyClientStateToRive();
  });
}

function handleStartGameFromRive() {
  if (!socket || !socket.connected) {
    console.warn("[SOCKET] ainda não conectado.");
    return;
  }

  if (!clientState.roomCode || !clientState.playerId) {
    console.warn("[GAME] sem sala/player.");
    return;
  }

  if (!clientState.isHost) {
    console.warn("[GAME] apenas o host inicia.");
    return;
  }

  socket.emit("game:start", {
    roomCode: clientState.roomCode,
    playerId: clientState.playerId
  }, response => {
    if (!response || !response.ok) {
      console.warn("[GAME] erro ao iniciar:", response?.error || "erro");
      return;
    }

    console.log("[GAME] partida iniciada.");
  });
}

function getPlayerByIndex(index) {
  return clientState.players.find(player => {
    return (
      Number(player.index) === Number(index) &&
      player.isAlive &&
      player.id !== clientState.playerId
    );
  }) || null;
}

function getSelectedTarget() {
  const selectedIndex = getVMNumber(
    villageVM,
    "selectedPlayerIndex",
    clientState.localSelectedPlayerIndex
  );

  return getPlayerByIndex(selectedIndex);
}

function clearCurrentSelection() {
  handleClearSelectionFromRive();
}

function clearLocalTargetSelection() {
  clientState.hasSelectedTarget = false;
  clientState.selectedTargetIndex = -1;
  clientState.selectedTargetName = "";

  setVMBoolean(playerVM, "hasSelectedTarget", false);
  setVMNumber(playerVM, "selectedTargetIndex", -1);
  setVMString(playerVM, "selectedTargetName", "");
}

function startSelectionPolling() {
  setInterval(() => {
    if (!villageVM || !playerVM) return;

    pollSelectedPlayer();
    pollSelectedPoi();
  }, 120);
}

function pollSelectedPlayer() {
  const interactionMode = getInteractionMode();
  const canReadPlayerSelection =
    interactionMode === INTERACTION_MODE.VOTE ||
    interactionMode === INTERACTION_MODE.VICTIM ||
    pendingActivity?.targetType === TARGET_TYPE.REGION;

  if (!canReadPlayerSelection) {
    return;
  }

  const selectedIndex = getVMNumber(villageVM, "selectedPlayerIndex", -1);

  if (selectedIndex === clientState.localSelectedPlayerIndex) {
    return;
  }

  clientState.localSelectedPlayerIndex = selectedIndex;

  const isPendingPlayerTarget =
    pendingActivity?.targetType === TARGET_TYPE.PLAYER ||
    pendingActivity?.targetType === TARGET_TYPE.REGION;

  if (selectedIndex < 1) {
    if (isPendingPlayerTarget) {
      pendingActivity.targetPlayerIndex = -1;
      pendingActivity.targetPlayerId = "";
      pendingActivity.targetPlayerName = "";
      syncPendingActivityToRive();
      return;
    }

    clientState.hasSelectedTarget = false;
    clientState.selectedTargetIndex = -1;
    clientState.selectedTargetName = "";

    setVMBoolean(playerVM, "hasSelectedTarget", false);
    setVMNumber(playerVM, "selectedTargetIndex", -1);
    setVMString(playerVM, "selectedTargetName", "");
    return;
  }

  const selectedPlayer = getPlayerByIndex(selectedIndex);

  if (!selectedPlayer) {
    if (isPendingPlayerTarget) {
      pendingActivity.targetPlayerIndex = -1;
      pendingActivity.targetPlayerId = "";
      pendingActivity.targetPlayerName = "";
      syncPendingActivityToRive();
      return;
    }

    clientState.hasSelectedTarget = false;
    clientState.selectedTargetIndex = -1;
    clientState.selectedTargetName = "";

    setVMBoolean(playerVM, "hasSelectedTarget", false);
    setVMNumber(playerVM, "selectedTargetIndex", -1);
    setVMString(playerVM, "selectedTargetName", "");
    return;
  }

  if (isPendingPlayerTarget) {
    pendingActivity.targetPlayerIndex = Number(selectedPlayer.index);
    pendingActivity.targetPlayerId = String(selectedPlayer.id || "");
    pendingActivity.targetPlayerName = String(selectedPlayer.name || "");

    if (pendingActivity.targetType === TARGET_TYPE.REGION) {
      pendingActivity.targetPoiIndex = -1;
      pendingActivity.targetPoiCode = "";
      pendingActivity.targetPoiType = "none";
      pendingActivity.targetPoiName = "";
      writeVillageSelectedPoi(-1, "", "none");
    }

    syncPendingActivityToRive();
    return;
  }

  clientState.hasSelectedTarget = true;
  clientState.selectedTargetIndex = selectedPlayer.index;
  clientState.selectedTargetName = selectedPlayer.name;

  setVMBoolean(playerVM, "hasSelectedTarget", true);
  setVMNumber(playerVM, "selectedTargetIndex", selectedPlayer.index);
  setVMString(playerVM, "selectedTargetName", selectedPlayer.name);
  setVMBoolean(playerVM, "hasSkipped", false);

  submitSelectedTargetImmediately(selectedPlayer);
}

function pollSelectedPoi() {
  if (getInteractionMode() !== INTERACTION_MODE.POI) {
    return;
  }

  const selectedPoiIndex = getVMNumber(villageVM, "selectedPoiIndex", -1);
  const selectedPoiCode = readVMString(villageVM, "selectedPoiCode", "");
  const selectedPoiType = getVMEnum(villageVM, "selectedPoiType", "none");

  const changed =
    selectedPoiIndex !== clientState.localSelectedPoiIndex ||
    selectedPoiCode !== clientState.localSelectedPoiCode ||
    selectedPoiType !== clientState.localSelectedPoiType;

  if (!changed) {
    return;
  }

  clientState.localSelectedPoiIndex = selectedPoiIndex;
  clientState.localSelectedPoiCode = selectedPoiCode;
  clientState.localSelectedPoiType = selectedPoiType;

  if (
    !pendingActivity ||
    (
      pendingActivity.targetType !== TARGET_TYPE.POI &&
      pendingActivity.targetType !== TARGET_TYPE.REGION
    )
  ) {
    return;
  }

  const poi = getPoiByCode(selectedPoiCode) || getPoiByIndex(selectedPoiIndex);

  if (!poi || poi.selectionEnabled === false) {
    pendingActivity.targetPoiIndex = -1;
    pendingActivity.targetPoiCode = "";
    pendingActivity.targetPoiType = "none";
    pendingActivity.targetPoiName = "";
    syncPendingActivityToRive();
    return;
  }

  pendingActivity.targetPoiIndex = Number(poi.index);
  pendingActivity.targetPoiCode = String(poi.code);
  pendingActivity.targetPoiType = String(poi.poiType || poi.code || selectedPoiType || "none");
  pendingActivity.targetPoiName = String(poi.name || POI_NAMES[poi.code] || poi.code);

  if (pendingActivity.targetType === TARGET_TYPE.REGION) {
    pendingActivity.targetPlayerIndex = -1;
    pendingActivity.targetPlayerId = "";
    pendingActivity.targetPlayerName = "";
    writeVillageSelectedPlayerIndex(-1);
  }

  syncPendingActivityToRive();
}

function writeVillageSelectedPlayerIndex(index) {
  clientState.localSelectedPlayerIndex = Number(index);
  setVMNumber(villageVM, "selectedPlayerIndex", Number(index));
}

function writeVillageSelectedPoi(index, code, type) {
  clientState.localSelectedPoiIndex = Number(index);
  clientState.localSelectedPoiCode = String(code || "");
  clientState.localSelectedPoiType = String(type || "none");

  setVMNumber(villageVM, "selectedPoiIndex", clientState.localSelectedPoiIndex);
  setVMString(villageVM, "selectedPoiCode", clientState.localSelectedPoiCode);
  setVMEnum(villageVM, "selectedPoiType", clientState.localSelectedPoiType);
}

function bindDOM() {
  els.hiddenTextInput.addEventListener("input", () => {
    if (activeEditMode === EDIT_MODE.ROOM_CODE) {
      els.hiddenTextInput.value = sanitizeRoomCode(els.hiddenTextInput.value);
    }

    commitHiddenInputValue();
  });

  els.hiddenTextInput.addEventListener("blur", () => {
    commitHiddenInputValue();
    activeEditMode = EDIT_MODE.NONE;
  });

  els.hiddenTextInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      commitHiddenInputValue();
      els.hiddenTextInput.blur();
    }

    if (event.key === "Escape") {
      els.hiddenTextInput.blur();
    }
  });
}

function openPlayerNameEditor() {
  activeEditMode = EDIT_MODE.PLAYER_NAME;

  els.hiddenTextInput.value = clientState.playerName || "";
  els.hiddenTextInput.maxLength = 18;
  els.hiddenTextInput.inputMode = "text";

  focusHiddenInput();
}

function openRoomCodeEditor() {
  activeEditMode = EDIT_MODE.ROOM_CODE;

  els.hiddenTextInput.value = clientState.roomCode || "";
  els.hiddenTextInput.maxLength = 6;
  els.hiddenTextInput.inputMode = "text";

  focusHiddenInput();
}

function focusHiddenInput() {
  els.hiddenTextInput.focus();
  els.hiddenTextInput.select();
}

function commitHiddenInputValue() {
  if (activeEditMode === EDIT_MODE.PLAYER_NAME) {
    clientState.playerName = sanitizePlayerName(els.hiddenTextInput.value);
  }

  if (activeEditMode === EDIT_MODE.ROOM_CODE) {
    clientState.roomCode = sanitizeRoomCode(els.hiddenTextInput.value);
  }

  applyClientStateToRive();
}

function showGameScreen() {
  if (clientState.screen === "game") {
    return;
  }

  clientState.screen = "game";
  els.startingScreen.style.display = "none";
  els.gameScreen.style.display = "flex";

  requestAnimationFrame(() => {
    updateViewportHeight(resizeAllRive);
    resizeAllRive();
  });

  setTimeout(() => {
    updateViewportHeight(resizeAllRive);
    resizeAllRive();
  }, 100);
}

function startHeartbeat() {
  setInterval(() => {
    if (!socket || !socket.connected) return;
    if (!clientState.roomCode || !clientState.playerId) return;

    socket.emit("room:heartbeat", {
      roomCode: clientState.roomCode,
      playerId: clientState.playerId
    });
  }, 25000);
}


function getConfiguredAction(command) {
  return clientState.actions?.[command] || null;
}

function getConfiguredActionLabel(command) {
  return getConfiguredAction(command)?.label || "";
}

function getConfiguredActionDescription(command) {
  return getConfiguredAction(command)?.description || "";
}

function normalizeSnapshotActions(actions) {
  const result = {
    action1: null,
    action2: null,
    sleep: null
  };

  if (!actions || typeof actions !== "object") {
    return result;
  }

  for (const slot of Object.keys(result)) {
    const action = actions[slot];

    if (!action || typeof action !== "object") {
      continue;
    }

    result[slot] = {
      slot,
      id: String(action.id || slot),
      actionClass: String(action.actionClass || ""),
      intent: String(action.intent || ""),
      label: String(action.label || slot),
      description: String(action.description || ""),

      energyCost: Number(action.energyCost || 0),
      energyGain: Number(action.energyGain || 0),

      targetType: String(action.targetType || TARGET_TYPE.NONE),
      allowSelfTarget: Boolean(action.allowSelfTarget),
      defaultTargetSelf: Boolean(action.defaultTargetSelf),

      microgameCategory: String(action.microgameCategory || "none"),
      microgamePool: Array.isArray(action.microgamePool)
        ? action.microgamePool.map(item => String(item || "")).filter(Boolean)
        : [MICROGAME_ID.NONE],
      microgameTimeLimit: Number(action.microgameTimeLimit || 0),
      microgameDifficulty: Number(action.microgameDifficulty || 0),

      implemented: action.implemented !== false,
      skipsMicrogame: Boolean(action.skipsMicrogame)
    };
  }

  return result;
}

function getCurrentEnergy() {
  return clamp(clientState.energy, 0, clientState.maxEnergy);
}

function getPoiByIndex(index) {
  return clientState.pois.find(poi => Number(poi.index) === Number(index)) || null;
}

function getPoiByCode(code) {
  return clientState.pois.find(poi => String(poi.code) === String(code || "")) || null;
}

function encodePoisData(pois) {
  return (pois || [])
    .map((poi, arrayIndex) => {
      const code = sanitizeDataField(poi.code || POI_CODES[arrayIndex] || "");
      const status = sanitizeDataField(poi.status || poi.poiStatus || "normal");
      const selectable = poi.selectionEnabled === false ? 0 : 1;

      return `${code}|${status}|${selectable}`;
    })
    .join(";");
}

function readVMString(vm, name, fallback = "") {
  if (!vm) return fallback;

  try {
    const prop = vm.string(name);
    return String(prop?.value ?? fallback);
  } catch {
    return fallback;
  }
}

function makeActivitySeed() {
  return Math.floor((Date.now() + clientState.playerIndex * 1009 + clientState.dayNumber * 917) % 1000000);
}

function pickFromArray(array, seed) {
  if (!Array.isArray(array) || array.length <= 0) {
    return MICROGAME_ID.GAME_1;
  }

  const index = Math.abs(Number(seed) || 0) % array.length;
  return array[index];
}

function clamp(value, min, max) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return min;
  }

  return Math.max(min, Math.min(max, number));
}

function sanitizeDataField(value) {
  return String(value ?? "")
    .replace(/[|;]/g, "")
    .trim()
    .slice(0, 48);
}

function sanitizeRoomCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function sanitizePlayerName(value) {
  const name = String(value || "").trim();

  if (!name) {
    return "";
  }

  return name.slice(0, 18);
}