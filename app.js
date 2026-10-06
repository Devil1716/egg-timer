const STAGES = [
  { id: "barely", range: "0–2 min", label: "barely set", minutes: 2 },
  { id: "runny", range: "3–4 min", label: "runny soft", minutes: 4 },
  { id: "jammy", range: "5–6 min", label: "jammy", minutes: 6 },
  { id: "soft", range: "7–8 min", label: "soft-medium", minutes: 8 },
  { id: "medium", range: "9–10 min", label: "fully medium", minutes: 10 },
  { id: "firm", range: "11–12 min", label: "firm", minutes: 12 },
  { id: "hard", range: "13–14 min", label: "classic hard-boiled", minutes: 14 },
];

const YOLKS = {
  barely: { stops: ["#ffd166", "#ff9f1c", "#f77f00", "#d85700"], gloss: 0.8, core: "#ff6b00" },
  runny: { stops: ["#ffe08a", "#ffb703", "#fb8500", "#e36414"], gloss: 0.62, core: "#f48c06" },
  jammy: { stops: ["#ffe566", "#f4c430", "#ee9b00", "#d97706"], gloss: 0.4, core: null },
  soft: { stops: ["#ffe9a3", "#f6c453", "#e9a825", "#d4920a"], gloss: 0.26, core: null },
  medium: { stops: ["#fff1b8", "#f7d24c", "#efc34a", "#e2b23a"], gloss: 0.18, core: null },
  firm: { stops: ["#fff6d2", "#f3d78a", "#e8c56a", "#dbb45a"], gloss: 0.1, core: null },
  hard: { stops: ["#fff8e4", "#f3e2a4", "#e6d28a", "#d9c47a"], gloss: 0.06, core: null },
};

const IDLE_LINES = {
  barely: "Two minutes. The center stays glossy.",
  runny: "Soft and runny. Good on toast.",
  jammy: "Jammy yolk. Six minutes is the sweet spot.",
  soft: "Soft-medium. Set at the edge, tender inside.",
  medium: "Fully medium. Sliceable, still golden.",
  firm: "Firm all the way through.",
  hard: "Classic hard-boiled. Give me fourteen minutes.",
};

const chart = document.querySelector("#chart");
const hero = document.querySelector("#hero-egg");
const timeEl = document.querySelector("#time");
const ofEl = document.querySelector("#of");
const stageLabel = document.querySelector("#stage-label");
const primary = document.querySelector("#primary");
const resetBtn = document.querySelector("#reset");
const bubble = document.querySelector("#bubble");
const character = document.querySelector("#egg-character");
const progress = document.querySelector("#progress");
const live = document.querySelector("#live");

const RADIUS = 98;
const CIRC = 2 * Math.PI * RADIUS;
progress.style.strokeDasharray = `${CIRC + 1} ${CIRC}`;

let stageIndex = 2;
let totalMs = STAGES[2].minutes * 60 * 1000;
let remainingMs = totalMs;
let state = "idle";
let endAt = 0;
let raf = 0;
let doneTimer = 0;
let heroKey = "";
let audioCtx = null;
let nudgeUntil = 0;
let nudgeText = "";

function halfEgg(stage, uid) {
  const yolk = YOLKS[stage.id];
  const core = yolk.core
    ? `<circle cx="43" cy="56" r="11" fill="${yolk.core}" opacity="0.9"/>`
    : "";
  return `<svg class="half" viewBox="0 0 86 108" aria-hidden="true">
    <defs>
      <radialGradient id="w${uid}" cx="35%" cy="30%" r="80%">
        <stop offset="0%" stop-color="#ffffff"/>
        <stop offset="100%" stop-color="#f1ebe3"/>
      </radialGradient>
      <radialGradient id="y${uid}" cx="38%" cy="36%" r="68%">
        <stop offset="0%" stop-color="${yolk.stops[0]}"/>
        <stop offset="40%" stop-color="${yolk.stops[1]}"/>
        <stop offset="74%" stop-color="${yolk.stops[2]}"/>
        <stop offset="100%" stop-color="${yolk.stops[3]}"/>
      </radialGradient>
    </defs>
    <ellipse cx="43" cy="102" rx="22" ry="4" fill="rgba(90,59,46,0.08)"/>
    <path d="M43 6c23 0 35 24 35 50 0 28-16 46-35 46S8 84 8 56C8 30 20 6 43 6z" fill="url(#w${uid})" stroke="#d7c6b0" stroke-width="3"/>
    <circle cx="43" cy="56" r="23" fill="url(#y${uid})"/>
    ${core}
    <circle cx="43" cy="56" r="23" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.5"/>
    <ellipse cx="34" cy="46" rx="8" ry="4.5" fill="#fff" opacity="${yolk.gloss}"/>
  </svg>`;
}

function shellEgg() {
  return `<svg class="shell" viewBox="0 0 64 80" aria-hidden="true">
    <defs>
      <radialGradient id="shellBrown" cx="34%" cy="28%" r="78%">
        <stop offset="0%" stop-color="#e7b88a"/>
        <stop offset="48%" stop-color="#c4844e"/>
        <stop offset="100%" stop-color="#9a6238"/>
      </radialGradient>
    </defs>
    <ellipse cx="32" cy="74" rx="16" ry="3.5" fill="rgba(90,59,46,0.13)"/>
    <path d="M32 4c18 2 26 22 26 38 0 20-12 32-26 32S6 62 6 42C6 26 14 6 32 4z" fill="url(#shellBrown)"/>
    <ellipse cx="24" cy="30" rx="7" ry="11" fill="#fff" opacity="0.28" transform="rotate(-18 24 30)"/>
  </svg>`;
}

