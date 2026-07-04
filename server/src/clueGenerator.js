const {
  ACTION_CLASS,
  CLUE_CONFIG,
  CLUE_VISIBILITY,
  POI_CONFIG
} = require("./constants");

// ============================================================
// CLUE GENERATOR — SERVER MODULE
// ============================================================
//
// Regra de design:
//
// - Pistas padrão são privadas.
// - publicClues só deve ser usado por habilidades específicas futuras
//   como jornalista/publicação.
// - O publicMessage não deve receber pistas comuns da noite.
// - Cada jogador deve receber um conjunto legível de pistas, sem empilhar
//   frases equivalentes sobre o mesmo lugar/fenômeno.
//
// Entrada:
//   resolveNightClues({ room, seed })
//
// Saída:
//   {
//     publicClues: string[],
//     privateCluesByPlayerId: Record<string, string[]>,
//     rawClues: object[]
//   }
//
// ============================================================

const CLUE_CATEGORY = {
  QUIET: "quiet",
  OWN_ACTION: "ownAction",
  OWN_HOME: "ownHome",
  ROUTE_ROAD: "routeRoad",
  ROUTE_POI: "routePoi",
  TARGET_HOME: "targetHome",
  TARGET_POI: "targetPoi",
  MISSED_HOME: "missedHome",
  PROTECTED: "protected",
  SPECIAL_ACTION: "specialAction",
  PLANTED_EVIDENCE: "plantedEvidence",
  FALLBACK: "fallback"
};

const DEFAULT_CATEGORY_PRIORITY = {
  [CLUE_CATEGORY.OWN_ACTION]: 100,
  [CLUE_CATEGORY.OWN_HOME]: 95,
  [CLUE_CATEGORY.QUIET]: 90,
  [CLUE_CATEGORY.TARGET_HOME]: 80,
  [CLUE_CATEGORY.TARGET_POI]: 75,
  [CLUE_CATEGORY.MISSED_HOME]: 90,
  [CLUE_CATEGORY.PROTECTED]: 90,
  [CLUE_CATEGORY.SPECIAL_ACTION]: 85,
  [CLUE_CATEGORY.PLANTED_EVIDENCE]: 70,
  [CLUE_CATEGORY.ROUTE_POI]: 60,
  [CLUE_CATEGORY.ROUTE_ROAD]: 50,
  [CLUE_CATEGORY.FALLBACK]: 10
};

function getCategoryPriority(category) {
  const configured = CLUE_CONFIG.clueSelection?.categoryPriority || {};
  const categoryKey = String(category || CLUE_CATEGORY.FALLBACK);

  return Number(
    configured[categoryKey] ??
    DEFAULT_CATEGORY_PRIORITY[categoryKey] ??
    DEFAULT_CATEGORY_PRIORITY[CLUE_CATEGORY.FALLBACK] ??
    0
  );
}

function resolveNightClues({ room, seed = Date.now() } = {}) {
  const publicClues = [];
  const privateClueObjectsByPlayerId = createPrivateClueMap(room);
  const rawClues = [];

  if (!room || !Array.isArray(room.players)) {
    return {
      publicClues,
      privateCluesByPlayerId: privateClueObjectsByPlayerId,
      rawClues
    };
  }

  const actions = Object.values(room.nightActions || {})
    .filter(Boolean)
    .sort((a, b) => String(a.actorId || "").localeCompare(String(b.actorId || "")));

  for (let index = 0; index < actions.length; index++) {
    const action = actions[index];
    const actor = getPlayerById(room, action.actorId);

    if (!actor) {
      continue;
    }

    const rng = createRng(Number(action.microgameSeed || seed) + index * 1013);
    const actionClues = generateActionClues({ room, action, actor, rng });

    for (const clue of actionClues) {
      const normalized = normalizeClueVisibility(action, clue);

      rawClues.push(normalized);

      if (normalized.visibility === CLUE_VISIBILITY.PUBLIC) {
        publicClues.push(normalized.text);
        continue;
      }

      if (normalized.visibility === CLUE_VISIBILITY.PRIVATE && normalized.playerId) {
        if (!privateClueObjectsByPlayerId[normalized.playerId]) {
          privateClueObjectsByPlayerId[normalized.playerId] = [];
        }

        privateClueObjectsByPlayerId[normalized.playerId].push(normalized);
      }
    }
  }

  ensurePrivateFallbacks(room, privateClueObjectsByPlayerId);

  return {
    publicClues: uniqueStrings(publicClues),
    privateCluesByPlayerId: finalizePrivateClues(privateClueObjectsByPlayerId),
    rawClues
  };
}

