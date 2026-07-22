const PHASE = {
  LOBBY: 0,
  DAY: 1,
  NIGHT: 2,
  GAME_OVER: 3,
  NIGHT_RESULT: 4,
  DAY_RESULT: 5
};

const ALIGNMENT_LABEL = {
  0: "Sem alinhamento",
  1: "Inocente",
  2: "Impostor",
  3: "Neutro"
};

const TARGET_TYPE = {
  NONE: "none",
  PLAYER: "player",
  POI: "poi",
  REGION: "region"
};

const ROLE_OPTIONS = [
  { id: "resident", name: "Morador" },
  { id: "detective", name: "Detetive" },
  { id: "medium", name: "Medium" },
  { id: "unicorn", name: "Unicórnio" },
  { id: "journalist", name: "Jornalista" },
  { id: "vigilante", name: "Vigilante" },
  { id: "killer", name: "Assassino" },
  { id: "stalker", name: "Espreitador" },
  { id: "obsessor", name: "Obsessor" },
  { id: "metamorph", name: "Metamorfo" },
  { id: "illusionist", name: "Ilusionista" },
  { id: "occultist", name: "Ocultista" },
  { id: "hypnotist", name: "Hipnotizador" },
  { id: "lithomancer", name: "Litomante" },
  { id: "joker", name: "Coringa" },
  { id: "instigator", name: "Instigador" },
  { id: "lawyer", name: "Advogado" },
  { id: "possessed", name: "Possuído" },
  { id: "condemned", name: "Condenado" },
  { id: "bountyHunter", name: "Caçador de Recompensas" },
  { id: "cultist", name: "Cultista" }
];

const MAP_HOUSE_SLOTS = {
  1: { x: 18, y: 18 },
  2: { x: 42, y: 16 },
  3: { x: 66, y: 17 },
  4: { x: 88, y: 22 },
  5: { x: 13, y: 38 },
  6: { x: 32, y: 38 },
  7: { x: 58, y: 39 },
  8: { x: 82, y: 39 },
  9: { x: 17, y: 62 },
  10: { x: 40, y: 62 },
  11: { x: 64, y: 62 },
  12: { x: 88, y: 62 },
  13: { x: 28, y: 84 },
  14: { x: 51, y: 84 },
  15: { x: 74, y: 84 },
  16: { x: 92, y: 84 }
};

const MAP_POIS = {
  purple: { x: 23, y: 29, label: "Igreja" },
  green: { x: 86, y: 34, label: "Mercado" },
  yellow: { x: 51, y: 50, label: "Praça" },
  blue: { x: 25, y: 72, label: "Barzinho" },
  red: { x: 80, y: 73, label: "Viela da ENEL" }
};

const BALANCED_SLOT_SETS = {
  1: [7],
  2: [6, 11],
  3: [2, 8, 14],
  4: [2, 5, 8, 14],
  5: [2, 5, 8, 10, 15],
  6: [2, 4, 5, 8, 10, 15],
  7: [1, 3, 6, 8, 10, 12, 15],
  8: [1, 3, 5, 7, 10, 12, 14, 16],
  9: [1, 3, 4, 5, 7, 10, 12, 14, 16],
  10: [1, 2, 4, 5, 7, 8, 10, 12, 14, 16],
  11: [1, 2, 4, 5, 6, 7, 8, 10, 12, 14, 16],
  12: [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 15]
};

const FALLBACK_SLOT_ORDER = [2, 8, 14, 5, 12, 3, 10, 16, 1, 7, 15, 4, 6, 11, 13, 9];

const MICROGAME_ARCHETYPES = [
  { id: "investigation", title: "Investigação", body: "Arraste o foco até os sinais." },
  { id: "violence", title: "Violência", body: "Toque nos alvos. Evite os vultos." },
  { id: "ritual", title: "Ritual", body: "Toque quando o marcador passar pela zona segura." },
  { id: "manipulation", title: "Manipulação", body: "Segure em manter. Solte em esconder." },
  { id: "invasion", title: "Invasão", body: "Colete itens antes do tempo acabar." },
  { id: "watch", title: "Vigilância", body: "Segure a área até o fim." },
  { id: "recovery", title: "Recuperação", body: "Dormir recupera energia." }
];

const socket = io();

const state = {
  roomCode: localStorage.getItem("cidade.roomCode") || "",
  playerId: localStorage.getItem("cidade.playerId") || "",
  snapshot: null,
  selectedAction: null,
  selectedSlot: "",
  selectedTargetPlayerId: "",
  selectedTargetPoiCode: "",
  selectedRoleGuessId: "",
  selectedTab: "players",
  targetSelectionOpen: false,
  lastNotice: "",
  activeMicrogame: null,
  revealedRoleKey: ""
};

const el = {};

function bindElements() {
  const ids = [
    "app", "publicPanel", "privatePanel", "publicTitle", "roomPill", "lobbyCard",
    "playerNameInput", "roomCodeInput", "createRoomButton", "joinRoomButton", "startGameButton",
    "transitionCard", "transitionTitle", "transitionSubtitle", "transitionMessage",
    "mapCard", "mapStatus", "mapCount", "neighborhoodMap",
    "gameOverCard", "gameOverTitle", "gameOverMessage", "publicMessageCard",
    "phaseLabel", "timerLabel", "publicMessage", "publicPlayers", "publicPois",
    "privateIdentity", "sheetToggle", "roleReveal", "revealRoleName", "revealAlignment",
    "revealObjective", "dismissRevealButton", "energyPips", "privateMessage",
    "secondaryMessage", "actionPanel", "votePanel", "targetOverlay", "targetTitle",
    "targetHint", "targetTabs", "targetGrid", "confirmTargetButton", "cancelTargetButton",
    "roleGuessOverlay", "roleGuessGrid", "confirmRoleGuessButton", "cancelRoleGuessButton",
    "microgameOverlay", "microgameCategoryLabel", "microgameTitle", "microgameTimer",
    "microgamePurpose", "microgameStage", "microgameScoreLabel", "forceFinishMicrogameButton",
    "detailsSheet", "sheetHandle", "sheetRoleName", "sheetRoleGoal", "sheetAbilities", "archetypeList",
    "hostSettingsCard", "settingFirstDaySeconds", "settingDaySeconds", "settingNightSeconds",
    "settingResultSeconds", "settingVotingOpensAtProgress", "settingMaxPrivateClues",
    "roleToggleList", "applyHostSettingsButton"
  ];

  for (const id of ids) el[id] = document.getElementById(id);

  if (el.roleReveal && el.roleReveal.parentElement !== document.body) {
    document.body.appendChild(el.roleReveal);
  }
}

