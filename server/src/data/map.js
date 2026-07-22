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
      visibleName: "barzinho",
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

const ROAD_NAMES = {
  h1: "rua norte",
  h2: "rua central superior",
  h3: "rua central inferior",
  h4: "rua sul",
  v1: "rua oeste",
  v2: "rua central",
  v3: "rua leste"
};

const ROAD_DIRECTIONS = {
  h1: "norte",
  h2: "centro superior",
  h3: "centro inferior",
  h4: "sul",
  v1: "oeste",
  v2: "centro",
  v3: "leste"
};

const PLAYER_SLOTS = {
  p1: { houseSlot: 1, homeNode: "h1v1", homeRoads: ["h1", "v1"], zoneName: "região noroeste" },
  p2: { houseSlot: 2, homeNode: "h1v2", homeRoads: ["h1", "v2"], zoneName: "região norte" },
  p3: { houseSlot: 3, homeNode: "h1v3", homeRoads: ["h1", "v3"], zoneName: "região nordeste" },
  p4: { houseSlot: 4, homeNode: "h2v3", homeRoads: ["h2", "v3"], zoneName: "região leste" },
  p5: { houseSlot: 5, homeNode: "h2v1", homeRoads: ["h2", "v1"], zoneName: "região oeste" },
  p6: { houseSlot: 6, homeNode: "h2v2", homeRoads: ["h2", "v2"], zoneName: "região central" },
  p7: { houseSlot: 7, homeNode: "h2v3", homeRoads: ["h2", "v3"], zoneName: "região leste" },
  p8: { houseSlot: 8, homeNode: "h3v3", homeRoads: ["h3", "v3"], zoneName: "região sudeste" },
  p9: { houseSlot: 9, homeNode: "h3v1", homeRoads: ["h3", "v1"], zoneName: "região sudoeste" },
  p10: { houseSlot: 10, homeNode: "h3v2", homeRoads: ["h3", "v2"], zoneName: "região sul central" },
  p11: { houseSlot: 11, homeNode: "h3v3", homeRoads: ["h3", "v3"], zoneName: "região sudeste" },
  p12: { houseSlot: 12, homeNode: "h4v3", homeRoads: ["h4", "v3"], zoneName: "região sul leste" },
  p13: { houseSlot: 13, homeNode: "h4v1", homeRoads: ["h4", "v1"], zoneName: "região sul oeste" },
  p14: { houseSlot: 14, homeNode: "h4v2", homeRoads: ["h4", "v2"], zoneName: "região sul" },
  p15: { houseSlot: 15, homeNode: "h4v3", homeRoads: ["h4", "v3"], zoneName: "região sul leste" },
  p16: { houseSlot: 16, homeNode: "h4v3", homeRoads: ["h4", "v3"], zoneName: "região sul leste" }
};

function edge(from, to, road) {
  return { from, to, road };
}

const GRAPH_EDGES = [
  edge("h1v1", "h1v2", "h1"),
  edge("h1v2", "h1v3", "h1"),
  edge("h2v1", "h2v2", "h2"),
  edge("h2v2", "h2v3", "h2"),
  edge("h3v1", "h3v2", "h3"),
  edge("h3v2", "h3v3", "h3"),
  edge("h4v1", "h4v2", "h4"),
  edge("h4v2", "h4v3", "h4"),
  edge("h1v1", "h2v1", "v1"),
  edge("h2v1", "h3v1", "v1"),
  edge("h3v1", "h4v1", "v1"),
  edge("h1v2", "h2v2", "v2"),
  edge("h2v2", "h3v2", "v2"),
  edge("h3v2", "h4v2", "v2"),
  edge("h1v3", "h2v3", "v3"),
  edge("h2v3", "h3v3", "v3"),
  edge("h3v3", "h4v3", "v3")
];

function getPoiByCode(code) {
  return POI_CONFIG.definitions[String(code || "")] || null;
}

function getPoiByIndex(index) {
  return Object.values(POI_CONFIG.definitions).find(poi => Number(poi.index) === Number(index)) || null;
}

function getPlayerSlot(playerOrIndex) {
  const index = typeof playerOrIndex === "object"
    ? Number(playerOrIndex.index || 1)
    : Number(playerOrIndex || 1);

  return PLAYER_SLOTS[`p${index}`] || PLAYER_SLOTS.p1;
}

module.exports = {
  POI_CONFIG,
  ROAD_NAMES,
  ROAD_DIRECTIONS,
  PLAYER_SLOTS,
  GRAPH_EDGES,
  getPoiByCode,
  getPoiByIndex,
  getPlayerSlot
};
