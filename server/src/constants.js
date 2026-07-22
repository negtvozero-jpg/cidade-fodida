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

const ROLE = ALIGNMENT;

const WINNER = {
  NONE: 0,
  INNOCENTS: 1,
  IMPOSTORS: 2,
  NEUTRAL: 3
};

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
  DETECT_REGION: "detectRegion",
  MEDIUM_SENSE_REGION: "mediumSenseRegion",
  PROTECT_PLAYER: "protectPlayer",
  JOURNALIST_REPORT: "journalistReport",
  KILL_PLAYER: "killPlayer",
  VIGILANTE_KILL: "vigilanteKill",
  POSSESSED_KILL: "possessedKill",
  POSSESSED_CONDEMN: "possessedCondemn",
  POSSESSED_SYNERGY: "possessedSynergy",
  LITHOMANCER_GUESS: "lithomancerGuess",
  BOUNTY_KILL: "bountyKill",
  AMBUSH_POI: "ambushPoi",
  PLANT_EVIDENCE: "plantEvidence",
  METAMORPH_DISGUISE: "metamorphDisguise",
  ILLUSIONIST_PLANT_CLUE: "illusionistPlantClue",
  OCCULTIST_CURSE: "occultistCurse",
  HYPNOTIST_SLEEP: "hypnotistSleep",
  THIEF_ROB: "thiefRob",
  CULTIST_RITUAL_STEP: "cultistRitualStep",
  SABOTAGE: "sabotage",
  OBSESSOR_MARK: "obsessorMark",
  NONE: "none"
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
  INVESTIGATION: "investigation",
  VIOLENCE: "violence",
  RITUAL: "ritual",
  MANIPULATION: "manipulation",
  INVASION: "invasion",
  WATCH: "watch",
  RECOVERY: "recovery"
};

const MICROGAME_ID = {
  NONE: "none",
  GAME_1: "game1",
  GAME_2: "game2",
  GAME_3: "game3"
};

const MICROGAME_SCORE = {
  CRITICAL_FAIL: 0,
  SUCCESS: 1,
  MEDIUM: 2,
  GOOD: 3,
  CRITICAL_SUCCESS: 4
};

const ROLE_KEY = {
  RESIDENT: "resident",
  DETECTIVE: "detective",
  MEDIUM: "medium",
  UNICORN: "unicorn",
  JOURNALIST: "journalist",
  VIGILANTE: "vigilante",

  KILLER: "killer",
  STALKER: "stalker",
  OBSESSOR: "obsessor",
  METAMORPH: "metamorph",
  ILLUSIONIST: "illusionist",
  OCCULTIST: "occultist",
  HYPNOTIST: "hypnotist",
  LITHOMANCER: "lithomancer",

  JOKER: "joker",
  INSTIGATOR: "instigator",
  LAWYER: "lawyer",
  POSSESSED: "possessed",
  CONDEMNED: "condemned",
  BOUNTY_HUNTER: "bountyHunter",
  THIEF: "thief",
  CULTIST: "cultist"
};

const EFFECT_KEY = {
  PARANOIA: "paranoia",
  HAUNTED: "haunted"
};

const SABOTAGE_KEY = {
  BLACKOUT: "blackout",
  MICROGAME_DIFFICULTY: "microgameDifficultyUp",
  CURSE: "curse"
};

module.exports = {
  PHASE,
  ALIGNMENT,
  ROLE,
  WINNER,
  VOTE_TYPE,
  TARGET_TYPE,
  ACTION_COMMAND,
  ACTION_CLASS,
  ACTION_INTENT,
  MICROGAME_CATEGORY,
  MICROGAME_ID,
  MICROGAME_SCORE,
  ROLE_KEY,
  EFFECT_KEY,
  SABOTAGE_KEY
};