function setupEvents() {
  el.playerNameInput.value = localStorage.getItem("cidade.playerName") || "";
  el.roomCodeInput.value = state.roomCode;

  el.createRoomButton.addEventListener("click", createRoom);
  el.joinRoomButton.addEventListener("click", joinRoom);
  el.startGameButton.addEventListener("click", startGame);
  el.applyHostSettingsButton.addEventListener("click", applyHostSettings);
  el.dismissRevealButton.addEventListener("click", dismissRoleReveal);
  el.sheetToggle.addEventListener("click", toggleSheet);
  el.sheetHandle.addEventListener("click", toggleSheet);
  el.cancelTargetButton.addEventListener("click", closeTargetOverlay);
  el.confirmTargetButton.addEventListener("click", confirmTargetSelection);
  el.cancelRoleGuessButton.addEventListener("click", closeRoleGuessOverlay);
  el.confirmRoleGuessButton.addEventListener("click", confirmRoleGuessSelection);
  el.forceFinishMicrogameButton.addEventListener("click", () => finishMicrogame(2));

  el.targetTabs.addEventListener("click", event => {
    const button = event.target.closest("button[data-tab]");
    if (!button) return;
    state.selectedTab = button.dataset.tab;
    renderTargetOptions();
  });

  setupSheetDrag();

  socket.on("connect", () => {
    restoreStoredSession();
  });

  socket.on("room:snapshot", snapshot => {
    state.snapshot = snapshot;
    render();
  });

  socket.on("room:restoreFailed", () => {
    clearStoredSession();
  });

  setInterval(() => {
    restoreStoredSession();
  }, 15000);
}

function restoreStoredSession() {
  if (!state.roomCode || !state.playerId) return;
  socket.emit("room:heartbeat", { roomCode: state.roomCode, playerId: state.playerId });
}

function clearStoredSession() {
  state.roomCode = "";
  state.playerId = "";
  state.snapshot = null;
  localStorage.removeItem("cidade.roomCode");
  localStorage.removeItem("cidade.playerId");
  if (el.roomCodeInput) el.roomCodeInput.value = "";
  setNotice("");
}

function createRoom() {
  const playerName = getPlayerName();
  socket.emit("room:create", { playerName }, response => handleJoinResponse(response, playerName));
}

function joinRoom() {
  const playerName = getPlayerName();
  const roomCode = String(el.roomCodeInput.value || "").trim().toUpperCase();
  socket.emit("room:join", { roomCode, playerName }, response => handleJoinResponse(response, playerName));
}

function startGame() {
  socket.emit("game:start", getBasePayload(), response => {
    if (!response?.ok) setNotice(errorText(response?.error || "erro ao iniciar"));
  });
}

function handleJoinResponse(response, playerName) {
  if (!response?.ok) {
    setNotice(errorText(response?.error || "erro ao entrar"));
    return;
  }

  state.roomCode = response.roomCode;
  state.playerId = response.playerId;
  localStorage.setItem("cidade.roomCode", state.roomCode);
  localStorage.setItem("cidade.playerId", state.playerId);
  localStorage.setItem("cidade.playerName", playerName);
  setNotice("");
  render();
}

function getPlayerName() {
  return String(el.playerNameInput.value || "").trim();
}

function getBasePayload() {
  return {
    roomCode: state.roomCode,
    playerId: state.playerId
  };
}

function render() {
  const snapshot = state.snapshot;
  const publicState = snapshot?.public;
  const privateState = snapshot?.private;
  const hasJoinedRoom = Boolean(publicState?.roomCode && privateState?.playerId);

  el.app.dataset.phase = publicState ? phaseName(publicState.phase) : "lobby";
  el.app.dataset.joined = hasJoinedRoom ? "true" : "false";
  el.roomPill.textContent = hasJoinedRoom ? `sala ${publicState.roomCode || state.roomCode}` : "sem sala";
  el.startGameButton.disabled = !privateState?.canStartGame;
  el.lobbyCard.classList.toggle("joined", hasJoinedRoom);
  el.startGameButton.classList.toggle("hidden", !hasJoinedRoom || !privateState?.isHost);

  renderPublic(publicState);
  renderPrivate(privateState, publicState);
}

function renderPublic(publicState) {
  const phase = publicState?.phase ?? PHASE.LOBBY;

  const hasPublicState = Boolean(publicState?.roomCode);

  el.lobbyCard.classList.toggle("hidden", hasPublicState && phase !== PHASE.LOBBY);
  el.transitionCard.classList.toggle("hidden", !hasPublicState || (phase !== PHASE.NIGHT_RESULT && phase !== PHASE.DAY_RESULT));
  el.mapCard.classList.toggle("hidden", !hasPublicState || phase === PHASE.NIGHT_RESULT || phase === PHASE.DAY_RESULT || phase === PHASE.GAME_OVER);
  el.gameOverCard.classList.toggle("hidden", !hasPublicState || phase !== PHASE.GAME_OVER);
  el.publicMessageCard.classList.toggle("hidden", !hasPublicState || phase === PHASE.NIGHT_RESULT || phase === PHASE.DAY_RESULT || phase === PHASE.GAME_OVER);

  el.publicTitle.textContent = phaseTitle(phase, publicState?.dayNumber);
  el.phaseLabel.textContent = phaseTitle(phase, publicState?.dayNumber);
  el.timerLabel.textContent = formatTimer(publicState?.phaseTimeRemaining || 0);
  el.publicMessage.textContent = publicState?.publicMessage || "Aguardando jogadores.";

  if (phase === PHASE.NIGHT_RESULT) {
    el.transitionTitle.textContent = "Amanheceu";
    el.transitionSubtitle.textContent = "notícia da noite";
    el.transitionMessage.textContent = publicState?.publicMessage || "A cidade acordou em silêncio.";
  }

  if (phase === PHASE.DAY_RESULT) {
    el.transitionTitle.textContent = "Anoiteceu";
    el.transitionSubtitle.textContent = "resultado da votação";
    el.transitionMessage.textContent = publicState?.publicMessage || "A cidade se prepara para outra noite.";
  }

  if (phase === PHASE.GAME_OVER) {
    const winners = Array.isArray(publicState?.winnerNames) ? publicState.winnerNames : [];
    el.gameOverTitle.textContent = "Fim de jogo";
    el.gameOverMessage.textContent = winners.length > 0
      ? `${publicState?.gameOverMessage || "Fim de jogo."}\n\nVencedores: ${winners.join(", ")}.`
      : (publicState?.gameOverMessage || "Fim de jogo.");
  }

  renderNeighborhoodMap(publicState || {});
  renderPublicPlayers(publicState?.players || []);
  renderPois(publicState?.pois || []);
}

