// Run state lives in chrome.storage.session, not in memory: Chrome stops idle
// service workers, and an in-memory Set would be lost mid-run.
const KEY = "runState";
const IDLE = {
  state: "idle",      // idle | running | done | stopped | error
  tabId: null,
  phase: null,        // list | form
  total: 0,           // courses seen on the list when the run began
  remaining: null,    // "Give Feedback" buttons left on the latest list view
  message: "",
  updatedAt: 0
};

let queue = Promise.resolve();

// Serialised read-modify-write so concurrent messages can't overwrite each other.
function update(fn) {
  queue = queue
    .then(async () => {
      const stored = await chrome.storage.session.get(KEY);
      const current = stored[KEY] || IDLE;
      const next = { ...current, ...fn(current), updatedAt: Date.now() };
      await chrome.storage.session.set({ [KEY]: next });
      return next;
    })
    .catch(() => undefined);
  return queue;
}

async function current() {
  await queue;
  const stored = await chrome.storage.session.get(KEY);
  return stored[KEY] || IDLE;
}

async function isRunning(tabId) {
  const run = await current();
  return run.state === "running" && run.tabId === tabId;
}

async function inject(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  });
}

async function resume(tabId) {
  try {
    await inject(tabId);
    await chrome.tabs.sendMessage(tabId, { type: "RUN" });
  } catch (_) {}
}

async function start() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    await update(() => ({ ...IDLE, state: "error", message: "No active tab found." }));
    return { ok: false };
  }

  if (tab.url && !/^https?:/i.test(tab.url)) {
    await update(() => ({
      ...IDLE,
      state: "error",
      message: "Open your university's feedback page in this tab, then press Start."
    }));
    return { ok: false };
  }

  await update(() => ({ ...IDLE, state: "running", tabId: tab.id }));

  try {
    await inject(tab.id);
    await chrome.tabs.sendMessage(tab.id, { type: "RUN" });
    return { ok: true };
  } catch (_) {
    await update(() => ({
      ...IDLE,
      state: "error",
      message: "Couldn't run on this page. Open the feedback page in this tab, then press Start."
    }));
    return { ok: false };
  }
}

async function stop() {
  const run = await current();
  if (run.tabId) {
    try { await chrome.tabs.sendMessage(run.tabId, { type: "STOP" }); } catch (_) {}
  }
  if (run.state === "running") {
    await update(() => ({ state: "stopped", tabId: null, phase: null, message: "Stopped." }));
  }
  return { ok: true };
}

async function handle(message, sender) {
  const tabId = sender.tab?.id;

  switch (message.type) {
    case "START":
      return start();

    case "STOP":
      return stop();

    case "LIST": {
      if (!(await isRunning(tabId))) return {};
      const remaining = Number(message.remaining) || 0;
      await update(r => ({
        phase: "list",
        remaining,
        total: Math.max(r.total, remaining)
      }));
      return {};
    }

    case "FORM":
      if (await isRunning(tabId)) await update(() => ({ phase: "form" }));
      return {};

    case "CONTINUE_AFTER_NAVIGATION":
      if (await isRunning(tabId)) setTimeout(() => resume(tabId), 300);
      return {};

    case "DONE": {
      if (!(await isRunning(tabId))) return {};

      if (message.reason === "no-nav") {
        await update(() => ({
          state: "error",
          tabId: null,
          phase: null,
          message: "Answers were filled, but no Next or Submit button was found. Continue on the page."
        }));
        return {};
      }

      await update(r => {
        if (r.total > 0) {
          const noun = r.total === 1 ? "course" : "courses";
          return {
            state: "done",
            tabId: null,
            phase: null,
            remaining: 0,
            message: `Finished. ${r.total} ${noun} submitted.`
          };
        }
        return {
          state: "idle",
          tabId: null,
          phase: null,
          message: "No feedback forms found on this page."
        };
      });
      return {};
    }

    default:
      return {};
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handle(message, sender)
    .then(sendResponse)
    .catch(() => sendResponse({ ok: false }));
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  if (changeInfo.status !== "complete") return;
  if (await isRunning(tabId)) resume(tabId);
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (await isRunning(tabId)) {
    await update(() => ({ state: "stopped", tabId: null, phase: null, message: "The tab was closed." }));
  }
});
