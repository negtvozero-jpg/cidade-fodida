const CATEGORIES = [
  { id: "investigation", title: "Investigação", instruction: "Arraste o foco até os sinais." },
  { id: "violence", title: "Violência", instruction: "Toque nos alvos. Evite os vultos." },
  { id: "ritual", title: "Ritual", instruction: "Toque quando o marcador passar pela zona segura." },
  { id: "manipulation", title: "Manipulação", instruction: "Segure em manter. Solte em esconder." },
  { id: "invasion", title: "Invasão", instruction: "Colete itens antes do tempo acabar." },
  { id: "watch", title: "Vigilância", instruction: "Segure a área até o fim." }
];

const state = {
  selected: null,
  active: null
};

const el = {
  categories: document.getElementById("labCategories"),
  category: document.getElementById("labCategory"),
  title: document.getElementById("labTitle"),
  instruction: document.getElementById("labInstruction"),
  start: document.getElementById("labStartButton"),
  timer: document.getElementById("labTimer"),
  score: document.getElementById("labScore"),
  stage: document.getElementById("labStage")
};

renderCategories();
el.start.addEventListener("click", startSelected);

function renderCategories() {
  el.categories.innerHTML = "";
  for (const category of CATEGORIES) {
    const button = document.createElement("button");
    button.className = "lab-category";
    button.innerHTML = `<strong>${escapeHtml(category.title)}</strong><br><small>${escapeHtml(category.instruction)}</small>`;
    button.addEventListener("click", () => selectCategory(category));
    el.categories.appendChild(button);
  }
}

function selectCategory(category) {
  state.selected = category;
  stopActive();
  clearStage();
  el.category.textContent = category.title;
  el.title.textContent = category.title;
  el.instruction.textContent = category.instruction;
  el.score.textContent = "Score: —";
  el.timer.textContent = "--";
  el.start.disabled = false;
  for (const button of el.categories.children) {
    button.classList.toggle("active", button.textContent.includes(category.title));
  }
  const startMessage = document.createElement("div");
  startMessage.className = "mg-start";
  startMessage.innerHTML = `<strong>${escapeHtml(category.instruction)}</strong>`;
  el.stage.appendChild(startMessage);
}

function startSelected() {
  if (!state.selected) return;
  stopActive();
  clearStage();
  haptic(25);
  el.score.textContent = "Score: em andamento";
  if (state.selected.id === "investigation") runInvestigation();
  else if (state.selected.id === "violence") runViolence();
  else if (state.selected.id === "ritual") runRitual();
  else if (state.selected.id === "manipulation") runManipulation();
  else if (state.selected.id === "invasion") runInvasion();
  else runWatch();
}

function clearStage() {
  const fresh = el.stage.cloneNode(false);
  el.stage.replaceWith(fresh);
  el.stage = fresh;
}

function setupTimed(seconds, onFinish) {
  const startedAt = Date.now();
  const durationMs = Math.max(3, Number(seconds || 8)) * 1000;
  const active = { timer: null, timeout: null, cleanup: null, finished: false };
  state.active = active;
  active.timer = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((durationMs - (Date.now() - startedAt)) / 1000));
    el.timer.textContent = `${remaining}s`;
  }, 100);
  active.timeout = setTimeout(() => {
    if (state.active === active && !active.finished) onFinish();
  }, durationMs);
  return active;
}

function stopActive() {
  if (state.active?.timer) clearInterval(state.active.timer);
  if (state.active?.timeout) clearTimeout(state.active.timeout);
  if (typeof state.active?.cleanup === "function") state.active.cleanup();
  state.active = null;
}

function finish(score, extra = "") {
  stopActive();
  el.timer.textContent = "--";
  el.score.textContent = `Score: ${clampScore(score)}${extra ? ` · ${extra}` : ""}`;
  const result = document.createElement("div");
  result.className = "mg-start";
  result.innerHTML = `<strong>Resultado: ${clampScore(score)}</strong>`;
  clearStage();
  el.stage.appendChild(result);
  haptic(score >= 3 ? 25 : [15, 40, 15]);
}