function renderNeighborhoodMap(publicState) {
  const players = publicState?.players || [];
  const pois = publicState?.pois || [];
  const action = state.targetSelectionOpen ? state.selectedAction : null;
  el.neighborhoodMap.innerHTML = "";
  el.mapStatus.textContent = phaseTitle(publicState?.phase ?? PHASE.LOBBY, publicState?.dayNumber || 0).toLowerCase();
  el.mapCount.textContent = `${players.length} ${players.length === 1 ? "jogador" : "jogadores"}`;

  const layers = document.createElement("div");
  layers.className = "map-layers";
  layers.innerHTML = `
    <div class="map-block block-a"></div>
    <div class="map-block block-b"></div>
    <div class="map-block block-c"></div>
    <div class="map-block block-d"></div>
    <div class="street h street-xique"></div>
    <div class="street h street-gays"></div>
    <div class="street h street-lesbicas"></div>
    <div class="street h street-catapimbas"></div>
    <div class="street v street-zero"></div>
    <div class="street v street-beta"></div>
    <div class="street v street-alfa"></div>
    <div class="road-label road-xique">rua xique xique</div>
    <div class="road-label road-gays">rua dos gays</div>
    <div class="road-label road-lesbicas">rua das lesbicas</div>
    <div class="road-label road-catapimbas">rua catapimbas</div>
    <div class="road-label road-zero">rua Zero</div>
    <div class="road-label road-beta">rua dos beta</div>
    <div class="road-label road-alfa">rua dos alfa</div>
  `;
  el.neighborhoodMap.appendChild(layers);

  const clock = document.createElement("div");
  const progress = Number(publicState?.phaseProgress || 0);
  clock.className = `map-clock phase-${phaseName(publicState?.phase ?? PHASE.LOBBY)}`;
  clock.style.setProperty("--clock-progress", `${100 - progress}%`);
  clock.innerHTML = `<span></span>`;
  el.neighborhoodMap.appendChild(clock);

  const poiByCode = new Map(pois.map(poi => [poi.code, poi]));
  for (const [code, point] of Object.entries(MAP_POIS)) {
    const poi = poiByCode.get(code) || {};
    const selectable = canSelectMapPoi(poi, action);
    const selected = state.selectedTargetPoiCode === code;
    const node = document.createElement("button");
    node.type = "button";
    node.className = `map-poi status-${escapeCss(poi.status || "normal")}${selectable ? " selectable" : ""}${selected ? " selected" : ""}`;
    node.style.left = `${point.x}%`;
    node.style.top = `${point.y}%`;
    node.textContent = poi.name || point.label;
    node.title = poi.name || point.label;
    node.disabled = Boolean(action) && !selectable;
    if (selectable) {
      node.addEventListener("click", event => {
        event.stopPropagation();
        selectMapPoi(code);
      });
    }
    el.neighborhoodMap.appendChild(node);
  }

  const slotSet = BALANCED_SLOT_SETS[players.length] || FALLBACK_SLOT_ORDER;
  for (let index = 1; index <= players.length; index++) {
    const player = players[index - 1];
    const slotIndex = Number(player?.houseSlot || 0) || slotSet[index - 1] || FALLBACK_SLOT_ORDER[(index - 1) % FALLBACK_SLOT_ORDER.length];
    const point = MAP_HOUSE_SLOTS[slotIndex] || MAP_HOUSE_SLOTS[1];
    const selectable = canSelectMapPlayer(player, action);
    const selected = state.selectedTargetPlayerId === player?.id;
    const node = document.createElement("button");
    node.type = "button";
    node.className = `map-house${player?.isAlive === false ? " dead" : ""}${selectable ? " selectable" : ""}${selected ? " selected" : ""}`;
    node.style.left = `${point.x}%`;
    node.style.top = `${point.y}%`;
    node.innerHTML = `
      <span class="house-label">${escapeHtml(displayPlayerName(player, index))}</span>
      <span class="house-roof"></span>
      <span class="house-body"></span>
    `;
    node.title = `${displayPlayerName(player, index)} — ${player?.isAlive === false ? statusText(player.publicStatus) : "vivo"}`;
    node.disabled = Boolean(action) && !selectable;
    if (selectable) {
      node.addEventListener("click", event => {
        event.stopPropagation();
        selectMapPlayer(player.id);
      });
    }
    el.neighborhoodMap.appendChild(node);
  }
}

function canSelectMapPlayer(player, action) {
  if (!action || !player) return false;
  if (action.targetType !== TARGET_TYPE.PLAYER && action.targetType !== TARGET_TYPE.REGION) return false;
  const validIds = new Set(action.validTargetPlayerIds || []);
  const validIndexes = new Set(action.validTargetPlayerIndexes || []);
  return validIds.has(player.id) || validIndexes.has(player.index);
}

function canSelectMapPoi(poi, action) {
  if (!action || !poi) return false;
  if (action.targetType !== TARGET_TYPE.POI && action.targetType !== TARGET_TYPE.REGION) return false;
  if (poi.selectionEnabled === false) return false;
  return Boolean(poi.code);
}

function selectMapPlayer(playerId) {
  state.selectedTargetPlayerId = playerId || "";
  state.selectedTargetPoiCode = "";
  updateTargetConfirmState();
  renderTargetSelectionStatus();
  renderNeighborhoodMap(state.snapshot?.public || {});
}

function selectMapPoi(code) {
  state.selectedTargetPoiCode = code || "";
  state.selectedTargetPlayerId = "";
  updateTargetConfirmState();
  renderTargetSelectionStatus();
  renderNeighborhoodMap(state.snapshot?.public || {});
}

function renderTargetSelectionStatus() {
  if (!state.targetSelectionOpen) return;
  const label = selectedTargetLabel();
  el.targetHint.textContent = label ? `Selecionado: ${label}` : targetHint(state.selectedAction);
}

function selectedTargetLabel() {
  const players = state.snapshot?.public?.players || [];
  const pois = state.snapshot?.public?.pois || [];
  if (state.selectedTargetPlayerId) {
    const player = players.find(item => item.id === state.selectedTargetPlayerId);
    return displayPlayerName(player, player?.index);
  }
  if (state.selectedTargetPoiCode) {
    const poi = pois.find(item => item.code === state.selectedTargetPoiCode);
    return poi?.name || MAP_POIS[state.selectedTargetPoiCode]?.label || "local";
  }
  return "";
}

function renderPublicPlayers(players) {
  el.publicPlayers.innerHTML = "";

  for (const player of players) {
    const row = document.createElement("div");
    row.className = `player-row${player.isAlive ? "" : " dead"}`;
    row.innerHTML = `
      <span class="index-badge">${escapeHtml(player.index)}</span>
      <div>
        <strong>${escapeHtml(displayPlayerName(player, player.index))}</strong>
        <div class="status-badge">${player.isAlive ? "vivo" : statusText(player.publicStatus)}</div>
      </div>
      <span class="status-badge">${Number(player.voteCount || 0) > 0 ? `${player.voteCount} votos` : ""}</span>
    `;
    el.publicPlayers.appendChild(row);
  }
}

function renderPois(pois) {
  el.publicPois.innerHTML = "";

  for (const poi of pois) {
    const row = document.createElement("div");
    row.className = "poi-row";
    row.innerHTML = `
      <span class="index-badge">${escapeHtml(poi.index || "")}</span>
      <div>
        <strong>${escapeHtml(poi.name || poi.code)}</strong>
        <div class="status-badge">${escapeHtml(poi.status || "normal")}</div>
      </div>
      <span class="status-badge"></span>
    `;
    el.publicPois.appendChild(row);
  }
}

