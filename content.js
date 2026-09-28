(() => {
  if (window.__courseFeedbackFastLoaded) return;
  window.__courseFeedbackFastLoaded = true;

  const ANSWERS = [
    "Strongly Agree",
    "Agree",
    "Uncertain",
    "Dissatisfied",
    "Strongly Disagree"
  ];

  let stopped = false;
  let busy = false;

  function notify(message) {
    return chrome.runtime.sendMessage(message).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "RUN") {
      stopped = false;
      run();
    }

    if (message.type === "STOP") {
      stopped = true;
    }
  });

  function clean(text) {
    return (text || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function visible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return style.display !== "none" &&
           style.visibility !== "hidden" &&
           rect.width > 0 &&
           rect.height > 0;
  }

  function getButtonText(el) {
    return clean(
      el.innerText ||
      el.value ||
      el.getAttribute("aria-label") ||
      el.title ||
      ""
    );
  }

  function findAllGiveFeedback() {
    const candidates = [
      ...document.querySelectorAll("button, input[type='button'], input[type='submit'], a")
    ];

    return candidates.filter(el =>
      visible(el) && getButtonText(el).includes("give feedback")
    );
  }

  function findNavigationButton() {
    const candidates = [
      ...document.querySelectorAll(
        "button, input[type='button'], input[type='submit'], a"
      )
    ];

    const preferred = candidates.find(el => {
      if (!visible(el)) return false;
      const t = getButtonText(el);
      return /\b(next|continue|submit|save\s*&?\s*submit|finish)\b/i.test(t);
    });

    return preferred || null;
  }

  function radioGroups() {
    const radios = [...document.querySelectorAll("input[type='radio']")]
      .filter(visible);

    const groups = new Map();

    for (const radio of radios) {
      const key = radio.name ||
        radio.getAttribute("data-question") ||
        radio.closest("fieldset")?.id ||
        radio.closest("fieldset")?.getAttribute("name") ||
        "";
      if (!key) continue;

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(radio);
    }

    return [...groups.values()];
  }

  function labelForRadio(radio) {
    if (radio.id) {
      const label = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
      if (label) return clean(label.innerText);
    }

    const parentLabel = radio.closest("label");
    if (parentLabel) return clean(parentLabel.innerText);

    const next = radio.nextElementSibling;
    if (next) return clean(next.innerText);

    return clean(radio.value);
  }

  function selectAnswer(group, answerIndex) {
    const wanted = clean(ANSWERS[answerIndex]);

    // First try to match the visible label text exactly/partially.
    let target = group.find(radio => {
      const text = labelForRadio(radio);
      return text === wanted || text.includes(wanted);
    });

    // Fallback: this university's shown order is Strongly Agree -> ... -> Strongly Disagree.
    if (!target) target = group[answerIndex];

    if (!target) return false;

    target.checked = true;
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    target.click();

    return true;
  }

  async function fillFeedback() {
    const { answerIndex = 0 } = await chrome.storage.local.get({
      answerIndex: 0
    });

    // Trigger lazy-loaded content without spending seconds per scroll.
    const oldY = window.scrollY;
    const maxY = Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight
    );

    for (let y = 0; y <= maxY; y += Math.max(window.innerHeight, 700)) {
      if (stopped) return 0;
      window.scrollTo(0, y);
      await new Promise(r => requestAnimationFrame(r));
    }

    const groups = radioGroups();
    let filled = 0;

    for (const group of groups) {
      if (selectAnswer(group, Number(answerIndex))) {
        filled++;
      }
    }

    window.scrollTo(0, oldY);
    return filled;
  }

  async function run() {
    if (busy || stopped) return;
    busy = true;

    try {
      // A) Course list page: click the first remaining Give Feedback.
      const remaining = findAllGiveFeedback();

      if (remaining.length > 0) {
        await notify({ type: "LIST", remaining: remaining.length });
        remaining[0].click();

        // Navigation is handled by the background service worker.
        return;
      }

      // B) Feedback page: detect radio groups and fill them.
      const groups = radioGroups();

      if (groups.length > 0) {
        await notify({ type: "FORM" });
        const filled = await fillFeedback();

        if (stopped) return;

        if (filled > 0) {
          // Submit/Next using the site's own UI.
          const nav = findNavigationButton();

          if (nav) {
            nav.click();
            return;
          }

          // No navigation button found: stop rather than guessing.
          await notify({ type: "DONE", reason: "no-nav" });
          return;
        }
      }

      // C) Nothing actionable remains.
      await notify({ type: "DONE", reason: "complete" });
    } finally {
      busy = false;
    }
  }

  // Allow the service worker to continue the same run after a page navigation.
  window.addEventListener("pageshow", () => {
    notify({ type: "CONTINUE_AFTER_NAVIGATION" });
  });
})();