function runInvestigation() {
  const lens = document.createElement("div");
  lens.className = "mg-lens";
  el.stage.appendChild(lens);
  let hits = 0;
  let samples = 0;
  const target = spawnTarget("sinal", true);
  moveTarget(target);
  const mover = setInterval(() => moveTarget(target), 1500);
  const active = setupTimed(8, () => {
    clearInterval(mover);
    finish(scoreFromRatio(hits / Math.max(1, samples)));
  });
  active.cleanup = () => clearInterval(mover);
  el.stage.addEventListener("pointermove", onMove);
  el.stage.addEventListener("pointerdown", onMove);

  function onMove(event) {
    const rect = el.stage.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    lens.style.left = `${x}px`;
    lens.style.top = `${y}px`;
    samples++;
    if (pointInElement(x, y, target, el.stage)) {
      hits++;
      target.classList.add("active");
      haptic(8);
    } else {
      target.classList.remove("active");
    }
    el.score.textContent = `leitura: ${Math.round((hits / Math.max(1, samples)) * 100)}%`;
  }
}

function runViolence() {
  let hits = 0;
  let misses = 0;
  let current = null;
  function spawn() {
    if (current) current.remove();
    const good = Math.random() > 0.18;
    current = spawnTarget(good ? "alvo" : "vulto", good);
    current.addEventListener("pointerdown", event => {
      event.stopPropagation();
      if (good) {
        hits++;
        flashStage("good");
        haptic(18);
      } else {
        misses++;
        flashStage("bad");
        haptic([20, 35, 20]);
      }
      el.score.textContent = `acertos: ${hits} · erros: ${misses}`;
      spawn();
    });
  }
  function miss() {
    misses++;
    flashStage("bad");
    haptic(10);
    el.score.textContent = `acertos: ${hits} · erros: ${misses}`;
  }
  el.stage.addEventListener("pointerdown", miss);
  spawn();
  const interval = setInterval(spawn, 1350);
  const active = setupTimed(9, () => {
    clearInterval(interval);
    el.stage.removeEventListener("pointerdown", miss);
    const ratio = hits / Math.max(1, hits + misses);
    finish(clampScore(scoreFromRatio(ratio) + (hits >= 2 ? 1 : 0)));
  });
  active.cleanup = () => clearInterval(interval);
}

function runRitual() {
  const track = document.createElement("div");
  track.className = "mg-track";
  const safe = document.createElement("div");
  safe.className = "mg-safe";
  const cursor = document.createElement("div");
  cursor.className = "mg-cursor";
  track.appendChild(safe);
  track.appendChild(cursor);
  el.stage.appendChild(track);
  let t = 0;
  let direction = 1;
  let hits = 0;
  let taps = 0;
  const safeLeft = 42;
  safe.style.left = `${safeLeft}%`;
  const interval = setInterval(() => {
    t += 0.018 * direction;
    if (t >= 1 || t <= 0) direction *= -1;
    cursor.style.left = `${Math.max(0, Math.min(96, t * 96))}%`;
  }, 16);
  el.stage.addEventListener("pointerdown", () => {
    taps++;
    const pos = t * 100;
    if (Math.abs(pos - safeLeft) <= 12) {
      hits++;
      flashStage("good");
      haptic(18);
    } else {
      flashStage("bad");
      haptic(10);
    }
    el.score.textContent = `acertos: ${hits}/${taps}`;
  });
  const active = setupTimed(8, () => {
    clearInterval(interval);
    finish(clampScore(scoreFromRatio(hits / Math.max(1, taps)) + (taps >= 4 ? 1 : 0)));
  });
  active.cleanup = () => clearInterval(interval);
}