function renderPrivate(privateState, publicState) {
  const phase = publicState?.phase ?? PHASE.LOBBY;
  const hasPrivate = Boolean(privateState?.playerId);

  el.privateIdentity.textContent = hasPrivate ? displayPlayerName(privateState, privateState.playerIndex) : "sem jogador";
  renderEnergy(privateState?.energy || 0, privateState?.maxEnergy || 3);

  const privateMessage = privateState?.privateMessage || (hasPrivate ? "" : "Entre em uma sala.");
  el.privateMessage.textContent = privateMessage;

  const secondary = composeSecondaryMessage(privateState);
  el.secondaryMessage.textContent = secondary;
  el.secondaryMessage.classList.toggle("hidden", !secondary);

  renderRoleReveal(privateState, publicState);
  renderDetailsSheet(privateState);
  renderHostSettings(privateState, publicState);

  const showActions = phase === PHASE.NIGHT && privateState?.isAlive && !privateState?.hasSubmittedNightAction;
  const showVotes = phase === PHASE.DAY && privateState?.canVote;

  el.actionPanel.classList.toggle("hidden", !showActions);
  el.votePanel.classList.toggle("hidden", !showVotes);

  if (showActions) renderActions(privateState);
  else el.actionPanel.innerHTML = "";

  if (showVotes) renderVotePanel(privateState, publicState);
  else el.votePanel.innerHTML = "";
}


function renderHostSettings(privateState, publicState) {
  const phase = publicState?.phase ?? PHASE.LOBBY;
  const payload = privateState?.playtestSettings;
  const shouldShow = Boolean(payload && privateState?.isHost && phase === PHASE.LOBBY);

  el.hostSettingsCard.classList.toggle("hidden", !shouldShow);
  if (!shouldShow) return;

  const settings = payload.settings || {};
  setNumberInputValue(el.settingFirstDaySeconds, settings.firstDaySeconds);
  setNumberInputValue(el.settingDaySeconds, settings.daySeconds);
  setNumberInputValue(el.settingNightSeconds, settings.nightSeconds);
  setNumberInputValue(el.settingResultSeconds, settings.resultSeconds);
  setNumberInputValue(el.settingVotingOpensAtProgress, settings.votingOpensAtProgress);
  setNumberInputValue(el.settingMaxPrivateClues, settings.maxPrivateCluesPerPlayerPerNight);

  renderRoleToggles(payload.roleOptions || [], settings.disabledRoleIds || []);
}

function setNumberInputValue(input, value) {
  if (!input) return;
  if (document.activeElement === input) return;
  input.value = String(value ?? "");
}

function renderRoleToggles(roleOptions, disabledRoleIds) {
  const disabledSet = new Set(disabledRoleIds || []);
  const groups = [
    { alignment: 1, title: "Inocentes" },
    { alignment: 2, title: "Impostores" },
    { alignment: 3, title: "Neutros" }
  ];

  el.roleToggleList.innerHTML = "";

  for (const group of groups) {
    const items = roleOptions.filter(role => Number(role.alignment) === group.alignment);
    if (!items.length) continue;

    const section = document.createElement("section");
    section.className = "role-toggle-group";
    const title = document.createElement("h3");
    title.textContent = group.title;
    section.appendChild(title);

    for (const role of items) {
      const checked = !disabledSet.has(role.id) && !role.disabledByDefault;
      const label = document.createElement("label");
      label.className = `role-toggle${role.locked ? " locked" : ""}`;
      label.innerHTML = `
        <input type="checkbox" data-role-toggle="${escapeHtml(role.id)}" ${checked ? "checked" : ""} ${role.locked ? "disabled" : ""} />
        <span>
          <strong>${escapeHtml(role.name)}</strong>
          <small>${formatRoleToggleNote(role)}</small>
        </span>
      `;
      section.appendChild(label);
    }

    el.roleToggleList.appendChild(section);
  }
}

function formatRoleToggleNote(role) {
  const parts = [];
  if (role.minPlayers) parts.push(`entra a partir de ${role.minPlayers} jogadores`);
  if (role.note) parts.push(role.note);
  if (role.locked && !role.note) parts.push("travado");
  return parts.join(" · ") || "sorteável";
}

function applyHostSettings() {
  const disabledRoleIds = [...el.roleToggleList.querySelectorAll("input[data-role-toggle]")]
    .filter(input => !input.checked && !input.disabled)
    .map(input => input.dataset.roleToggle)
    .filter(Boolean);

  const settings = {
    firstDaySeconds: readNumberInput(el.settingFirstDaySeconds),
    daySeconds: readNumberInput(el.settingDaySeconds),
    nightSeconds: readNumberInput(el.settingNightSeconds),
    resultSeconds: readNumberInput(el.settingResultSeconds),
    votingOpensAtProgress: readNumberInput(el.settingVotingOpensAtProgress),
    maxPrivateCluesPerPlayerPerNight: readNumberInput(el.settingMaxPrivateClues),
    disabledRoleIds
  };

  socket.emit("game:updatePlaytestSettings", { ...getBasePayload(), settings }, response => {
    if (!response?.ok) {
      setNotice(errorText(response?.error || "configuração recusada"));
      return;
    }
    setNotice("Configurações de teste aplicadas.");
  });
}

function readNumberInput(input) {
  return Number(input?.value || 0);
}

function renderEnergy(energy, maxEnergy) {
  el.energyPips.innerHTML = "";
  for (let index = 0; index < maxEnergy; index++) {
    const pip = document.createElement("span");
    pip.className = `energy-pip${index < energy ? " on" : ""}`;
    el.energyPips.appendChild(pip);
  }
}

function renderRoleReveal(privateState, publicState) {
  const phase = publicState?.phase ?? PHASE.LOBBY;
  const roleKey = privateState?.roleId ? `${state.roomCode}:${privateState.playerId}:${privateState.roleId}` : "";
  const dismissed = roleKey && sessionStorage.getItem(`cidade.roleReveal.${roleKey}`) === "1";
  const shouldShow = Boolean(roleKey && phase !== PHASE.LOBBY && !dismissed);

  if (!shouldShow) {
    document.body.classList.remove("role-revealing");
    el.roleReveal.classList.add("hidden");
    return;
  }

  document.body.classList.add("role-revealing");
  el.revealRoleName.textContent = `Você é ${privateState.roleName || "—"}`;
  el.revealAlignment.textContent = ALIGNMENT_LABEL[privateState.alignment] || "—";
  el.revealObjective.textContent = privateState.roleMessage || "Leia sua ficha para o objetivo e habilidades.";
  state.revealedRoleKey = roleKey;
  el.roleReveal.classList.remove("hidden");
}

function dismissRoleReveal() {
  if (state.revealedRoleKey) {
    sessionStorage.setItem(`cidade.roleReveal.${state.revealedRoleKey}`, "1");
  }
  document.body.classList.remove("role-revealing");
  el.roleReveal.classList.add("hidden");
}

