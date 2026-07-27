const CATEGORIES = [
  { id: "investigation", title: "Investigação", instruction: "Arraste o foco até os sinais." },
  { id: "violence", title: "Violência: alvos", instruction: "Toque nos alvos. Evite os vultos." },
  { id: "violenceStab", title: "Violência: golpe", instruction: "Arraste em golpes rápidos na direção indicada." },
  { id: "ritual", title: "Ritual: tempo", instruction: "Toque quando o marcador passar pela zona segura." },
  { id: "ritualPentagram", title: "Ritual: pentagrama", instruction: "Mantenha pressionado e trace as linhas do pentagrama." },
  { id: "manipulation", title: "Manipulação", instruction: "Pressione enquanto o texto for manter. Solte quando for esconder." },
  { id: "invasion", title: "Invasão", instruction: "Escolha roubar 1, 2 ou 3 itens. Arraste a mão, pare sobre cada item e evite fazer ruído." },
  { id: "movement", title: "Movimento", instruction: "Arraste pela rota até o destino sem tocar nos vultos." },
  { id: "watch", title: "Vigilância", instruction: "Segure a área até o fim." }
];

const DIFFICULTIES = {
  easy: {
    label: "Fácil",
    time: 1.18,
    speed: 0.84,
    tolerance: 1.24,
    targetScale: 1.14,
    hazardScale: 0.82,
    note: "Mais tempo, tolerância maior e menos punição."
  },
  normal: {
    label: "Normal",
    time: 1,
    speed: 1,
    tolerance: 1,
    targetScale: 1,
    hazardScale: 1,
    note: "Base recomendada para playtest."
  },
  hard: {
    label: "Difícil",
    time: 0.86,
    speed: 1.16,
    tolerance: 0.82,
    targetScale: 0.88,
    hazardScale: 1.18,
    note: "Menos tempo, menos tolerância e mais punição."
  }
};

const state = {
  selected: null,
  active: null,
  difficulty: "normal"
};

const el = {
  categories: document.getElementById("labCategories"),
  category: document.getElementById("labCategory"),
  title: document.getElementById("labTitle"),
  instruction: document.getElementById("labInstruction"),
  start: document.getElementById("labStartButton"),
  timer: document.getElementById("labTimer"),
  score: document.getElementById("labScore"),
  stage: document.getElementById("labStage"),
  difficulty: document.getElementById("labDifficulty"),
  difficultyNote: document.getElementById("labDifficultyNote")
};

renderCategories();
renderDifficultyNote();
el.start.addEventListener("click", startSelected);
el.difficulty?.addEventListener("change", () => {
  state.difficulty = el.difficulty.value in DIFFICULTIES ? el.difficulty.value : "normal";
  renderDifficultyNote();
  if (state.selected) selectCategory(state.selected);
});

function renderCategories() {
  el.categories.innerHTML = "";
  for (const category of CATEGORIES) {
    const button = document.createElement("button");
    button.className = "lab-category";
    button.dataset.categoryId = category.id;
    button.innerHTML = `<strong>${escapeHtml(category.title)}</strong><br><small>${escapeHtml(category.instruction)}</small>`;
    button.addEventListener("click", () => selectCategory(category));
    el.categories.appendChild(button);
  }
}

function renderDifficultyNote() {
  const config = getDifficulty();
  if (el.difficultyNote) el.difficultyNote.textContent = `${config.label}: ${config.note}`;
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
    button.classList.toggle("active", button.dataset.categoryId === category.id);
  }
  const startMessage = document.createElement("div");
  startMessage.className = "mg-start";
  startMessage.innerHTML = `<strong>${escapeHtml(category.instruction)}</strong><span>Score 4 é tratado como sucesso crítico e deve sair só com execução quase perfeita.</span>`;
  el.stage.appendChild(startMessage);
}

function startSelected() {
  if (!state.selected) return;
  stopActive();
  clearStage();
  haptic(25);
  el.score.textContent = "Score: em andamento";
  const id = state.selected.id;
  if (id === "investigation") runInvestigation();
  else if (id === "violence") runViolence();
  else if (id === "violenceStab") runStab();
  else if (id === "ritual") runRitual();
  else if (id === "ritualPentagram") runPentagram();
  else if (id === "manipulation") runManipulation();
  else if (id === "invasion") runInvasion();
  else if (id === "movement") runMovement();
  else runWatch();
}