function generateActionClues({ room, action, actor, rng }) {
  const actionClass = String(action.actionClass || "");
  const quality = getMicrogameQuality(action.microgameScore);
  const clues = [];

  if (actionClass === ACTION_CLASS.REST) {
    clues.push(privateClue(actor.id, template("quietNight", {}, rng), {
      category: CLUE_CATEGORY.QUIET,
      placeKey: `player:${actor.id}`,
      priority: getCategoryPriority(CLUE_CATEGORY.QUIET)
    }));

    return clues;
  }

  if (actionClass === ACTION_CLASS.STAY_HOME_AWAKE) {
    clues.push(privateClue(actor.id, template("ownHomeObservation", {}, rng), {
      category: CLUE_CATEGORY.OWN_HOME,
      placeKey: `home:${actor.id}`,
      priority: getCategoryPriority(CLUE_CATEGORY.OWN_HOME)
    }));

    return clues;
  }

  if (
    actionClass === ACTION_CLASS.DETECT_REGION ||
    actionClass === ACTION_CLASS.PROTECT_PLAYER ||
    actionClass === ACTION_CLASS.JOURNALIST_REPORT ||
    actionClass === ACTION_CLASS.AMBUSH_POI ||
    actionClass === ACTION_CLASS.PLANT_EVIDENCE
  ) {
    return clues;
  }

  if (actionClass === ACTION_CLASS.VISIT_POI) {
    const poi = getPoi(action.targetPoiCode);

    if (!poi) {
      clues.push(privateClue(actor.id, template("noUsefulClue", {}, rng), {
        category: CLUE_CATEGORY.FALLBACK,
        priority: getCategoryPriority(CLUE_CATEGORY.FALLBACK)
      }));

      return clues;
    }

    const route = buildRouteForAction({ room, actor, targetNode: poi.anchorNode });

    // Pista principal da própria ação. Esta já cobre o destino.
    // Não adicionamos targetPoi para o ator, porque ficava redundante:
    // "Você foi até X..." + "Você percebeu movimento perto de X..."
    clues.push(privateClue(
      actor.id,
      template("actionPrivateVisitPoi", { place: poi.visibleName }, rng),
      {
        category: CLUE_CATEGORY.OWN_ACTION,
        placeKey: `poi:${poi.code}`,
        priority: getCategoryPriority(CLUE_CATEGORY.OWN_ACTION)
      }
    ));

    addPrivateRouteClues({ room, route, actor, quality, rng, clues });
    addPrivatePoiClues({ room, poi, actor, quality, rng, clues });

    return limitPrivateNoise(clues, quality, rng);
  }

  if (actionClass === ACTION_CLASS.VISIT_PLAYER) {
    const target = getPlayerById(room, action.targetPlayerId);

    if (!target) {
      clues.push(privateClue(actor.id, template("noUsefulClue", {}, rng), {
        category: CLUE_CATEGORY.FALLBACK,
        priority: getCategoryPriority(CLUE_CATEGORY.FALLBACK)
      }));

      return clues;
    }

    const targetSlot = getPlayerSlot(target);
    const route = buildRouteForAction({ room, actor, targetNode: targetSlot.homeNode });

    clues.push(privateClue(
      actor.id,
      template("actionPrivateVisitPlayer", { player: target.name }, rng),
      {
        category: CLUE_CATEGORY.OWN_ACTION,
        placeKey: `player:${target.id}`,
        priority: getCategoryPriority(CLUE_CATEGORY.OWN_ACTION)
      }
    ));

    if (target.isAlive) {
      clues.push(privateClue(
        target.id,
        template("targetHome", { player: target.name }, rng),
        {
          category: CLUE_CATEGORY.TARGET_HOME,
          placeKey: `home:${target.id}`,
          priority: getCategoryPriority(CLUE_CATEGORY.TARGET_HOME)
        }
      ));
    }

    addPrivateRouteClues({ room, route, actor, quality, rng, clues });
    addPrivateTargetHomeClues({ room, target, actor, quality, rng, clues });

    return limitPrivateNoise(clues, quality, rng);
  }

  clues.push(privateClue(actor.id, template("noUsefulClue", {}, rng), {
    category: CLUE_CATEGORY.FALLBACK,
    priority: getCategoryPriority(CLUE_CATEGORY.FALLBACK)
  }));

  return clues;
}

function addPrivateRouteClues({ room, route, actor, quality, rng, clues }) {
  if (!route || !Array.isArray(route.roads) || route.roads.length <= 0) {
    return;
  }

  const roadCount = quality === "bad" ? 2 : 1;
  const selectedRoads = shuffle(route.roads, rng).slice(0, roadCount);

  for (const roadCode of selectedRoads) {
    const road = CLUE_CONFIG.roads[roadCode];

    if (!road) {
      continue;
    }

    const observers = getAliveObserversNearRoad(room, roadCode, {
      excludePlayerIds: [actor.id]
    });

    for (const observer of observers) {
      clues.push(privateClue(
        observer.id,
        template("routeRoad", { place: road.visibleName }, rng),
        {
          category: CLUE_CATEGORY.ROUTE_ROAD,
          placeKey: `road:${roadCode}`,
          priority: getCategoryPriority(CLUE_CATEGORY.ROUTE_ROAD)
        }
      ));
    }
  }
}

function addPrivatePoiClues({ room, poi, actor, quality, rng, clues }) {
  if (quality === "good") {
    return;
  }

  const observerIds = new Set([actor.id]);

  for (const roadCode of poi.nearRoads || []) {
    const observers = getAliveObserversNearRoad(room, roadCode, {
      excludePlayerIds: [actor.id]
    });

    for (const observer of observers) {
      if (observerIds.has(observer.id)) {
        continue;
      }

      observerIds.add(observer.id);
      clues.push(privateClue(
        observer.id,
        template("routePoi", { place: poi.visibleName }, rng),
        {
          category: CLUE_CATEGORY.ROUTE_POI,
          placeKey: `poi:${poi.code}`,
          priority: getCategoryPriority(CLUE_CATEGORY.ROUTE_POI)
        }
      ));
    }
  }
}

