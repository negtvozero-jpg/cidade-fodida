const CONFIG = require("./config");

function debugLog(section, message, data = null) {
  const debug = CONFIG.debug || {};
  const key = String(section || "").toLowerCase();

  if (!debug.enabled || debug[key] === false) {
    return;
  }

  const prefix = `[${key.toUpperCase()}]`;

  if (data && Object.keys(data).length > 0) {
    console.log(prefix, message, data);
    return;
  }

  console.log(prefix, message);
}

module.exports = {
  debugLog
};