function renderActions(privateState) {
  el.actionPanel.innerHTML = "";

  const actions = [privateState.actions?.action1, privateState.actions?.action2, privateState.actions?.sleep]
    .filter(Boolean)
    .filter(action => action.implemented !== false && action.id !== "none");

  for (const action of actions) {
    const button = document.createElement("button");
    button.className = "action-button";
    const disabled = Number(privateState.energy || 0) < Number(action.energyCost || 0);
    button.disabled = disabled;
    button.innerHTML = `
      <span>${escapeHtml(cleanActionLabel(action.label))}</span>
      <span class="action-meta">${formatCost(action)}</span>
    `;
    button.addEventListener("click", () => beginAction(action.slot, action));
    el.actionPanel.appendChild(button);
  }
}

function renderVotePanel(privateState, publicState) {
  el.votePanel.innerHTML = "";
  const title = document.createElement("div");
  title.className = "section-title";
  title.textContent = "Votação";
  el.votePanel.appendChild(title);

  const skip = document.createElement("button");
  skip.textContent = "Pular voto";
  skip.addEventListener("click", () => submitVote(null, true));
  el.votePanel.appendChild(skip);

  for (const player of publicState?.players || []) {
    if (!player.isAlive || player.id === privateState.playerId) continue;
    const button = document.createElement("button");
    button.textContent = `${player.index}. ${displayPlayerName(player, player.index)}`;
    button.addEventListener("click", () => submitVote(player.id, false));
    el.votePanel.appendChild(button);
  }
}

function renderDetailsSheet(privateState) {
  el.sheetRoleName.textContent = privateState?.roleName || "—";
  el.sheetRoleGoal.textContent = privateState?.roleMessage || "Sem ficha disponível.";
  el.sheetAbilities.innerHTML = "";

  const actions = [privateState?.actions?.action1, privateState?.actions?.action2, privateState?.actions?.sleep]
    .filter(Boolean)
    .filter(action => action.id !== "none");

  for (const action of actions) {
    const card = document.createElement("div");
    card.className = "ability-card";
    card.innerHTML = `
      <strong>${escapeHtml(cleanActionLabel(action.label))}</strong>
      <div class="status-badge">${formatCost(action)} · ${escapeHtml(categoryTitle(action.microgameCategory))}</div>
      <p>${escapeHtml(action.description || "Sem descrição.")}</p>
    `;
    el.sheetAbilities.appendChild(card);
  }

  el.archetypeList.innerHTML = "";
  for (const archetype of MICROGAME_ARCHETYPES) {
    const card = document.createElement("div");
    card.className = "archetype-card";
    card.innerHTML = `<strong>${escapeHtml(archetype.title)}</strong><p>${escapeHtml(archetype.body)}</p>`;
    el.archetypeList.appendChild(card);
  }
}

function beginAction(slot, action) {
  state.selectedAction = action;
  state.selectedSlot = slot;
  state.selectedTargetPlayerId = "";
  state.selectedTargetPoiCode = "";
  state.selectedRoleGuessId = "";
  setNotice("");

  if (action.skipsMicrogame || action.targetType === TARGET_TYPE.NONE) {
    startMicrogame();
    return;
  }

  openTargetOverlay(action);
}

function openTargetOverlay(action) {
  state.targetSelectionOpen = true;
  el.targetOverlay.classList.remove("hidden");
  el.targetTitle.textContent = cleanActionLabel(action.label);
  el.targetHint.textContent = targetHint(action);
  state.selectedTab = action.targetType === TARGET_TYPE.POI ? "pois" : "players";
  el.targetTabs.classList.add("hidden");
  renderTargetOptions();
  renderNeighborhoodMap(state.snapshot?.public || {});
}

function renderTargetOptions() {
  const action = state.selectedAction;
  if (!action) return;

  el.targetGrid.innerHTML = `<div class="map-target-hint">Toque diretamente no mapa para escolher.</div>`;
  el.confirmTargetButton.disabled = true;
  el.targetTabs.classList.add("hidden");
  renderTargetSelectionStatus();
  updateTargetConfirmState();
}

function renderPlayerTargets(action) {
  const publicPlayers = state.snapshot?.public?.players || [];
  const validIds = new Set(action.validTargetPlayerIds || []);
  const validIndexes = new Set(action.validTargetPlayerIndexes || []);
  const privateState = state.snapshot?.private;

  for (const player of publicPlayers) {
    if (!validIds.has(player.id) && !validIndexes.has(player.index)) continue;

    const option = document.createElement("button");
    option.className = `target-option${state.selectedTargetPlayerId === player.id ? " selected" : ""}`;
    option.innerHTML = `
      <span class="index-badge">${escapeHtml(player.index)}</span>
      <span>${escapeHtml(player.name)}</span>
      <span class="status-badge">${player.isAlive ? "vivo" : statusText(player.publicStatus)}</span>
    `;
    option.addEventListener("click", () => {
      state.selectedTargetPlayerId = player.id;
      state.selectedTargetPoiCode = "";
      renderTargetOptions();
    });
    el.targetGrid.appendChild(option);
  }

  if (action.defaultTargetSelf && privateState?.playerId && !state.selectedTargetPlayerId) {
    state.selectedTargetPlayerId = privateState.playerId;
    renderTargetOptions();
  }
}

function renderPoiTargets() {
  const pois = state.snapshot?.public?.pois || [];

  for (const poi of pois) {
    if (poi.selectionEnabled === false) continue;
    const option = document.createElement("button");
    option.className = `target-option${state.selectedTargetPoiCode === poi.code ? " selected" : ""}`;
    option.innerHTML = `
      <span class="index-badge">${escapeHtml(poi.index || "")}</span>
      <span>${escapeHtml(poi.name || poi.code)}</span>
      <span class="status-badge">${escapeHtml(poi.status || "normal")}</span>
    `;
    option.addEventListener("click", () => {
      state.selectedTargetPoiCode = poi.code;
      state.selectedTargetPlayerId = "";
      renderTargetOptions();
    });
    el.targetGrid.appendChild(option);
  }
}

function updateTargetConfirmState() {
  const action = state.selectedAction;
  const hasPlayer = Boolean(state.selectedTargetPlayerId);
  const hasPoi = Boolean(state.selectedTargetPoiCode);
  el.confirmTargetButton.disabled = !(hasPlayer || hasPoi || action?.targetType === TARGET_TYPE.NONE);
}

function confirmTargetSelection() {
  closeTargetOverlay();

  if (state.selectedAction?.actionClass === "lithomancerGuess") {
    openRoleGuessOverlay();
    return;
  }

  startMicrogame();
}

function closeTargetOverlay() {
  state.targetSelectionOpen = false;
  el.targetOverlay.classList.add("hidden");
  renderNeighborhoodMap(state.snapshot?.public || {});
}