function addPrivateTargetHomeClues({ room, target, actor, quality, rng, clues }) {
  if (quality === "good") {
    return;
  }

  const targetSlot = getPlayerSlot(target);
  const observerIds = new Set([actor.id, target.id]);

  for (const roadCode of targetSlot.homeRoads || []) {
    const observers = getAliveObserversNearRoad(room, roadCode, {
      excludePlayerIds: [actor.id, target.id]
    });

    for (const observer of observers) {
      if (observerIds.has(observer.id)) {
        continue;
      }

      observerIds.add(observer.id);
      clues.push(privateClue(
        observer.id,
        template("targetHome", { player: target.name }, rng),
        {
          category: CLUE_CATEGORY.TARGET_HOME,
          placeKey: `home:${target.id}`,
          priority: getCategoryPriority(CLUE_CATEGORY.TARGET_HOME)
        }
      ));
    }
  }
}

function limitPrivateNoise(clues, quality, rng) {
  const maxPerAction =
    CLUE_CONFIG.clueSelection.selectedClueCountByMicrogameQuality[quality] || 3;

  const byPlayerId = new Map();
  const result = [];

  for (const clue of clues) {
    if (clue.visibility !== CLUE_VISIBILITY.PRIVATE || !clue.playerId) {
      result.push(clue);
      continue;
    }

    if (!byPlayerId.has(clue.playerId)) {
      byPlayerId.set(clue.playerId, []);
    }

    byPlayerId.get(clue.playerId).push(clue);
  }

  for (const playerClues of byPlayerId.values()) {
    const filtered = selectReadableClues(playerClues, {
      maxCount: maxPerAction,
      rng
    });

    result.push(...filtered);
  }

  return result;
}

function selectReadableClues(clues, options = {}) {
  const maxCount = Number(options.maxCount || clues.length || 0);
  const config = CLUE_CONFIG.clueSelection || {};
  const maxSameCategory = Number(config.maxSameCategoryPerPlayer || 1);
  const maxSamePlace = Number(config.maxSamePlacePerPlayer || 1);

  const indexed = (clues || [])
    .filter(clue => clue && String(clue.text || "").trim())
    .map((clue, index) => ({
      ...clue,
      _originalIndex: index,
      _priority: Number(clue.priority ?? getCategoryPriority(clue.category))
    }));

  indexed.sort((a, b) => {
    if (b._priority !== a._priority) {
      return b._priority - a._priority;
    }

    return a._originalIndex - b._originalIndex;
  });

  const result = [];
  const categoryCount = new Map();
  const placeCount = new Map();
  const textSeen = new Set();

  for (const clue of indexed) {
    const textKey = normalizeTextKey(clue.text);
    const categoryKey = String(clue.category || CLUE_CATEGORY.FALLBACK);
    const placeKey = String(clue.placeKey || "");

    if (!textKey || textSeen.has(textKey)) {
      continue;
    }

    if (maxSameCategory > 0) {
      const count = categoryCount.get(categoryKey) || 0;

      if (count >= maxSameCategory) {
        continue;
      }
    }

    if (placeKey && maxSamePlace > 0) {
      const count = placeCount.get(placeKey) || 0;

      if (count >= maxSamePlace) {
        continue;
      }
    }

    textSeen.add(textKey);
    categoryCount.set(categoryKey, (categoryCount.get(categoryKey) || 0) + 1);

    if (placeKey) {
      placeCount.set(placeKey, (placeCount.get(placeKey) || 0) + 1);
    }

    result.push(clue);

    if (maxCount > 0 && result.length >= maxCount) {
      break;
    }
  }

  result.sort((a, b) => {
    const ownA = a.category === CLUE_CATEGORY.OWN_ACTION ||
      a.category === CLUE_CATEGORY.OWN_HOME ||
      a.category === CLUE_CATEGORY.QUIET;

    const ownB = b.category === CLUE_CATEGORY.OWN_ACTION ||
      b.category === CLUE_CATEGORY.OWN_HOME ||
      b.category === CLUE_CATEGORY.QUIET;

    if (ownA !== ownB) {
      return ownA ? -1 : 1;
    }

    if (b._priority !== a._priority) {
      return b._priority - a._priority;
    }

    return a._originalIndex - b._originalIndex;
  });

  return result;
}

function finalizePrivateClues(map) {
  const result = {};
  const maxPerNight = Number(CLUE_CONFIG.clueSelection.maxCluesPerPlayerPerNight || 3);

  for (const [playerId, clues] of Object.entries(map || {})) {
    const selected = selectReadableClues(clues, {
      maxCount: maxPerNight
    });

    result[playerId] = uniqueStrings(selected.map(clue => clue.text));
  }

  return result;
}

function normalizeClueVisibility(action, clue) {
  if (!clue) {
    return privateClue("", "");
  }

  if (clue.visibility !== CLUE_VISIBILITY.PUBLIC) {
    return clue;
  }

  if (canActionPublishPublicClues(action)) {
    return clue;
  }

  // Segurança: mesmo que alguma função antiga gere publicClue(),
  // ela não vaza para publicMessage sem habilidade autorizada.
  return {
    ...clue,
    visibility: CLUE_VISIBILITY.PRIVATE,
    playerId: action.actorId || clue.playerId || "",
    category: clue.category || CLUE_CATEGORY.FALLBACK,
    priority: clue.priority ?? getCategoryPriority(CLUE_CATEGORY.FALLBACK)
  };
}

function canActionPublishPublicClues(action) {
  const publication = CLUE_CONFIG.publication || {};

  if (publication.defaultPublicCluesEnabled === true) {
    return true;
  }

  const actionId = String(action.actionId || "");
  const actionClass = String(action.actionClass || "");

  if (Array.isArray(publication.publicClueActionIds) &&
      publication.publicClueActionIds.includes(actionId)) {
    return true;
  }

  if (Array.isArray(publication.publicClueActionClasses) &&
      publication.publicClueActionClasses.includes(actionClass)) {
    return true;
  }

  return false;
}

