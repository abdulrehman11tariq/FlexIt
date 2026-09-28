const LABELS = ["Strongly Agree", "Agree", "Uncertain", "Dissatisfied", "Strongly Disagree"];

// Agreement reads green, disagreement reads red, so the slider itself shows which way you're answering.
const TONES_LIGHT = ["#178a5c", "#6b9a2f", "#b58900", "#d0651c", "#c0392b"];
const TONES_DARK = ["#3ecf8e", "#a3d05c", "#f0c14b", "#ff9a52", "#ff7b6e"];
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
const tones = () => (darkQuery.matches ? TONES_DARK : TONES_LIGHT);

const AUTO_START_DELAY_MS = 1200;
const RECENT_DONE_MS = 30000;

const $ = id => document.getElementById(id);
const slider = $("slider");
const valueEl = $("value");
const autoRun = $("autoRun");
const pillText = $("pillText");
const detail = $("detail");
const progressRow = $("progressRow");
const progress = $("progress");
const count = $("count");
const action = $("action");

const PILL_TEXT = {
  idle: "Ready",
  running: "Running",
  done: "Done",
  stopped: "Stopped",
  error: "Error"
};

let run = { state: "idle" };
let autoTimer = null;

function paintSlider() {
  const i = Number(slider.value);
  valueEl.textContent = LABELS[i];
  slider.setAttribute("aria-valuetext", LABELS[i]);
  slider.style.setProperty("--i", i);
  document.documentElement.style.setProperty("--tone", tones()[i]);
  document.querySelectorAll(".ticks i").forEach((tick, n) => {
    tick.classList.toggle("on", n <= i);
  });
}

function autoStartPending() {
  return autoTimer !== null;
}

function cancelAutoStart(message) {
  if (!autoStartPending()) return;
  clearTimeout(autoTimer);
  autoTimer = null;
  renderRun(run, message);
}

function renderRun(r, overrideDetail) {
  run = r || { state: "idle" };
  const running = run.state === "running";
  const pending = autoStartPending();

  document.body.dataset.state = run.state;
  pillText.textContent = PILL_TEXT[run.state] || "Ready";

  // Button
  if (running) {
    action.textContent = "Stop";
    action.dataset.mode = "stop";
  } else if (pending) {
    action.textContent = "Cancel";
    action.dataset.mode = "cancel";
  } else {
    action.textContent = run.state === "done" ? "Run again" : "Start";
    action.dataset.mode = "start";
  }

  // Detail line
  let text;
  if (overrideDetail) {
    text = overrideDetail;
  } else if (pending) {
    text = "Starting in a moment. Cancel, or move the slider to adjust first.";
  } else if (running) {
    text = run.phase === "form" ? "Filling in this course's form…"
         : run.phase === "list" ? "Opening the next course…"
         : "Starting…";
  } else {
    text = run.message || "Open your feedback page, then press Start.";
  }
  detail.textContent = text;

  // Progress
  const total = Number(run.total) || 0;
  const remaining = run.remaining == null ? total : Number(run.remaining);
  const completed = Math.max(0, Math.min(total, total - remaining));
  const showProgress = running || (run.state === "done" && total > 0);

  progressRow.hidden = !showProgress;
  if (showProgress) {
    const indeterminate = running && total === 0;
    progress.classList.toggle("indeterminate", indeterminate);
    if (indeterminate) {
      progress.removeAttribute("aria-valuenow");
      progress.removeAttribute("aria-valuemax");
      count.textContent = "";
    } else {
      progress.style.setProperty("--w", `${(completed / total) * 100}%`);
      progress.setAttribute("aria-valuemax", String(total));
      progress.setAttribute("aria-valuenow", String(completed));
      count.textContent = `${completed} of ${total}`;
    }
  }
}

async function saveSettings() {
  await chrome.storage.local.set({
    answerIndex: Number(slider.value),
    autoRun: autoRun.checked
  });
}

async function start() {
  clearTimeout(autoTimer);
  autoTimer = null;
  await saveSettings();
  renderRun({ state: "running" });

  try {
    await chrome.runtime.sendMessage({ type: "START" });
    // Live status arrives through storage.onChanged.
  } catch (_) {
    renderRun({
      state: "error",
      message: "Couldn't reach the extension. Reload it from chrome://extensions and try again."
    });
  }
}

async function stop() {
  try {
    await chrome.runtime.sendMessage({ type: "STOP" });
  } catch (_) {
    renderRun({ state: "stopped", message: "Stopped." });
  }
}

function shouldAutoStart(r) {
  if (r.state === "running") return false;
  // Don't immediately re-run over a result the user just came to read.
  if (r.state === "done" && Date.now() - (r.updatedAt || 0) < RECENT_DONE_MS) return false;
  return true;
}

action.addEventListener("click", () => {
  if (run.state === "running") return stop();
  if (autoStartPending()) return cancelAutoStart("Auto-start cancelled. Press Start when you're ready.");
  return start();
});

darkQuery.addEventListener("change", paintSlider);

slider.addEventListener("input", async () => {
  paintSlider();
  cancelAutoStart("Auto-start paused while you adjust. Press Start when you're ready.");
  await saveSettings();
});

autoRun.addEventListener("change", async () => {
  cancelAutoStart();
  await saveSettings();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "session" && changes.runState) {
    renderRun(changes.runState.newValue);
  }
});

async function init() {
  const [saved, session] = await Promise.all([
    chrome.storage.local.get({ answerIndex: 0, autoRun: true }),
    chrome.storage.session.get("runState")
  ]);

  slider.value = String(saved.answerIndex);
  autoRun.checked = saved.autoRun;
  paintSlider();

  const current = session.runState || { state: "idle" };

  if (saved.autoRun && shouldAutoStart(current)) {
    autoTimer = setTimeout(start, AUTO_START_DELAY_MS);
  }
  renderRun(current);
}

init();
