const CONFIG = require("../config");

function templateFromGroup(groupName, data = {}, rng = Math.random) {
  const templates = CONFIG.clues.templates[groupName] || [""];
  const template = templates[Math.floor(rng() * templates.length)] || "";
  return renderTemplate(template, data);
}

function renderTemplate(template, data = {}) {
  let text = String(template || "");

  const merged = buildAliases(data);

  for (const [key, value] of Object.entries(merged)) {
    const safeValue = String(value ?? "");
    text = text.split(`{${key}}`).join(safeValue);
  }

  return text.replace(/\s+/g, " ").trim();
}

function buildAliases(data) {
  const result = { ...data };

  for (const [key, value] of Object.entries(data)) {
    const spaced = key.replace(/[A-Z]/g, letter => ` ${letter.toLowerCase()}`);
    result[spaced] = value;
  }

  return result;
}

module.exports = {
  templateFromGroup,
  renderTemplate
};