function buildRouteForAction({ room, actor, targetNode }) {
  const actorSlot = getPlayerSlot(actor);

  if (!actorSlot.homeNode || !targetNode || actorSlot.homeNode === targetNode) {
    return {
      nodes: [],
      roads: []
    };
  }

  const graph = buildGraph();
  const nodes = findShortestPath(graph, actorSlot.homeNode, targetNode);

  if (nodes.length <= 1) {
    return {
      nodes,
      roads: []
    };
  }

  const roads = [];

  for (let index = 0; index < nodes.length - 1; index++) {
    const road = findRoadBetween(nodes[index], nodes[index + 1]);

    if (road && roads[roads.length - 1] !== road) {
      roads.push(road);
    }
  }

  return { nodes, roads };
}

function buildGraph() {
  const graph = {};

  for (const edge of CLUE_CONFIG.graphEdges) {
    if (!graph[edge.from]) graph[edge.from] = [];
    if (!graph[edge.to]) graph[edge.to] = [];

    graph[edge.from].push(edge.to);
    graph[edge.to].push(edge.from);
  }

  return graph;
}

function findShortestPath(graph, start, end) {
  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];

    if (node === end) {
      return path;
    }

    for (const next of graph[node] || []) {
      if (visited.has(next)) {
        continue;
      }

      visited.add(next);
      queue.push([...path, next]);
    }
  }

  return [];
}

function findRoadBetween(a, b) {
  const match = CLUE_CONFIG.graphEdges.find(edge => {
    return (
      (edge.from === a && edge.to === b) ||
      (edge.from === b && edge.to === a)
    );
  });

  return match ? match.road : "";
}

function getMicrogameQuality(score) {
  const number = Number(score || 0);

  if (number >= CLUE_CONFIG.microgameQuality.goodMin) {
    return "good";
  }

  if (number >= CLUE_CONFIG.microgameQuality.mediumMin) {
    return "medium";
  }

  return "bad";
}

function getAliveObserversNearRoad(room, roadCode, options = {}) {
  const excluded = new Set(options.excludePlayerIds || []);

  return (room.players || []).filter(player => {
    if (!player || !player.isAlive || excluded.has(player.id)) {
      return false;
    }

    const slot = getPlayerSlot(player);
    return Array.isArray(slot.homeRoads) && slot.homeRoads.includes(roadCode);
  });
}

function getPlayerSlot(player) {
  const slotKey = `p${Number(player.index || 1)}`;
  const slot = CLUE_CONFIG.playerSlots[slotKey] || CLUE_CONFIG.playerSlots.p1;

  return {
    ...slot,
    slotKey,
    visibleName: player.name || slotKey
  };
}

function getPoi(code, index) {
  const normalizedCode = String(code || "");

  if (normalizedCode && POI_CONFIG.definitions[normalizedCode]) {
    return {
      code: normalizedCode,
      ...POI_CONFIG.definitions[normalizedCode]
    };
  }

  const found = Object.values(POI_CONFIG.definitions || {}).find(poi => {
    return Number(poi.index) === Number(index);
  });

  if (!found) {
    return null;
  }

  return {
    code: found.code,
    ...found
  };
}

function getPlayerById(room, playerId) {
  return room.players.find(player => player.id === playerId) || null;
}

function privateClue(playerId, text, meta = {}) {
  return {
    visibility: CLUE_VISIBILITY.PRIVATE,
    playerId,
    text: String(text || ""),
    category: meta.category || CLUE_CATEGORY.FALLBACK,
    placeKey: meta.placeKey || "",
    priority: Number(meta.priority ?? getCategoryPriority(meta.category))
  };
}

function publicClue(text, meta = {}) {
  return {
    visibility: CLUE_VISIBILITY.PUBLIC,
    playerId: "",
    text: String(text || ""),
    category: meta.category || CLUE_CATEGORY.FALLBACK,
    placeKey: meta.placeKey || "",
    priority: Number(meta.priority ?? getCategoryPriority(meta.category))
  };
}

function template(templateKey, data, rng) {
  const options = CLUE_CONFIG.templates[templateKey] || [""];
  const raw = pick(options, rng);

  return renderTemplateText(raw, data);
}

function renderTemplateText(raw, data = {}) {
  return String(raw || "").replace(/\{([^}]+)\}/g, (_match, key) => {
    const normalizedKey = String(key || "").trim();
    return String(data[normalizedKey] ?? "");
  }).trim();
}


function buildMissedHomeAttackClue({ room, action, target, rngSeed } = {}) {
  const rng = createRng(Number(rngSeed || action?.microgameSeed || Date.now()));
  const data = buildClueTemplateData(room, action, {
    player: target?.name || action?.targetPlayerName || "alguém",
    targetPlayer: target?.name || action?.targetPlayerName || "alguém",
    targetHome: target ? getPlayerHomeLabel(target) : "sua casa",
    targetRegion: target ? getPlayerHomeLabel(target) : "sua casa",
    "target region": target ? getPlayerHomeLabel(target) : "sua casa",
    crimeScene: target ? getPlayerHomeLabel(target) : "sua casa",
    "crime scene": target ? getPlayerHomeLabel(target) : "sua casa"
  });

  return template("missedHomeAttack", data, rng);
}