function runManipulation() {
  const status = document.createElement("div");
  status.className = "mg-instruction";
  status.textContent = "Manter";
  el.stage.appendChild(status);
  let holding = false;
  let desiredHold = true;
  let correct = 0;
  let samples = 0;
  el.stage.addEventListener("pointerdown", () => { holding = true; });
  el.stage.addEventListener("pointerup", () => { holding = false; });
  el.stage.addEventListener("pointerleave", () => { holding = false; });
  const switcher = setInterval(() => {
    desiredHold = Math.random() > 0.45;
    status.textContent = desiredHold ? "Manter" : "Esconder";
    status.classList.toggle("danger", !desiredHold);
  }, 1000);
  const sampler = setInterval(() => {
    samples++;
    if (holding === desiredHold) correct++;
    el.score.textContent = `controle: ${Math.round((correct / Math.max(1, samples)) * 100)}%`;
  }, 120);
  const active = setupTimed(8, () => {
    clearInterval(switcher);
    clearInterval(sampler);
    finish(scoreFromRatio(correct / Math.max(1, samples)));
  });
  active.cleanup = () => { clearInterval(switcher); clearInterval(sampler); };
}

function runInvasion() {
  let loot = 0;
  let alarm = 0;
  const bag = document.createElement("div");
  bag.className = "mg-bag";
  bag.textContent = "coleta: 0";
  el.stage.appendChild(bag);
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
      el.score.textContent = `coleta: ${loot} · risco: ${alarm}`;
    });
    el.stage.appendChild(item);
  }
  setupTimed(7, () => {
    const theftValue = Math.max(0, Math.min(3, Math.floor(loot / 2)));
    const score = clampScore(4 - alarm + Math.floor(loot / 3));
    finish(score, `roubo: ${theftValue}`);
  });
}

function runWatch() {
  const zone = document.createElement("div");
  zone.className = "mg-watch-zone";
  zone.textContent = "segure";
  el.stage.appendChild(zone);
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
  el.stage.addEventListener("pointermove", event => {
    if (!holding) return;
    const distance = lastX == null ? 0 : Math.hypot(event.clientX - lastX, event.clientY - lastY);
    lastX = event.clientX;
    lastY = event.clientY;
    if (distance > 22) {
      stable = Math.max(0, stable - 1);
      flashStage("bad");
    }
  });
  for (const type of ["pointerup", "pointerleave", "pointercancel"]) {
    el.stage.addEventListener(type, () => { holding = false; zone.classList.remove("holding"); });
  }
  const sampler = setInterval(() => {
    samples++;
    if (holding) stable++;
    el.score.textContent = `estabilidade: ${Math.round((stable / Math.max(1, samples)) * 100)}%`;
  }, 140);
  const active = setupTimed(8, () => {
    clearInterval(sampler);
    finish(scoreFromRatio(stable / Math.max(1, samples)));
  });
  active.cleanup = () => clearInterval(sampler);
}

function spawnTarget(text, good) {
  const target = document.createElement("button");
  target.className = `mg-target${good ? " good" : ""}`;
  target.textContent = text;
  target.style.width = "86px";
  target.style.height = "86px";
  el.stage.appendChild(target);
  moveTarget(target);
  return target;
}

function moveTarget(target) {
  target.style.left = `${8 + Math.random() * 74}%`;
  target.style.top = `${12 + Math.random() * 68}%`;
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

function scoreFromRatio(ratio) {
  if (ratio >= 0.82) return 4;
  if (ratio >= 0.58) return 3;
  if (ratio >= 0.32) return 2;
  if (ratio >= 0.12) return 1;
  return 0;
}

function clampScore(score) {
  return Math.max(0, Math.min(4, Math.round(Number(score || 0))));
}

function flashStage(type) {
  el.stage.classList.remove("flash-good", "flash-bad");
  void el.stage.offsetWidth;
  el.stage.classList.add(type === "bad" ? "flash-bad" : "flash-good");
}

function haptic(pattern = 15) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {}
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