function openRoleGuessOverlay() {
  el.roleGuessOverlay.classList.remove("hidden");
  el.roleGuessGrid.innerHTML = "";
  state.selectedRoleGuessId = "";
  el.confirmRoleGuessButton.disabled = true;

  for (const role of ROLE_OPTIONS) {
    const option = document.createElement("button");
    option.className = "role-option";
    option.innerHTML = `<span>${escapeHtml(role.name)}</span>`;
    option.addEventListener("click", () => {
      state.selectedRoleGuessId = role.id;
      for (const child of el.roleGuessGrid.children) child.classList.remove("selected");
      option.classList.add("selected");
      el.confirmRoleGuessButton.disabled = false;
    });
    el.roleGuessGrid.appendChild(option);
  }
}

function confirmRoleGuessSelection() {
  closeRoleGuessOverlay();
  startMicrogame();
}

function closeRoleGuessOverlay() {
  el.roleGuessOverlay.classList.add("hidden");
}

function startMicrogame() {
  const action = state.selectedAction;
  if (!action) return;

  if (action.skipsMicrogame || action.microgameCategory === "recovery" || action.microgameCategory === "none") {
    submitAction({ microgameScore: 4, skippedMicrogame: true });
    return;
  }

  const category = action.microgameCategory || "watch";
  el.microgameOverlay.classList.remove("hidden");
  el.microgameCategoryLabel.textContent = categoryTitle(category);
  el.microgameTitle.textContent = cleanActionLabel(action.label);
  el.microgamePurpose.textContent = microgameInstruction(category);
  el.microgameScoreLabel.textContent = "Aguardando início";
  clearStage();
  renderMicrogameStart(category, action);
}

function renderMicrogameStart(category, action) {
  const wrap = document.createElement("div");
  wrap.className = "mg-start";
  wrap.innerHTML = `
    <strong>${escapeHtml(microgameInstruction(category))}</strong>
  `;
  const button = document.createElement("button");
  button.className = "primary";
  button.textContent = "Iniciar";
  button.addEventListener("click", () => {
    haptic(25);
    clearStage();
    runSelectedMicrogame(category, action);
  });
  wrap.appendChild(button);
  el.microgameStage.appendChild(wrap);
}

function runSelectedMicrogame(category, action) {
  el.microgameScoreLabel.textContent = "Score: em andamento";
  if (category === "investigation") runInvestigationMicrogame(action);
  else if (category === "violence") runViolenceMicrogame(action);
  else if (category === "ritual") runRitualMicrogame(action);
  else if (category === "manipulation") runManipulationMicrogame(action);
  else if (category === "invasion") runInvasionMicrogame(action);
  else runWatchMicrogame(action);
}

function clearStage() {
  stopActiveMicrogame();
  const freshStage = el.microgameStage.cloneNode(false);
  el.microgameStage.replaceWith(freshStage);
  el.microgameStage = freshStage;
  el.microgameTimer.textContent = "--";
}

function stopActiveMicrogame() {
  if (state.activeMicrogame?.timer) clearInterval(state.activeMicrogame.timer);
  if (state.activeMicrogame?.timeout) clearTimeout(state.activeMicrogame.timeout);
  if (typeof state.activeMicrogame?.cleanup === "function") state.activeMicrogame.cleanup();
  state.activeMicrogame = null;
}

function setupTimedMicrogame(seconds, onFinish) {
  const startedAt = Date.now();
  const durationMs = Math.max(3, Number(seconds || 7)) * 1000;
  const microgame = { startedAt, durationMs, onFinish, finished: false, timer: null, timeout: null };
  state.activeMicrogame = microgame;

  microgame.timer = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((durationMs - (Date.now() - startedAt)) / 1000));
    el.microgameTimer.textContent = `${remaining}s`;
  }, 100);

  microgame.timeout = setTimeout(() => {
    if (state.activeMicrogame === microgame && !microgame.finished) {
      onFinish();
    }
  }, durationMs);

  return microgame;
}

function finishMicrogame(score, extras = {}) {
  const action = state.selectedAction;
  if (!action) return;

  stopActiveMicrogame();
  el.microgameOverlay.classList.add("hidden");
  submitAction({ microgameScore: clampScore(score), ...extras });
}

function runInvestigationMicrogame(action) {
  const stage = el.microgameStage;
  const lens = document.createElement("div");
  lens.className = "mg-lens";
  stage.appendChild(lens);

  let hits = 0;
  let samples = 0;
  let target = spawnTarget("?", true);
  moveTarget(target);

  stage.addEventListener("pointermove", onMove);
  stage.addEventListener("pointerdown", onMove);

  setupTimedMicrogame(action.microgameTimeLimit || 8, () => {
    stage.removeEventListener("pointermove", onMove);
    stage.removeEventListener("pointerdown", onMove);
    finishMicrogame(scoreFromRatio(hits / Math.max(1, samples)));
  });

  const mover = setInterval(() => moveTarget(target), 1250);
  state.activeMicrogame.cleanup = () => clearInterval(mover);

  function onMove(event) {
    const rect = stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    lens.style.left = `${x}px`;
    lens.style.top = `${y}px`;
    samples++;
    if (pointInElement(x, y, target, stage)) {
      hits++;
      target.classList.add("active");
      haptic(8);
    } else {
      target.classList.remove("active");
    }
    el.microgameScoreLabel.textContent = `leitura: ${Math.round((hits / Math.max(1, samples)) * 100)}%`;
  }
}

function runViolenceMicrogame(action) {
  const stage = el.microgameStage;
  let hits = 0;
  let misses = 0;
  let total = 0;
  let current = null;

  function spawn() {
    if (current) current.remove();
    const isGood = Math.random() > 0.22;
    current = spawnTarget(isGood ? "alvo" : "vulto", isGood);
    current.addEventListener("pointerdown", event => {
      event.stopPropagation();
      if (isGood) {
        hits++;
        flashStage("good");
        haptic(18);
      } else {
        misses++;
        flashStage("bad");
        haptic([20, 35, 20]);
      }
      total++;
      el.microgameScoreLabel.textContent = `acertos: ${hits} · erros: ${misses}`;
      spawn();
    });
  }

  stage.addEventListener("pointerdown", onMiss);
  spawn();
  const interval = setInterval(spawn, 1350);

  setupTimedMicrogame(action.microgameTimeLimit || 9, () => {
    clearInterval(interval);
    stage.removeEventListener("pointerdown", onMiss);
    const ratio = hits / Math.max(1, hits + misses);
    const activityBonus = hits >= 2 ? 1 : 0;
    finishMicrogame(clampScore(scoreFromRatio(ratio) + activityBonus));
  });

  function onMiss() {
    misses++;
    flashStage("bad");
    haptic(12);
    el.microgameScoreLabel.textContent = `acertos: ${hits} · erros: ${misses}`;
  }
}