function buildProtectedAttackClue({ room, action, target, rngSeed } = {}) {
  const rng = createRng(Number(rngSeed || action?.microgameSeed || Date.now()));
  const data = buildClueTemplateData(room, action, {
    player: target?.name || action?.targetPlayerName || "você",
    targetPlayer: target?.name || action?.targetPlayerName || "você",
    targetHome: target ? getPlayerHomeLabel(target) : "sua casa",
    targetRegion: target ? getPlayerHomeLabel(target) : "sua casa",
    "target region": target ? getPlayerHomeLabel(target) : "sua casa"
  });

  return template("protectedAttack", data, rng);
}

function buildDetectiveClue({ room, action, rngSeed } = {}) {
  const rng = createRng(Number(rngSeed || action?.microgameSeed || Date.now()));
  const regionLabel = getActionRegionLabel(action);
  const detail = getMovementDetailsForRegion(room, action, {
    includeActor: false
  });

  const data = buildClueTemplateData(room, action, {
    place: regionLabel,
    targetRegion: regionLabel,
    "target region": regionLabel,
    detail: detail || "nada fora do ordinário foi notado"
  });

  return template("detectiveRegion", data, rng);
}

function buildJournalistPublishedClue({ room, action, rngSeed } = {}) {
  const rng = createRng(Number(rngSeed || action?.microgameSeed || Date.now()));
  const regionLabel = getActionRegionLabel(action);
  const detail = getMovementDetailsForRegion(room, action, {
    includeActor: false
  });

  const data = buildClueTemplateData(room, action, {
    place: regionLabel,
    targetRegion: regionLabel,
    "target region": regionLabel,
    detail: detail || "nada fora do ordinário foi notado"
  });

  return template("journalistPublished", data, rng);
}

function buildPlantedEvidenceClues({ room, action, actor, target, rngSeed } = {}) {
  const rng = createRng(Number(rngSeed || action?.microgameSeed || Date.now()));
  const resolvedActor = actor || getPlayerById(room, action?.actorId);
  const resolvedTarget = target || getPlayerById(room, action?.targetPlayerId);

  if (!resolvedActor || !resolvedTarget) {
    return {
      actorText: "",
      observerText: "",
      observerIds: []
    };
  }

  const data = buildClueTemplateData(room, action, {
    player: resolvedTarget.name,
    targetPlayer: resolvedTarget.name,
    targetHome: getPlayerHomeLabel(resolvedTarget),
    targetRegion: getPlayerHomeLabel(resolvedTarget),
    "target region": getPlayerHomeLabel(resolvedTarget)
  });

  const observerText = template("plantedEvidence", data, rng);
  const actorText = template("plantedEvidenceActor", data, rng);

  const observers = pickPlantedEvidenceObservers({
    room,
    actor: resolvedActor,
    target: resolvedTarget,
    action,
    rng
  });

  return {
    actorText,
    observerText,
    observerIds: observers.map(observer => observer.id)
  };
}

function pickPlantedEvidenceObservers({ room, actor, target, action, rng }) {
  const excluded = new Set([actor.id, target.id]);
  const crimeContext = getCrimeSceneContext(room, action);
  const relevantRoadCodes = new Set(crimeContext.crimeSceneRoadCodes || []);

  const aliveObservers = (room.players || []).filter(player => {
    return player && player.isAlive && !excluded.has(player.id);
  });

  const nearCrime = [];
  const others = [];

  for (const observer of aliveObservers) {
    const slot = getPlayerSlot(observer);
    const observerRoads = Array.isArray(slot.homeRoads) ? slot.homeRoads : [];
    const isNear = observerRoads.some(road => relevantRoadCodes.has(road));

    if (isNear) {
      nearCrime.push(observer);
    } else {
      others.push(observer);
    }
  }

  return [
    ...shuffle(nearCrime, rng),
    ...shuffle(others, rng)
  ].slice(0, 2);
}

function buildClueTemplateData(room, action = {}, extra = {}) {
  const actor = getPlayerById(room, action.actorId);
  const target = getPlayerById(room, action.targetPlayerId);
  const poi = getPoi(action.targetPoiCode, action.targetPoiIndex);
  const crimeContext = getCrimeSceneContext(room, action);
  const regionLabel = getActionRegionLabel(action);
  const adjacentRoad =
    crimeContext.adjacentCrimeSceneRoad ||
    getFirstRelevantRoadName({ target, poi });

  const actionPathData = buildActionPathTemplateData(room, action);

  const data = {
    place: regionLabel,
    detail: "",

    player: target?.name || action.targetPlayerName || "alguém",
    targetPlayer: target?.name || action.targetPlayerName || "alguém",
    "target player": target?.name || action.targetPlayerName || "alguém",

    actor: actor?.name || action.actorName || "alguém",

    crimeScene: crimeContext.crimeScene || regionLabel,
    "crime scene": crimeContext.crimeScene || regionLabel,

    adjacentCrimeSceneRoad: adjacentRoad,
    "adjacent crime scene road": adjacentRoad,

    crimeSceneRoads: crimeContext.crimeSceneRoads || adjacentRoad,
    "crime scene roads": crimeContext.crimeSceneRoads || adjacentRoad,

    impostorPath: crimeContext.impostorPath || adjacentRoad,
    "impostor path": crimeContext.impostorPath || adjacentRoad,

    impostorPathPartial: crimeContext.impostorPathPartial || adjacentRoad,
    "impostor path partial": crimeContext.impostorPathPartial || adjacentRoad,

    targetHome: target ? getPlayerHomeLabel(target) : "uma casa próxima",
    "target home": target ? getPlayerHomeLabel(target) : "uma casa próxima",

    targetRegion: regionLabel,
    "target region": regionLabel,

    poi: poi?.displayName || poi?.visibleName || action.targetPoiName || "um ponto de interesse",
    road: adjacentRoad,

    ...actionPathData,
    ...extra
  };

  return data;
}