function clearStage() {
  stopActive();
  const fresh = el.stage.cloneNode(false);
  el.stage.replaceWith(fresh);
  el.stage = fresh;
}

function setupTimed(seconds, onFinish) {
  const config = getDifficulty();
  const startedAt = Date.now();
  const durationMs = Math.max(3, Number(seconds || 8) * config.time) * 1000;
  const active = { timer: null, timeout: null, cleanup: null, finished: false, startedAt, durationMs };
  state.active = active;
  active.timer = setInterval(() => {
    const remainingMs = Math.max(0, durationMs - (Date.now() - startedAt));
    el.timer.textContent = `${Math.ceil(remainingMs / 1000)}s`;
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
  const finalScore = clampScore(score);
  stopActive();
  el.timer.textContent = "--";
  el.score.textContent = `Score: ${finalScore}${extra ? ` · ${extra}` : ""}`;
  const result = document.createElement("div");
  result.className = "mg-start";
  result.innerHTML = `<strong>Resultado: ${finalScore}</strong><span>${finalScore === 4 ? "Sucesso crítico." : ""}</span>`;
  clearStage();
  el.stage.appendChild(result);
  haptic(finalScore >= 3 ? 25 : [15, 40, 15]);
}

function runInvestigation() {
  const config = getDifficulty();
  const lens = document.createElement("div");
  lens.className = "mg-lens";
  el.stage.appendChild(lens);
  const target = spawnTarget("sinal", true);
  target.classList.add("mg-signal");
  const size = 104 * config.targetScale;
  target.style.width = `${size}px`;
  target.style.height = `${size}px`;
  moveTarget(target);
  const meter = document.createElement("div");
  meter.className = "mg-proximity";
  meter.textContent = "procure o sinal";
  el.stage.appendChild(meter);
  const bar = document.createElement("div");
  bar.className = "mg-meter";
  bar.innerHTML = `<i></i>`;
  el.stage.appendChild(bar);

  let pointerX = null;
  let pointerY = null;
  let signal = 0;
  let samples = 0;
  let strongSamples = 0;

  el.stage.addEventListener("pointermove", onMove);
  el.stage.addEventListener("pointerdown", onMove);

  const sampler = setInterval(() => {
    samples++;
    const proximity = getLensProximity(pointerX, pointerY, target, el.stage);
    const readable = clamp01((proximity - 0.22 / config.tolerance) / 0.78);
    signal += readable;
    if (proximity > 0.72 / config.tolerance) strongSamples++;
    setInvestigationFeedback(proximity, lens, target, meter);
    const percent = Math.round(Math.min(100, (signal / Math.max(1, samples)) * 100));
    bar.querySelector("i").style.width = `${percent}%`;
    el.score.textContent = `leitura: ${percent}%`;
  }, 100);

  const mover = setInterval(() => {
    moveTarget(target);
    flashStage("good");
  }, Math.round(2500 / config.speed));

  const active = setupTimed(9, () => {
    clearInterval(sampler);
    clearInterval(mover);
    const average = signal / Math.max(1, samples);
    const critical = average >= 0.91 && strongSamples >= samples * 0.42;
    finish(critical ? 4 : scoreFromRatio(average));
  });
  active.cleanup = () => { clearInterval(sampler); clearInterval(mover); };

  function onMove(event) {
    const rect = el.stage.getBoundingClientRect();
    pointerX = event.clientX - rect.left;
    pointerY = event.clientY - rect.top;
    lens.style.left = `${pointerX}px`;
    lens.style.top = `${pointerY}px`;
  }
}

function runViolence() {
  const config = getDifficulty();
  let hits = 0;
  let misses = 0;
  let expired = 0;
  let current = null;
  let currentTimeout = null;
  const targetLifetime = Math.round(760 / config.speed);

  function spawn() {
    if (current) {
      current.remove();
      expired++;
    }
    if (currentTimeout) clearTimeout(currentTimeout);
    const good = Math.random() > 0.42;
    current = spawnTarget(good ? "alvo" : "vulto", good);
    const size = (good ? 58 : 84) * (good ? config.targetScale : config.hazardScale);
    current.style.width = `${size}px`;
    current.style.height = `${size}px`;
    current.addEventListener("pointerdown", event => {
      event.stopPropagation();
      if (good) {
        hits++;
        flashStage("good");
        haptic(18);
      } else {
        misses += 2;
        flashStage("bad");
        haptic([20, 35, 20]);
      }
      current.remove();
      current = null;
      el.score.textContent = `acertos: ${hits} · erros: ${misses} · perdidos: ${expired}`;
      spawn();
    });
    currentTimeout = setTimeout(() => {
      if (!current) return;
      if (good) expired++;
      current.remove();
      current = null;
      el.score.textContent = `acertos: ${hits} · erros: ${misses} · perdidos: ${expired}`;
      spawn();
    }, targetLifetime);
  }

  el.stage.addEventListener("pointerdown", onMiss);
  spawn();
  const active = setupTimed(8, () => {
    if (currentTimeout) clearTimeout(currentTimeout);
    el.stage.removeEventListener("pointerdown", onMiss);
    const opportunities = Math.max(1, hits + misses + expired);
    const accuracy = hits / opportunities;
    const critical = hits >= 6 && misses === 0 && expired <= 1 && accuracy >= 0.92;
    const score = critical ? 4 : scoreFromRatio(accuracy) - (hits < 4 ? 1 : 0);
    finish(score);
  });
  active.cleanup = () => { if (currentTimeout) clearTimeout(currentTimeout); };

  function onMiss(event) {
    if (event.target.closest(".mg-target")) return;
    misses++;
    flashStage("bad");
    haptic(12);
    el.score.textContent = `acertos: ${hits} · erros: ${misses} · perdidos: ${expired}`;
  }
}

function runStab() {
  const config = getDifficulty();
  const zone = document.createElement("div");
  zone.className = "mg-stab-zone";
  zone.innerHTML = `<span>golpe</span>`;
  el.stage.appendChild(zone);
  let startX = null;
  let startY = null;
  let strokes = 0;
  let weak = 0;
  let misses = 0;
  const needed = state.difficulty === "easy" ? 5 : state.difficulty === "hard" ? 7 : 6;
  const minDistance = 78 / config.tolerance;
  el.stage.addEventListener("pointerdown", onDown);
  el.stage.addEventListener("pointerup", onUp);
  el.stage.addEventListener("pointercancel", reset);
  setupTimed(8, () => {
    const ratio = (strokes - weak * 0.35 - misses * 0.85) / needed;
    const critical = strokes >= needed && weak === 0 && misses === 0;
    finish(critical ? 4 : scoreFromRatio(ratio));
  });
  function onDown(event) {
    startX = event.clientX;
    startY = event.clientY;
    zone.classList.add("armed");
  }
  function onUp(event) {
    if (startX == null || startY == null) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const distance = Math.hypot(dx, dy);
    const vertical = Math.abs(dy) > Math.abs(dx) * 1.35;
    const downward = dy > 0;
    if (distance > minDistance && vertical && downward) {
      strokes++;
      flashStage("good");
      haptic(18);
      zone.classList.add("hit");
      setTimeout(() => zone.classList.remove("hit"), 120);
    } else if (distance > 34) {
      weak++;
      flashStage("bad");
      haptic(10);
    } else {
      misses++;
      flashStage("bad");
      haptic([12, 30, 12]);
    }
    el.score.textContent = `golpes: ${strokes}/${needed} · falhas: ${misses + weak}`;
    reset();
  }
  function reset() {
    startX = null;
    startY = null;
    zone.classList.remove("armed");
  }
}

function runRitual() {
  const config = getDifficulty();
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
  const tolerance = 8 * config.tolerance;
  safe.style.left = `${safeLeft}%`;
  const interval = setInterval(() => {
    t += 0.024 * direction * config.speed;
    if (t >= 1 || t <= 0) direction *= -1;
    cursor.style.left = `${Math.max(0, Math.min(96, t * 96))}%`;
  }, 16);
  el.stage.addEventListener("pointerdown", () => {
    taps++;
    const pos = t * 100;
    if (Math.abs(pos - safeLeft) <= tolerance) {
      hits++;
      flashStage("good");
      haptic(18);
    } else {
      flashStage("bad");
      haptic(10);
    }
    el.score.textContent = `acertos: ${hits}/${taps}`;
  });
  const active = setupTimed(9, () => {
    clearInterval(interval);
    const ratio = hits / Math.max(1, taps);
    const critical = taps >= 5 && hits === taps;
    finish(critical ? 4 : scoreFromRatio(ratio) + (taps >= 4 ? 0 : -1));
  });
  active.cleanup = () => clearInterval(interval);
}

function runPentagram() {
  const board = createPentagramBoard(el.stage);
  const config = getDifficulty();
  const points = pentagramPoints();
  const guide = board.querySelector(".mg-pentagram-guide");
  const drawn = board.querySelector(".mg-pentagram-drawn");
  const cursor = document.createElement("div");
  cursor.className = "mg-draw-cursor";
  board.appendChild(cursor);

  let drawing = false;
  let segment = 0;
  let segmentProgress = 0;
  let goodSamples = 0;
  let badSamples = 0;
  let totalSamples = 0;
  let lastBadAt = 0;
  let drawnPoints = [];
  const tolerance = 7.2 * config.tolerance;

  board.addEventListener("pointerdown", event => {
    drawing = true;
    board.setPointerCapture?.(event.pointerId);
    handleDraw(event);
  });
  board.addEventListener("pointermove", event => {
    if (drawing) handleDraw(event);
  });
  board.addEventListener("pointerup", () => { drawing = false; });
  board.addEventListener("pointercancel", () => { drawing = false; });

  setupTimed(12, () => finishPentagram());

  function handleDraw(event) {
    if (segment >= points.length - 1) return;
    const p = eventPointPercent(event, board);
    cursor.style.left = `${p.x}%`;
    cursor.style.top = `${p.y}%`;
    totalSamples++;
    const a = points[segment];
    const b = points[segment + 1];
    const projected = projectPointOnSegment(p, a, b);
    const closeEnough = projected.distance <= tolerance;
    const movingForward = projected.t >= Math.max(0, segmentProgress - 0.08);

    if (closeEnough && movingForward) {
      goodSamples++;
      segmentProgress = Math.max(segmentProgress, projected.t);
      drawnPoints.push(projected.point);
      updatePolyline(drawn, drawnPoints);
      board.classList.add("drawing-good");
      board.classList.remove("drawing-bad");
      if (segmentProgress >= 0.96) {
        segment++;
        segmentProgress = 0;
        flashStage("good");
        haptic(16);
      }
    } else {
      const now = Date.now();
      if (now - lastBadAt > 160) {
        badSamples++;
        lastBadAt = now;
        flashStage("bad");
        haptic(8);
      }
      board.classList.add("drawing-bad");
      board.classList.remove("drawing-good");
    }
    const progress = ((segment + segmentProgress) / 5) * 100;
    guide.style.opacity = segment >= 5 ? "0.15" : "0.55";
    el.score.textContent = `traço: ${Math.round(progress)}% · desvios: ${badSamples}`;
    if (segment >= points.length - 1) finishPentagram();
  }

  function finishPentagram() {
    const progressRatio = clamp01((segment + segmentProgress) / 5);
    const accuracyRatio = goodSamples / Math.max(1, totalSamples);
    const ratio = progressRatio * 0.68 + accuracyRatio * 0.32;
    const critical = progressRatio >= 0.99 && accuracyRatio >= 0.92 && badSamples <= 1;
    finish(critical ? 4 : scoreFromRatio(ratio) - Math.floor(badSamples / 8));
  }
}

function runManipulation() {
  const status = document.createElement("div");
  status.className = "mg-instruction mg-manipulation hold";
  status.textContent = "Manter";
  el.stage.appendChild(status);
  let holding = false;
  let desiredHold = true;
  let correct = 0;
  let samples = 0;
  const intervalMs = Math.round(1050 / getDifficulty().speed);
  el.stage.addEventListener("pointerdown", () => { holding = true; status.classList.add("pressing"); });
  el.stage.addEventListener("pointerup", () => { holding = false; status.classList.remove("pressing"); });
  el.stage.addEventListener("pointerleave", () => { holding = false; status.classList.remove("pressing"); });
  const switcher = setInterval(() => {
    desiredHold = Math.random() > 0.45;
    status.textContent = desiredHold ? "Manter" : "Esconder";
    status.classList.toggle("danger", !desiredHold);
    status.classList.toggle("hold", desiredHold);
  }, intervalMs);
  const sampler = setInterval(() => {
    samples++;
    if (holding === desiredHold) {
      correct++;
      status.classList.add("correct");
      status.classList.remove("wrong");
    } else {
      status.classList.add("wrong");
      status.classList.remove("correct");
    }
    el.score.textContent = `controle: ${Math.round((correct / Math.max(1, samples)) * 100)}%`;
  }, 120);
  const active = setupTimed(8, () => {
    clearInterval(switcher);
    clearInterval(sampler);
    const ratio = correct / Math.max(1, samples);
    const critical = ratio >= 0.95;
    finish(critical ? 4 : scoreFromRatio(ratio));
  });
  active.cleanup = () => { clearInterval(switcher); clearInterval(sampler); };
}

function runInvasion() {
  const chooser = document.createElement("div");
  chooser.className = "mg-choice";
  chooser.innerHTML = `<strong>Escolha quantos itens roubar.</strong><span>Roubar mais itens deixa o espaço menor, aumenta o tempo de coleta e espalha mais ruído.</span>`;
  el.stage.appendChild(chooser);
  for (const amount of [1, 2, 3]) {
    const button = document.createElement("button");
    button.className = "mg-choice-button";
    button.textContent = `${amount} ${amount === 1 ? "item" : "itens"}`;
    button.addEventListener("click", () => startTheft(amount));
    chooser.appendChild(button);
  }
}

function startTheft(theftValue) {
  clearStage();
  const config = getDifficulty();
  const board = document.createElement("div");
  board.className = `mg-theft-board theft-${theftValue}`;
  const hand = document.createElement("div");
  hand.className = "mg-theft-hand";
  hand.textContent = "mão";
  board.appendChild(hand);
  const bag = document.createElement("div");
  bag.className = "mg-bag";
  bag.textContent = `0/${theftValue}`;
  board.appendChild(bag);
  el.stage.appendChild(board);

  const itemRadius = (theftValue === 1 ? 9 : theftValue === 2 ? 7.5 : 6.2) * config.tolerance;
  const holdNeeded = (theftValue === 1 ? 260 : theftValue === 2 ? 420 : 560) / config.tolerance;
  const timeLimit = Math.max(4.2, (9.2 - theftValue * 1.15) * config.time);
  const noiseCount = theftValue + (state.difficulty === "hard" ? 3 : state.difficulty === "easy" ? 1 : 2);
  const items = makeTheftItems(theftValue);
  const noises = makeNoiseZones(noiseCount, theftValue);
  const progressByItem = new Array(items.length).fill(0);
  let collected = 0;
  let alarm = 0;
  let moving = false;
  let lastNoiseAt = 0;

  for (const point of noises) {
    const zone = document.createElement("div");
    zone.className = "mg-noise-zone";
    zone.style.left = `${point.x}%`;
    zone.style.top = `${point.y}%`;
    zone.style.width = `${point.size * config.hazardScale}%`;
    zone.style.height = `${point.size * config.hazardScale}%`;
    board.appendChild(zone);
  }
  items.forEach((point, index) => {
    const item = document.createElement("div");
    item.className = "mg-theft-item";
    item.textContent = String(index + 1);
    item.style.left = `${point.x}%`;
    item.style.top = `${point.y}%`;
    board.appendChild(item);
    point.el = item;
  });

  board.addEventListener("pointerdown", event => { moving = true; board.setPointerCapture?.(event.pointerId); move(event); });
  board.addEventListener("pointermove", event => { if (moving) move(event); });
  board.addEventListener("pointerup", () => { moving = false; });
  board.addEventListener("pointercancel", () => { moving = false; });

  const sampler = setInterval(() => {
    if (!moving) return;
    const p = getHandPosition(hand, board);
    items.forEach((item, index) => {
      if (item.done) return;
      const distance = Math.hypot(p.x - item.x, p.y - item.y);
      if (distance <= itemRadius) {
        progressByItem[index] += 120;
        item.el.style.setProperty("--steal-progress", `${Math.min(100, (progressByItem[index] / holdNeeded) * 100)}%`);
        if (progressByItem[index] >= holdNeeded) {
          item.done = true;
          item.el.classList.add("done");
          collected++;
          bag.textContent = `${collected}/${theftValue}`;
          flashStage("good");
          haptic(18);
        }
      } else {
        progressByItem[index] = Math.max(0, progressByItem[index] - 50);
        item.el.style.setProperty("--steal-progress", `${Math.min(100, (progressByItem[index] / holdNeeded) * 100)}%`);
      }
    });
    for (const noise of noises) {
      const distance = Math.hypot(p.x - noise.x, p.y - noise.y);
      if (distance <= noise.size * config.hazardScale * 0.48 && Date.now() - lastNoiseAt > 420) {
        alarm++;
        lastNoiseAt = Date.now();
        flashStage("bad");
        haptic([18, 30, 18]);
      }
    }
    el.score.textContent = `itens: ${collected}/${theftValue} · ruído: ${alarm}`;
    if (collected >= theftValue) finishTheft(false);
  }, 120);

  const active = setupTimed(timeLimit, () => finishTheft(true));
  active.cleanup = () => clearInterval(sampler);

  function move(event) {
    const rect = board.getBoundingClientRect();
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 4, 96);
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 8, 92);
    hand.style.left = `${x}%`;
    hand.style.top = `${y}%`;
  }

  function finishTheft(timeout) {
    const complete = collected >= theftValue;
    const stealth = clamp01(1 - alarm / Math.max(1, theftValue + 1));
    const completion = collected / theftValue;
    const ratio = completion * 0.68 + stealth * 0.32;
    const critical = complete && alarm === 0 && !timeout;
    finish(critical ? 4 : scoreFromRatio(ratio) - (complete ? 0 : 1), `roubo: ${complete ? theftValue : collected}`);
  }
}