function runRitualMicrogame(action) {
  const stage = el.microgameStage;
  const track = document.createElement("div");
  track.className = "mg-track";
  const safe = document.createElement("div");
  safe.className = "mg-safe";
  const cursor = document.createElement("div");
  cursor.className = "mg-cursor";
  track.appendChild(safe);
  track.appendChild(cursor);
  stage.appendChild(track);

  let t = 0;
  let hits = 0;
  let taps = 0;
  let direction = 1;
  const safeLeft = 42;
  safe.style.left = `${safeLeft}%`;

  const interval = setInterval(() => {
    t += 0.025 * direction;
    if (t >= 1 || t <= 0) direction *= -1;
    cursor.style.left = `${Math.max(0, Math.min(96, t * 96))}%`;
  }, 16);

  stage.addEventListener("pointerdown", onTap);

  setupTimedMicrogame(action.microgameTimeLimit || 8, () => {
    clearInterval(interval);
    stage.removeEventListener("pointerdown", onTap);
    const ratio = hits / Math.max(1, taps);
    const volumeBonus = taps >= 4 ? 1 : 0;
    finishMicrogame(clampScore(scoreFromRatio(ratio) + volumeBonus - 1));
  });

  function onTap() {
    taps++;
    const pos = t * 100;
    if (Math.abs(pos - safeLeft) <= 10) {
      hits++;
      flashStage("good");
      haptic(18);
    } else {
      flashStage("bad");
      haptic(10);
    }
    el.microgameScoreLabel.textContent = `acertos: ${hits}/${taps}`;
  }
}

function runManipulationMicrogame(action) {
  const stage = el.microgameStage;
  const status = document.createElement("div");
  status.className = "mg-instruction";
  status.textContent = "Segure quando o painel mandar manter. Solte quando mandar esconder.";
  stage.appendChild(status);

  let holding = false;
  let desiredHold = true;
  let correct = 0;
  let samples = 0;

  stage.addEventListener("pointerdown", () => { holding = true; });
  stage.addEventListener("pointerup", () => { holding = false; });
  stage.addEventListener("pointerleave", () => { holding = false; });

  const switcher = setInterval(() => {
    desiredHold = Math.random() > 0.45;
    status.textContent = desiredHold ? "Manter" : "Esconder";
    status.classList.toggle("danger", !desiredHold);
  }, 900);

  const sampler = setInterval(() => {
    samples++;
    if (holding === desiredHold) correct++;
    el.microgameScoreLabel.textContent = `controle: ${Math.round((correct / Math.max(1, samples)) * 100)}%`;
  }, 120);

  setupTimedMicrogame(action.microgameTimeLimit || 8, () => {
    clearInterval(switcher);
    clearInterval(sampler);
    finishMicrogame(scoreFromRatio(correct / Math.max(1, samples)));
  });
}

function runInvasionMicrogame(action) {
  const stage = el.microgameStage;
  let loot = 0;
  let alarm = 0;
  const bag = document.createElement("div");
  bag.className = "mg-bag";
  bag.textContent = "coleta: 0";
  stage.appendChild(bag);

  for (let i = 0; i < 8; i++) {
    const item = document.createElement("button");
    item.className = "mg-loot";
    item.textContent = i % 3 === 0 ? "alto risco" : "baixo risco";
    item.style.left = `${8 + Math.random() * 76}%`;
    item.style.top = `${18 + Math.random() * 62}%`;
    item.addEventListener("pointerdown", event => {
      event.stopPropagation();
      const high = item.textContent === "alto risco";
      loot += high ? 2 : 1;
      alarm += high ? 2 : 0;
      item.remove();
      flashStage(high ? "bad" : "good");
      haptic(high ? [18, 30, 18] : 18);
      bag.textContent = `coleta: ${loot}`;
      el.microgameScoreLabel.textContent = `coleta: ${loot} · risco: ${alarm}`;
    });
    stage.appendChild(item);
  }

  setupTimedMicrogame(action.microgameTimeLimit || 7, () => {
    const theftValue = Math.max(0, Math.min(3, Math.floor(loot / 2)));
    const score = clampScore(4 - alarm + Math.floor(loot / 3));
    finishMicrogame(score, { theftValue });
  });
}

function runWatchMicrogame(action) {
  const stage = el.microgameStage;
  const zone = document.createElement("div");
  zone.className = "mg-watch-zone";
  zone.textContent = "segure";
  stage.appendChild(zone);

  let holding = false;
  let stable = 0;
  let samples = 0;
  let lastX = null;
  let lastY = null;

  zone.addEventListener("pointerdown", event => {
    event.preventDefault();
    holding = true;
    lastX = event.clientX;
    lastY = event.clientY;
    zone.classList.add("holding");
    haptic(18);
  });
  stage.addEventListener("pointermove", event => {
    if (!holding) return;
    const distance = lastX == null ? 0 : Math.hypot(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX;
    lastY = event.clientY;
    if (distance > 18) {
      stable = Math.max(0, stable - 1);
      flashStage("bad");
    }
  });
  stage.addEventListener("pointerup", () => { holding = false; zone.classList.remove("holding"); });
  stage.addEventListener("pointerleave", () => { holding = false; zone.classList.remove("holding"); });
  stage.addEventListener("pointercancel", () => { holding = false; zone.classList.remove("holding"); });

  const sampler = setInterval(() => {
    samples++;
    if (holding) stable++;
    el.microgameScoreLabel.textContent = `estabilidade: ${Math.round((stable / Math.max(1, samples)) * 100)}%`;
  }, 140);

  setupTimedMicrogame(action.microgameTimeLimit || 8, () => {
    clearInterval(sampler);
    const ratio = stable / Math.max(1, samples);
    finishMicrogame(scoreFromRatio(ratio));
  });

  state.activeMicrogame.cleanup = () => clearInterval(sampler);
}

function spawnTarget(text, good) {
  const target = document.createElement("button");
  target.className = `mg-target${good ? " good" : ""}`;
  target.textContent = text;
  target.style.width = "86px";
  target.style.height = "86px";
  el.microgameStage.appendChild(target);
  moveTarget(target);
  return target;
}

function moveTarget(target) {
  const rect = el.microgameStage.getBoundingClientRect();
  const x = 8 + Math.random() * 74;
  const y = 12 + Math.random() * 68;
  target.style.left = `${x}%`;
  target.style.top = `${y}%`;
  target.style.transform = "translate(-50%, -50%)";
}

function pointInElement(x, y, target, container) {
  const targetRect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  return x >= targetRect.left - containerRect.left
    && x <= targetRect.right - containerRect.left
    && y >= targetRect.top - containerRect.top
    && y <= targetRect.bottom - containerRect.top;
}

function submitAction({ microgameScore = 3, skippedMicrogame = false, theftValue = 0 } = {}) {
  const action = state.selectedAction;
  if (!action) return;

  const payload = {
    ...getBasePayload(),
    actionCommand: state.selectedSlot,
    targetPlayerId: state.selectedTargetPlayerId || "",
    targetPoiCode: state.selectedTargetPoiCode || "",
    guessedRoleId: state.selectedRoleGuessId || "",
    theftValue,
    microgameScore,
    skippedMicrogame,
    microgameId: Array.isArray(action.microgamePool) ? action.microgamePool[0] || "html" : "html"
  };

  socket.emit("game:submitActivityResult", payload, response => {
    if (!response?.ok) {
      setNotice(errorText(response?.error || "ação recusada"));
      return;
    }

    const warning = response.warning === "MICROGAME_CRITICAL_FAIL"
      ? "Falha crítica registrada. A ação ainda pode ter deixado rastros."
      : "Ação enviada.";
    setNotice(warning);
    state.selectedAction = null;
    state.selectedSlot = "";
  });
}

function submitVote(targetId, voteSkip) {
  socket.emit("game:submitVote", { ...getBasePayload(), targetId: targetId || "", voteSkip }, response => {
    if (!response?.ok) setNotice(errorText(response?.error || "voto recusado"));
    else setNotice("Voto enviado.");
  });
}

function composeSecondaryMessage(privateState) {
  const parts = [];
  if (state.lastNotice) parts.push(state.lastNotice);
  if (privateState?.playerEffectsMessage) parts.push(privateState.playerEffectsMessage);
  if (privateState?.effectLabels) parts.push(`Efeitos: ${privateState.effectLabels}`);
  return parts.filter(Boolean).join("\n\n");
}

function setNotice(message) {
  state.lastNotice = message || "";
  render();
}

function setupSheetDrag() {
  let dragging = false;
  let startY = 0;
  let startOpen = false;

  el.detailsSheet.addEventListener("pointerdown", event => {
    if (!event.target.closest(".sheet-handle")) return;
    dragging = true;
    startY = event.clientY;
    startOpen = el.detailsSheet.classList.contains("open");
    el.detailsSheet.setPointerCapture(event.pointerId);
  });

  el.detailsSheet.addEventListener("pointermove", event => {
    if (!dragging) return;
    const dy = event.clientY - startY;
    if (startOpen && dy > 40) el.detailsSheet.classList.remove("open");
    if (!startOpen && dy < -40) el.detailsSheet.classList.add("open");
  });

  el.detailsSheet.addEventListener("pointerup", () => { dragging = false; });
  el.detailsSheet.addEventListener("pointercancel", () => { dragging = false; });
}

function toggleSheet() {
  el.detailsSheet.classList.toggle("open");
}

function displayPlayerName(player, fallbackIndex = "") {
  const raw = String(player?.playerName || player?.name || "").trim();
  const index = Number(player?.playerIndex || player?.index || fallbackIndex || 0);
  if (!raw || raw.toLowerCase() === "jogador") return index ? `Jogador ${index}` : "Jogador";
  return raw;
}

function haptic(pattern = 15) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {
    // Vibração é opcional.
  }
}