function buildActionPathTemplateData(room, action = {}) {
  const actor = getPlayerById(room, action.actorId);

  if (!actor) {
    return getEmptyActionPathTemplateData();
  }

  const targetNode = getActionTargetNode(room, action);

  if (!targetNode) {
    return getEmptyActionPathTemplateData();
  }

  const route = buildRouteForAction({ room, actor, targetNode });
  const roadCodes = Array.isArray(route.roads) ? route.roads : [];
  const roadNames = roadCodes.map(getRoadName).filter(Boolean);

  const actionPath = formatRoadList(roadNames);
  const actionPathPartial = formatRoadList(roadNames.slice(0, 2));

  const approachRoadCode = roadCodes[roadCodes.length - 1] || "";
  const originRoadCode = roadCodes[0] || "";

  const actionApproachRoad = getRoadName(approachRoadCode) || "uma rua próxima";
  const actionOriginRoad = getRoadName(originRoadCode) || "uma rua próxima";
  const actionApproachDirection = getRoadDirectionName(approachRoadCode);

  return {
    actionPath,
    "action path": actionPath,

    actionPathPartial,
    "action path partial": actionPathPartial,

    actionApproachRoad,
    "action approach road": actionApproachRoad,

    actionApproachDirection,
    "action approach direction": actionApproachDirection,

    actionOriginRoad,
    "action origin road": actionOriginRoad
  };
}

function getEmptyActionPathTemplateData() {
  return {
    actionPath: "uma rota próxima",
    "action path": "uma rota próxima",

    actionPathPartial: "uma rua próxima",
    "action path partial": "uma rua próxima",

    actionApproachRoad: "uma rua próxima",
    "action approach road": "uma rua próxima",

    actionApproachDirection: "algum lugar próximo",
    "action approach direction": "algum lugar próximo",

    actionOriginRoad: "uma rua próxima",
    "action origin road": "uma rua próxima"
  };
}

function getActionTargetNode(room, action = {}) {
  if (action.targetPlayerId) {
    const target = getPlayerById(room, action.targetPlayerId);
    return target ? getPlayerSlot(target).homeNode : "";
  }

  const poi = getPoi(action.targetPoiCode, action.targetPoiIndex);

  if (poi) {
    return poi.anchorNode || "";
  }

  return "";
}

function getCrimeSceneContext(room, currentAction = {}) {
  const attacks = Object.values(room?.nightActions || {})
    .filter(action => {
      return action &&
        action.success &&
        action.actorId !== currentAction.actorId &&
        (action.actionId === "killPlayer" || action.actionId === "stalkPoi");
    });

  const attack = attacks[0] || null;

  if (!attack) {
    const target = getPlayerById(room, currentAction.targetPlayerId);
    const poi = getPoi(currentAction.targetPoiCode, currentAction.targetPoiIndex);
    const roadCodes = target
      ? getPlayerSlot(target).homeRoads || []
      : poi?.nearRoads || [];
    const roadNames = roadCodes.map(getRoadName).filter(Boolean);
    const road = roadNames[0] || "uma rua próxima";

    return {
      crimeScene: target ? getPlayerHomeLabel(target) : getActionRegionLabel(currentAction),
      adjacentCrimeSceneRoad: road,
      crimeSceneRoads: formatRoadList(roadNames),
      crimeSceneRoadCodes: roadCodes,
      impostorPath: road,
      impostorPathPartial: road
    };
  }

  if (attack.actionId === "stalkPoi") {
    const poi = getPoi(attack.targetPoiCode, attack.targetPoiIndex);
    const roadCodes = Array.isArray(poi?.nearRoads) ? poi.nearRoads : [];
    const roadNames = roadCodes.map(getRoadName).filter(Boolean);
    const road = roadNames[0] || "uma rua próxima";

    return {
      crimeScene: poi?.displayName || poi?.visibleName || attack.targetPoiName || "um ponto de interesse",
      adjacentCrimeSceneRoad: road,
      crimeSceneRoads: formatRoadList(roadNames),
      crimeSceneRoadCodes: roadCodes,
      impostorPath: buildActionPathTemplateData(room, attack).actionPath,
      impostorPathPartial: buildActionPathTemplateData(room, attack).actionPathPartial
    };
  }

  const target = getPlayerById(room, attack.targetPlayerId);
  const roadCodes = target ? getPlayerSlot(target).homeRoads || [] : [];
  const roadNames = roadCodes.map(getRoadName).filter(Boolean);
  const road = roadNames[0] || "uma rua próxima";
  const attackPathData = buildActionPathTemplateData(room, attack);

  return {
    crimeScene: target ? getPlayerHomeLabel(target) : "a área do crime",
    adjacentCrimeSceneRoad: road,
    crimeSceneRoads: formatRoadList(roadNames),
    crimeSceneRoadCodes: roadCodes,
    impostorPath: attackPathData.actionPath,
    impostorPathPartial: attackPathData.actionPathPartial
  };
}