function runMovement() {
  const config = getDifficulty();
  const route = document.createElement("div");
  route.className = "mg-route";
  const runner = document.createElement("div");
  runner.className = "mg-runner";
  runner.textContent = "•";
  route.appendChild(runner);
  el.stage.appendChild(route);
  const checkpoints = [{x:14,y:72},{x:34,y:36},{x:58,y:58},{x:82,y:24}];
  const shadows = [{x:45,y:48},{x:70,y:42}];
  let current = 0;
  let noise = 0;
  let moving = false;
  for (const point of checkpoints) addMapPoint(route, "mg-checkpoint", point);
  for (const point of shadows) addMapPoint(route, "mg-shadow", point);
  route.addEventListener("pointerdown", event => { moving = true; move(event); });
  route.addEventListener("pointermove", event => { if (moving) move(event); });
  route.addEventListener("pointerup", () => { moving = false; });
  route.addEventListener("pointercancel", () => { moving = false; });
  setupTimed(8, () => finish(scoreFromRatio(current / checkpoints.length) - Math.floor(noise / 2)));
  function move(event) {
    const rect = route.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    runner.style.left = `${x}%`;
    runner.style.top = `${y}%`;
    const target = checkpoints[current];
    if (target && Math.hypot(x - target.x, y - target.y) <= 10 * config.tolerance) {
      current++;
      flashStage("good");
      haptic(14);
    }
    for (const shadow of shadows) {
      if (Math.hypot(x - shadow.x, y - shadow.y) <= 8 * config.hazardScale) {
        noise++;
        flashStage("bad");
        haptic(8);
      }
    }
    el.score.textContent = `rota: ${current}/${checkpoints.length} · ruído: ${noise}`;
    if (current >= checkpoints.length) {
      const critical = noise === 0;
      finish(critical ? 4 : 3 - Math.floor(noise / 2));
    }
  }
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
  const tolerance = 18 * getDifficulty().tolerance;
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
    if (distance > tolerance) {
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
    const ratio = stable / Math.max(1, samples);
    finish(ratio >= 0.96 ? 4 : scoreFromRatio(ratio));
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

function setInvestigationFeedback(proximity, lens, target, meter) {
  if (proximity > 0.72 / getDifficulty().tolerance) {
    lens.classList.add("active");
    lens.classList.remove("near");
    target.classList.add("active");
    target.classList.remove("near");
    meter.classList.add("good");
    meter.classList.remove("near");
    meter.textContent = "sinal forte";
    haptic(6);
  } else if (proximity > 0.40 / getDifficulty().tolerance) {
    lens.classList.add("near");
    lens.classList.remove("active");
    target.classList.add("near");
    target.classList.remove("active");
    meter.classList.add("near");
    meter.classList.remove("good");
    meter.textContent = "sinal fraco";
  } else {
    lens.classList.remove("active", "near");
    target.classList.remove("active", "near");
    meter.classList.remove("good", "near");
    meter.textContent = "procure o sinal";
  }
}

function createPentagramBoard(container) {
  const board = document.createElement("div");
  board.className = "mg-pentagram-board";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.classList.add("mg-pentagram-svg");
  const guide = document.createElementNS("http://www.w3.org/2000/svg", "path");
  guide.setAttribute("d", "M50 8 L74 82 L12 36 L88 36 L26 82 L50 8");
  guide.classList.add("mg-pentagram-guide");
  const drawn = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  drawn.classList.add("mg-pentagram-drawn");
  svg.appendChild(guide);
  svg.appendChild(drawn);
  board.appendChild(svg);
  for (const point of pentagramPoints().slice(0, -1)) {
    const marker = document.createElement("div");
    marker.className = "mg-pentagram-point subtle";
    marker.style.left = `${point.x}%`;
    marker.style.top = `${point.y}%`;
    board.appendChild(marker);
  }
  container.appendChild(board);
  return board;
}

function pentagramPoints() {
  return [{x:50,y:8},{x:74,y:82},{x:12,y:36},{x:88,y:36},{x:26,y:82},{x:50,y:8}];
}

function updatePolyline(polyline, points) {
  polyline.setAttribute("points", points.map(point => `${point.x},${point.y}`).join(" "));
}

function eventPointPercent(event, element) {
  const rect = element.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * 100,
    y: ((event.clientY - rect.top) / rect.height) * 100
  };
}

function projectPointOnSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const ab2 = abx * abx + aby * aby;
  const t = clamp((apx * abx + apy * aby) / Math.max(0.001, ab2), 0, 1);
  const projected = { x: a.x + abx * t, y: a.y + aby * t };
  return { t, point: projected, distance: Math.hypot(point.x - projected.x, point.y - projected.y) };
}

