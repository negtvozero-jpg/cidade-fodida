const { GRAPH_EDGES, ROAD_NAMES, ROAD_DIRECTIONS, getPoiByCode, getPoiByIndex, getPlayerSlot } = require("../data/map");

function getPlayerById(room, playerId) {
  return room.players.find(player => player.id === playerId) || null;
}

function getActionTargetPlayer(room, action) {
  return getPlayerById(room, action.targetPlayerId);
}

function getActionTargetPoi(action) {
  return getPoiByCode(action.targetPoiCode) || getPoiByIndex(action.targetPoiIndex);
}

function getPlayerHomeLabel(player, recipient = null) {
  if (recipient && player?.id && recipient.id === player.id) {
    return "sua casa";
  }

  return `casa de ${player?.name || "alguém"}`;
}

function getActionRegionLabel(room, action, options = {}) {
  const targetPlayer = getActionTargetPlayer(room, action);
  if (targetPlayer) return getPlayerHomeLabel(targetPlayer, options.recipient);

  const poi = getActionTargetPoi(action);
  if (poi) return poi.displayName || poi.visibleName || poi.code;

  return "uma região do bairro";
}

function getActionTargetNode(room, action) {
  const targetPlayer = getActionTargetPlayer(room, action);
  if (targetPlayer) return getPlayerSlot(targetPlayer).homeNode;

  const poi = getActionTargetPoi(action);
  if (poi) return poi.anchorNode;

  return "";
}

function getActionPathData(room, action) {
  const actor = getPlayerById(room, action.actorId);
  const startNode = actor ? getPlayerSlot(actor).homeNode : "";
  const targetNode = getActionTargetNode(room, action);

  if (!startNode || !targetNode || startNode === targetNode) {
    return emptyPathData();
  }

  const nodes = findNodePath(startNode, targetNode);
  const roadCodes = nodesToRoads(nodes);
  const roadNames = roadCodes.map(code => ROAD_NAMES[code]).filter(Boolean);

  const actionPath = formatList(roadNames, "uma rota próxima");
  const actionPathPartial = formatList(roadNames.slice(0, 2), "uma rua próxima");
  const approachRoadCode = roadCodes[roadCodes.length - 1] || "";
  const originRoadCode = roadCodes[0] || "";

  return {
    actionPath,
    actionPathPartial,
    actionApproachRoad: ROAD_NAMES[approachRoadCode] || "uma rua próxima",
    actionApproachDirection: ROAD_DIRECTIONS[approachRoadCode] || "entorno",
    actionOriginRoad: ROAD_NAMES[originRoadCode] || "uma rua próxima",
    roadCodes,
    roadNames
  };
}

function buildTemplateData(room, action = {}, extra = {}) {
  const actor = getPlayerById(room, action.actorId);
  const target = getActionTargetPlayer(room, action);
  const poi = getActionTargetPoi(action);
  const regionLabel = getActionRegionLabel(room, action);
  const path = getActionPathData(room, action);

  const data = {
    place: regionLabel,
    targetRegion: regionLabel,
    targetPlayer: target?.name || action.targetPlayerName || "alguém",
    player: target?.name || action.targetPlayerName || "alguém",
    actor: actor?.name || action.actorName || "alguém",
    targetRole: target?.roleName || action.targetRoleName || "um papel",
    crimeScene: regionLabel,
    adjacentCrimeSceneRoad: path.actionApproachRoad,
    actionPath: path.actionPath,
    actionPathPartial: path.actionPathPartial,
    actionApproachRoad: path.actionApproachRoad,
    actionApproachDirection: path.actionApproachDirection,
    actionOriginRoad: path.actionOriginRoad,
    poi: poi?.displayName || poi?.visibleName || action.targetPoiName || "um ponto de interesse",
    detail: "",
    players: "",
    ...extra
  };

  data["target player"] = data.targetPlayer;
  data["target role"] = data.targetRole;
  data["target region"] = data.targetRegion;
  data["crime scene"] = data.crimeScene;
  data["adjacent crime scene road"] = data.adjacentCrimeSceneRoad;
  data["action path"] = data.actionPath;
  data["action path partial"] = data.actionPathPartial;
  data["action approach road"] = data.actionApproachRoad;
  data["action approach direction"] = data.actionApproachDirection;
  data["action origin road"] = data.actionOriginRoad;

  return data;
}

function findNodePath(startNode, targetNode) {
  const graph = buildGraph();
  const queue = [[startNode]];
  const visited = new Set([startNode]);

  while (queue.length > 0) {
    const path = queue.shift();
    const node = path[path.length - 1];

    if (node === targetNode) return path;

    for (const next of graph[node] || []) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push([...path, next]);
    }
  }

  return [];
}

function buildGraph() {
  const graph = {};

  for (const edge of GRAPH_EDGES) {
    if (!graph[edge.from]) graph[edge.from] = [];
    if (!graph[edge.to]) graph[edge.to] = [];
    graph[edge.from].push(edge.to);
    graph[edge.to].push(edge.from);
  }

  return graph;
}

function nodesToRoads(nodes) {
  const roads = [];

  for (let index = 0; index < nodes.length - 1; index++) {
    const road = findRoadBetween(nodes[index], nodes[index + 1]);
    if (road && roads[roads.length - 1] !== road) roads.push(road);
  }

  return roads;
}

function findRoadBetween(from, to) {
  const edge = GRAPH_EDGES.find(item => {
    return (item.from === from && item.to === to) || (item.from === to && item.to === from);
  });

  return edge?.road || "";
}

function emptyPathData() {
  return {
    actionPath: "uma rota próxima",
    actionPathPartial: "uma rua próxima",
    actionApproachRoad: "uma rua próxima",
    actionApproachDirection: "entorno",
    actionOriginRoad: "uma rua próxima",
    roadCodes: [],
    roadNames: []
  };
}

function formatList(items, fallback) {
  const clean = (items || []).filter(Boolean);
  if (clean.length <= 0) return fallback;
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) return `${clean[0]} e ${clean[1]}`;
  return `${clean.slice(0, -1).join(", ")} e ${clean[clean.length - 1]}`;
}

module.exports = {
  getPlayerById,
  getActionTargetPlayer,
  getActionTargetPoi,
  getPlayerHomeLabel,
  getActionRegionLabel,
  getActionTargetNode,
  getActionPathData,
  buildTemplateData,
  findNodePath,
  nodesToRoads,
  formatList
};