function getFirstRelevantRoadName({ target, poi }) {
  if (target) {
    const roadCode = (getPlayerSlot(target).homeRoads || [])[0] || "";
    return getRoadName(roadCode) || "uma rua próxima";
  }

  if (poi) {
    const roadCode = Array.isArray(poi.nearRoads) ? poi.nearRoads[0] : "";
    return getRoadName(roadCode) || "uma rua próxima";
  }

  return "uma rua próxima";
}

function getMovementDetailsForRegion(room, regionAction, options = {}) {
  const includeActor = Boolean(options.includeActor);
  const rng = createRng(Number(regionAction?.microgameSeed || Date.now()));
  const details = [];

  const ownerStatus = getInvestigatedHomeOwnerStatus(room, regionAction, rng);

  if (ownerStatus) {
    details.push(ownerStatus);
  }

  const related = [];

  for (const action of Object.values(room?.nightActions || {})) {
    if (!action || !action.success) {
      continue;
    }

    if (!includeActor && action.actorId === regionAction.actorId) {
      continue;
    }

    if (regionAction.targetPlayerId && action.actorId === regionAction.targetPlayerId) {
      continue;
    }

    if (isActionRelatedToRegion(room, action, regionAction)) {
      related.push(action.actorName || getPlayerById(room, action.actorId)?.name || "alguém");
    }
  }

  const uniqueNames = [...new Set(related)];

  if (uniqueNames.length === 1) {
    details.push(template("detectiveRegionVisitorsSingle", {
      players: uniqueNames[0]
    }, rng));
  } else if (uniqueNames.length > 1) {
    details.push(template("detectiveRegionVisitorsMany", {
      players: uniqueNames.join(", ")
    }, rng));
  }

  return details.filter(Boolean).join(" ");
}

function getInvestigatedHomeOwnerStatus(room, regionAction, rng) {
  if (!regionAction?.targetPlayerId) {
    return "";
  }

  const target = getPlayerById(room, regionAction.targetPlayerId);

  if (!target) {
    return "";
  }

  const targetAction = room?.nightActions?.[target.id] || null;
  const isHome =
    !targetAction ||
    !targetAction.success ||
    !doesActionLeaveHomeForRegionCheck(targetAction);

  const templateKey = isHome
    ? "detectiveRegionOwnerPresent"
    : "detectiveRegionOwnerAbsent";

  return template(templateKey, {
    player: target.name,
    targetPlayer: target.name,
    "target player": target.name,
    targetHome: getPlayerHomeLabel(target),
    "target home": getPlayerHomeLabel(target),
    targetRegion: getPlayerHomeLabel(target),
    "target region": getPlayerHomeLabel(target)
  }, rng);
}

function isActionRelatedToRegion(room, action, regionAction) {
  if (regionAction.targetPoiCode) {
    return action.targetPoiCode === regionAction.targetPoiCode;
  }

  if (regionAction.targetPlayerId) {
    const target = getPlayerById(room, regionAction.targetPlayerId);
    const actor = getPlayerById(room, action.actorId);

    if (!target || !actor) {
      return false;
    }

    if (action.targetPlayerId === regionAction.targetPlayerId) {
      return true;
    }

    const targetSlot = getPlayerSlot(target);
    const targetRoads = new Set(targetSlot.homeRoads || []);
    const targetNode = getActionTargetNode(room, action);

    if (!targetNode) {
      return false;
    }

    const route = buildRouteForAction({ room, actor, targetNode });
    const routeRoads = Array.isArray(route.roads) ? route.roads : [];
    const routeNodes = Array.isArray(route.nodes) ? route.nodes : [];

    if (routeNodes.includes(targetSlot.homeNode)) {
      return true;
    }

    return routeRoads.some(road => targetRoads.has(road));
  }

  return false;
}

function doesActionLeaveHomeForRegionCheck(action) {
  const actionClass = String(action?.actionClass || "");

  if (
    actionClass === ACTION_CLASS.REST ||
    actionClass === ACTION_CLASS.STAY_HOME_AWAKE
  ) {
    return false;
  }

  if (actionClass === ACTION_CLASS.PROTECT_PLAYER) {
    return Boolean(action.targetPlayerId) && action.targetPlayerId !== action.actorId;
  }

  return actionClass === ACTION_CLASS.VISIT_POI ||
    actionClass === ACTION_CLASS.VISIT_PLAYER ||
    actionClass === ACTION_CLASS.VISIT_REGION ||
    actionClass === ACTION_CLASS.DETECT_REGION ||
    actionClass === ACTION_CLASS.JOURNALIST_REPORT ||
    actionClass === ACTION_CLASS.AMBUSH_POI;
}

function getActionRegionLabel(action = {}) {
  if (action.targetPoiName) {
    return action.targetPoiName;
  }

  const poi = getPoi(action.targetPoiCode, action.targetPoiIndex);

  if (poi) {
    return poi.displayName || poi.visibleName || "um ponto de interesse";
  }

  if (action.targetPlayerName) {
    return `a região da casa de ${action.targetPlayerName}`;
  }

  return "a região escolhida";
}

function getPlayerHomeLabel(player) {
  return `a região da casa de ${player.name}`;
}

function getRoadName(roadCode) {
  return CLUE_CONFIG.roads?.[roadCode]?.visibleName || "";
}

function getRoadDirectionName(roadCode) {
  const directions = {
    h1: "norte",
    h2: "centro superior",
    h3: "centro inferior",
    h4: "sul",
    v1: "oeste",
    v2: "centro",
    v3: "leste"
  };

  return directions[roadCode] || "algum lugar próximo";
}