function format(ms) {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function mood() {
  if (state === "done") return "happy";
  if (state === "paused") return "sleepy";
  if (state === "running") return remainingMs <= 60000 ? "excited" : "thinking";
  const id = STAGES[stageIndex].id;
  if (id === "barely") return "surprised";
  if (id === "hard") return "wink";
  return "neutral";
}

function lineFor(currentMood, stage) {
  if (currentMood === "thinking") return "Counting from the moment they hit the water.";
  if (currentMood === "excited") return "Last minute. An ice bath stops the cooking.";
  if (currentMood === "sleepy") return "Paused. I won't lose our place.";
  if (currentMood === "happy") {
    if (stage.id === "hard" || stage.id === "firm") {
      return "Ready. A quick ice bath makes them easier to peel.";
    }
    if (stage.id === "barely" || stage.id === "runny" || stage.id === "jammy") {
      return "Ready. Serve them now, while the yolk is still soft.";
    }
    return "Ready. They're right where you wanted them.";
  }
  return IDLE_LINES[stage.id];
}

function buttonLabel() {
  if (state === "running") return "Pause";
  if (state === "paused") return "Resume";
  if (state === "done") return "Boil another";
  return "Start";
}

function announce(message) {
  live.textContent = "";
  live.textContent = message;
}

function renderChart() {
  chart.innerHTML = STAGES.map((stage, index) => `
    <li>
      <button type="button" data-index="${index}" aria-pressed="${index === stageIndex}">
        ${stage.id === "hard" ? shellEgg() : ""}
        ${halfEgg(stage, "c" + index)}
        <span><strong>${stage.range}</strong> = ${stage.label}</span>
      </button>
    </li>
  `).join("");
}

function renderHero() {
  const key = STAGES[stageIndex].id;
  if (key === heroKey) return;
  heroKey = key;
  hero.innerHTML = halfEgg(STAGES[stageIndex], "hero");
}

function paint() {
  const stage = STAGES[stageIndex];
  const currentMood = mood();
  character.dataset.mood = currentMood;
  bubble.textContent = Date.now() < nudgeUntil ? nudgeText : lineFor(currentMood, stage);
  timeEl.textContent = format(remainingMs);
  ofEl.textContent = state === "done" ? "done" : `of ${format(totalMs)}`;
  stageLabel.textContent = state === "done" ? "Ready" : stage.label;
  const fraction = totalMs === 0 ? 0 : remainingMs / totalMs;
  const drawn = state === "done" || fraction >= 0.999 ? CIRC + 1 : CIRC * fraction;
  progress.style.strokeDasharray = `${drawn} ${CIRC}`;
  progress.style.strokeDashoffset = "0";
  progress.classList.toggle("is-done", state === "done");
  primary.textContent = buttonLabel();
  primary.classList.toggle("is-done", state === "done");
  chart.classList.toggle("is-locked", state === "running" || state === "paused");
  chart.querySelectorAll("button").forEach((button, index) => {
    button.setAttribute("aria-pressed", String(index === stageIndex));
  });
  document.title = state === "running"
    ? `${format(remainingMs)} · ${stage.label}`
    : state === "done"
      ? "Eggs are ready"
      : "Egg timer";
  renderHero();
}

function keepAwake(on) {
  if (window.EggTimer && typeof EggTimer.setKeepScreenOn === "function") {
    EggTimer.setKeepScreenOn(on);
  }
}

function finish() {
  if (state === "done") return;
  state = "done";
  remainingMs = 0;
  cancelAnimationFrame(raf);
  clearTimeout(doneTimer);
  keepAwake(false);
  chime();
  announce("Eggs are ready.");
  paint();
}

function tick() {
  remainingMs = Math.max(0, endAt - Date.now());
  if (remainingMs <= 0) {
    finish();
    return;
  }
  paint();
  raf = requestAnimationFrame(tick);
}

function unlockAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") audioCtx.resume();
}

function chime() {
  if (!audioCtx) return;
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((freq, index) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const start = audioCtx.currentTime + index * 0.16;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.07, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38);
    osc.start(start);
    osc.stop(start + 0.4);
  });
}

function start() {
  if (state === "running") return;
  if (remainingMs <= 0) remainingMs = totalMs;
  state = "running";
  endAt = Date.now() + remainingMs;
  unlockAudio();
  clearTimeout(doneTimer);
  doneTimer = setTimeout(finish, remainingMs);
  cancelAnimationFrame(raf);
  announce(`Started, ${STAGES[stageIndex].label}, ${format(remainingMs)} left.`);
  keepAwake(true);
  tick();
}

function pause() {
  if (state !== "running") return;
  remainingMs = Math.max(0, endAt - Date.now());
  state = "paused";
  clearTimeout(doneTimer);
  cancelAnimationFrame(raf);
  announce("Paused.");
  keepAwake(false);
  paint();
}

function reset() {
  clearTimeout(doneTimer);
  cancelAnimationFrame(raf);
  state = "idle";
  remainingMs = totalMs;
  announce("Timer reset.");
  keepAwake(false);
  paint();
}

function setStage(index) {
  if (state === "running") {
    nudgeText = "Pause me first, then pick another yolk.";
    nudgeUntil = Date.now() + 2200;
    bubble.textContent = nudgeText;
    return;
  }
  stageIndex = index;
  totalMs = STAGES[index].minutes * 60 * 1000;
  remainingMs = totalMs;
  state = "idle";
  keepAwake(false);
  paint();
}

chart.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  setStage(Number(button.dataset.index));
});

primary.addEventListener("click", () => {
  if (state === "running") pause();
  else if (state === "done") reset();
  else start();
});

resetBtn.addEventListener("click", reset);

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space") return;
  if (event.target.closest("button")) return;
  event.preventDefault();
  if (state === "running") pause();
  else if (state !== "done") start();
});

renderChart();
paint();