function makeTheftItems(count) {
  const presets = {
    1: [{ x: 52, y: 48 }],
    2: [{ x: 38, y: 38 }, { x: 66, y: 62 }],
    3: [{ x: 30, y: 34 }, { x: 56, y: 48 }, { x: 74, y: 70 }]
  };
  return presets[count] || presets[1];
}

function makeNoiseZones(count, theftValue) {
  const base = [
    { x: 28, y: 62, size: 16 },
    { x: 62, y: 30, size: 15 },
    { x: 78, y: 46, size: 13 },
    { x: 44, y: 75, size: 14 },
    { x: 50, y: 20, size: 11 },
    { x: 18, y: 42, size: 12 }
  ];
  return base.slice(0, count).map(item => ({ ...item, size: item.size + theftValue * 1.4 }));
}

function getHandPosition(hand, board) {
  const handRect = hand.getBoundingClientRect();
  const boardRect = board.getBoundingClientRect();
  return {
    x: ((handRect.left + handRect.width / 2 - boardRect.left) / boardRect.width) * 100,
    y: ((handRect.top + handRect.height / 2 - boardRect.top) / boardRect.height) * 100
  };
}

function addMapPoint(container, className, point) {
  const mark = document.createElement("div");
  mark.className = className;
  mark.style.left = `${point.x}%`;
  mark.style.top = `${point.y}%`;
  container.appendChild(mark);
  return mark;
}

function getLensProximity(x, y, target, container) {
  if (x == null || y == null) return 0;
  const targetRect = target.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const cx = targetRect.left - containerRect.left + targetRect.width / 2;
  const cy = targetRect.top - containerRect.top + targetRect.height / 2;
  const radius = Math.max(targetRect.width, targetRect.height) * 0.92;
  const distance = Math.hypot(x - cx, y - cy);
  return Math.max(0, 1 - distance / radius);
}

function scoreFromRatio(ratio) {
  const value = Number(ratio) || 0;
  if (value >= 0.94) return 4;
  if (value >= 0.70) return 3;
  if (value >= 0.42) return 2;
  if (value >= 0.18) return 1;
  return 0;
}

function clampScore(score) {
  return Math.max(0, Math.min(4, Math.round(Number(score || 0))));
}

function clamp01(value) {
  return clamp(value, 0, 1);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function getDifficulty() {
  return DIFFICULTIES[state.difficulty] || DIFFICULTIES.normal;
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
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