function formatRoadList(roadNames) {
  const clean = (roadNames || []).filter(Boolean);

  if (clean.length <= 0) {
    return "uma rota próxima";
  }

  if (clean.length === 1) {
    return clean[0];
  }

  return clean.join(", ");
}


function createPrivateClueMap(room) {
  const result = {};

  for (const player of room?.players || []) {
    result[player.id] = [];
  }

  return result;
}

function ensurePrivateFallbacks(room, privateCluesByPlayerId) {
  for (const player of room.players || []) {
    if (!privateCluesByPlayerId[player.id]) {
      privateCluesByPlayerId[player.id] = [];
    }
  }
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  for (const value of values || []) {
    const text = String(value || "").trim();

    if (!text || seen.has(text)) {
      continue;
    }

    seen.add(text);
    result.push(text);
  }

  return result;
}

function normalizeTextKey(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?]/g, "")
    .replace(/\s+/g, " ");
}

function pick(array, rng) {
  if (!Array.isArray(array) || array.length <= 0) {
    return "";
  }

  return array[Math.floor(rng() * array.length) % array.length];
}

function shuffle(array, rng) {
  const copy = [...array];

  for (let index = copy.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(rng() * (index + 1));
    const temp = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = temp;
  }

  return copy;
}

function createRng(seed) {
  let value = Number(seed || 1) >>> 0;

  return function rng() {
    value += 0x6D2B79F5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}


function compactPrivateCluesByPlayerId(privateCluesByPlayerId) {
  const result = {};
  const maxPerNight = Number(CLUE_CONFIG.clueSelection?.maxCluesPerPlayerPerNight || 2);

  for (const [playerId, clues] of Object.entries(privateCluesByPlayerId || {})) {
    const clueObjects = (clues || [])
      .map((entry, index) => {
        if (entry && typeof entry === "object" && "text" in entry) {
          return {
            ...entry,
            _originalIndex: index,
            priority: Number(entry.priority ?? getCategoryPriority(entry.category))
          };
        }

        const text = String(entry || "").trim();
        const inferred = inferClueMetaFromText(text);

        return privateClue(playerId, text, {
          ...inferred,
          priority: inferred.priority,
          _originalIndex: index
        });
      })
      .filter(clue => String(clue.text || "").trim());

    const selected = selectReadableClues(clueObjects, {
      maxCount: maxPerNight
    });

    result[playerId] = uniqueStrings(selected.map(clue => clue.text));
  }

  return result;
}

function inferClueMetaFromText(text) {
  const normalized = normalizeTextKey(text);

  if (
    normalized.includes("voce investigou") ||
    normalized.includes("pista publicada") ||
    normalized.includes("foi publicado") ||
    normalized.includes("publicada")
  ) {
    return {
      category: CLUE_CATEGORY.SPECIAL_ACTION,
      placeKey: "",
      priority: getCategoryPriority(CLUE_CATEGORY.SPECIAL_ACTION)
    };
  }

  if (
    normalized.includes("sinais sugerem") ||
    normalized.includes("pista sugere") ||
    normalized.includes("sugerindo")
  ) {
    return {
      category: CLUE_CATEGORY.PLANTED_EVIDENCE,
      placeKey: "",
      priority: getCategoryPriority(CLUE_CATEGORY.PLANTED_EVIDENCE)
    };
  }

  if (
    normalized.includes("passou pela sua casa") ||
    normalized.includes("ataque contra voce") ||
    normalized.includes("foi impedido")
  ) {
    const category = normalized.includes("impedido")
      ? CLUE_CATEGORY.PROTECTED
      : CLUE_CATEGORY.MISSED_HOME;

    return {
      category,
      placeKey: "self-home",
      priority: getCategoryPriority(category)
    };
  }

  if (
    normalized.startsWith("voce foi") ||
    normalized.startsWith("voce ficou") ||
    normalized.startsWith("voce dormiu") ||
    normalized.startsWith("voce escolheu") ||
    normalized.startsWith("voce tentou")
  ) {
    return {
      category: CLUE_CATEGORY.OWN_ACTION,
      placeKey: "",
      priority: getCategoryPriority(CLUE_CATEGORY.OWN_ACTION)
    };
  }

  if (normalized.includes("perto da casa") || normalized.includes("regiao da casa")) {
    return {
      category: CLUE_CATEGORY.TARGET_HOME,
      placeKey: "home-area",
      priority: getCategoryPriority(CLUE_CATEGORY.TARGET_HOME)
    };
  }

  if (normalized.includes("perto de")) {
    return {
      category: CLUE_CATEGORY.ROUTE_POI,
      placeKey: "poi-area",
      priority: getCategoryPriority(CLUE_CATEGORY.ROUTE_POI)
    };
  }

  if (
    normalized.includes("rua") ||
    normalized.includes("movimento") ||
    normalized.includes("passou por")
  ) {
    return {
      category: CLUE_CATEGORY.ROUTE_ROAD,
      placeKey: "road",
      priority: getCategoryPriority(CLUE_CATEGORY.ROUTE_ROAD)
    };
  }

  return {
    category: CLUE_CATEGORY.FALLBACK,
    placeKey: "",
    priority: getCategoryPriority(CLUE_CATEGORY.FALLBACK)
  };
}


module.exports = {
  resolveNightClues,
  getMicrogameQuality,
  buildMissedHomeAttackClue,
  buildProtectedAttackClue,
  buildDetectiveClue,
  buildJournalistPublishedClue,
  buildPlantedEvidenceClues,
  buildClueTemplateData,
  compactPrivateCluesByPlayerId
};