function flashStage(type) {
  const stage = el.microgameStage;
  if (!stage) return;
  stage.classList.remove("flash-good", "flash-bad");
  void stage.offsetWidth;
  stage.classList.add(type === "bad" ? "flash-bad" : "flash-good");
}

function microgameInstruction(category) {
  const map = {
    investigation: "Arraste o foco sobre o sinal quando ele aparecer.",
    violence: "Toque nos alvos. Evite os vultos.",
    ritual: "Toque quando o marcador passar pela zona segura.",
    manipulation: "Segure em manter. Solte em esconder.",
    invasion: "Colete itens antes do tempo acabar.",
    watch: "Segure a área e mantenha o toque estável.",
    recovery: "Dormir não tem minigame."
  };
  return map[category] || "Jogue a ação até o tempo acabar.";
}

function targetHint(action) {
  if (action.targetType === TARGET_TYPE.REGION) return "Toque em uma casa ou local no mapa.";
  if (action.targetType === TARGET_TYPE.POI) return "Toque em um local no mapa.";
  if (action.targetType === TARGET_TYPE.PLAYER) return "Toque em uma casa no mapa.";
  return "Esta ação não precisa de alvo.";
}

function microgamePurpose(category) {
  return microgameInstruction(category);
}


function categoryTitle(category) {
  return MICROGAME_ARCHETYPES.find(item => item.id === category)?.title || "Sem categoria";
}

function phaseName(phase) {
  if (phase === PHASE.LOBBY) return "lobby";
  if (phase === PHASE.DAY) return "day";
  if (phase === PHASE.NIGHT) return "night";
  if (phase === PHASE.NIGHT_RESULT) return "night-result";
  if (phase === PHASE.DAY_RESULT) return "day-result";
  if (phase === PHASE.GAME_OVER) return "game-over";
  return "unknown";
}

function phaseTitle(phase, dayNumber = 0) {
  if (phase === PHASE.LOBBY) return "cidade fodida";
  if (phase === PHASE.DAY) return Number(dayNumber) <= 1 ? "Primeiro dia" : `Dia ${dayNumber}`;
  if (phase === PHASE.NIGHT) return `Noite ${dayNumber}`;
  if (phase === PHASE.NIGHT_RESULT) return "Amanheceu";
  if (phase === PHASE.DAY_RESULT) return "Anoiteceu";
  if (phase === PHASE.GAME_OVER) return "Fim de jogo";
  return "cidade fodida";
}

function formatTimer(seconds) {
  if (!seconds) return "--";
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${String(sec).padStart(2, "0")}`;
}

function formatCost(action) {
  const cost = Number(action.energyCost || 0);
  const gain = Number(action.energyGain || 0);
  if (gain > 0) return `+${gain} energia`;
  if (cost <= 0) return "sem custo";
  return `${cost} energia`;
}

function cleanActionLabel(label) {
  return String(label || "Ação").replace(/[◆◇◈◉○●]+/g, "").trim();
}

function statusText(status) {
  if (status === "nightDead") return "morto à noite";
  if (status === "votedOut") return "eliminado";
  return "morto";
}

function errorText(error) {
  const map = {
    ROOM_NOT_FOUND: "Sala não encontrada.",
    GAME_ALREADY_STARTED: "A partida já começou.",
    ROOM_FULL: "Sala cheia.",
    NOT_HOST: "Apenas o anfitrião pode fazer isso.",
    NOT_ENOUGH_PLAYERS: "Jogadores insuficientes.",
    NOT_NIGHT: "A ação só pode ser enviada à noite.",
    ACTION_NOT_AVAILABLE: "Ação indisponível.",
    ACTION_ALREADY_SUBMITTED: "Você já enviou uma ação nesta noite.",
    INVALID_TARGET: "Alvo inválido.",
    INVALID_SELF_TARGET: "Você não pode selecionar a si mesmo para esta ação.",
    INVALID_IMPOSTOR_ALLY_TARGET: "Alvo inválido.",
    INVALID_ROLE_GUESS: "Escolha um papel para o Vaticínio.",
    INSUFFICIENT_ENERGY: "Energia insuficiente.",
    VOTING_CLOSED: "A votação ainda não está aberta."
  };
  return map[error] || String(error || "Erro.");
}

function scoreFromRatio(ratio) {
  if (ratio >= 0.82) return 4;
  if (ratio >= 0.58) return 3;
  if (ratio >= 0.32) return 2;
  if (ratio >= 0.12) return 1;
  return 0;
}

function clampScore(score) {
  return Math.max(0, Math.min(4, Math.round(Number(score) || 0)));
}

function escapeCss(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "-");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

bindElements();
setupEvents();
render();
