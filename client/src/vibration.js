const STARTING_VIBRATION = {
  EDIT_FIELD: [70],
  ROOM_ACTION: [110]
};

const GLOBAL_VIBRATION = {
  DAY_START: [120, 60, 120],
  NIGHT_START: [220],
  DAY_RESULT: [150],
  NIGHT_RESULT: [120, 60, 120],
  PLAYER_DEATH: [500, 120, 180],
  GAME_OVER: [300, 80, 300]
};

export function vibrateStarting(patternName) {
  vibrate(
    STARTING_VIBRATION[patternName],
    `[VIBRATION STARTING] ${patternName}`
  );
}

export function vibrateGlobal(patternName) {
  vibrate(
    GLOBAL_VIBRATION[patternName],
    `[VIBRATION GLOBAL] ${patternName}`
  );
}

function vibrate(pattern, label) {
  if (!pattern) return;

  if (!("vibrate" in navigator)) {
    console.log("[VIBRATION] não suportado neste navegador.");
    return;
  }

  navigator.vibrate(pattern);
  console.log(label, pattern);
}