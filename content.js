(() => {
  "use strict";

  let running = false;
  const OPTIONS = [
    "strongly agree", "agree", "uncertain",
    "dissatisfied", "strongly disagree"
  ];

  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const norm = s => (s || "").replace(/\s+/g, " ").trim().toLowerCase();

  function visible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    const c = getComputedStyle(el);
    return r.width > 0 && r.height > 0 &&
           c.display !== "none" && c.visibility !== "hidden";
  }

  function activate(el) {
    try { el.focus({preventScroll:true}); } catch {}
    el.click();
    el.dispatchEvent(new Event("input", {bubbles:true}));
    el.dispatchEvent(new Event("change", {bubbles:true}));
  }

  function labelText(radio) {
    if (radio.id) {
      const label = document.querySelector(`label[for="${CSS.escape(radio.id)}"]`);
      if (label) return norm(label.innerText);
    }
    const label = radio.closest("label");
    if (label) return norm(label.innerText);
    return norm(radio.nextElementSibling?.innerText);
  }

  function questionGroups() {
    const radios = [...document.querySelectorAll('input[type="radio"]')].filter(visible);
    const map = new Map();

    for (const r of radios) {
      const key =
        r.name ||
        r.closest("fieldset")?.id ||
        r.closest("fieldset")?.getAttribute("name") ||
        r.closest("li, tr, .question, .form-group")?.innerText?.slice(0,100) ||
        "ungrouped";

      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }

    return [...map.values()].filter(group => {
      if (group.length < 2) return false;
      const labels = group.map(labelText).join(" ");
      const hits = OPTIONS.filter(x => labels.includes(x)).length;
      return hits >= 3;
    });
  }

  async function fill() {
    const {selectedIndex = 0} =
      await chrome.storage.local.get({selectedIndex: 0});

    const groups = questionGroups();
    let count = 0;

    for (const group of groups) {
      let target = group[selectedIndex];

      // Prefer matching the visible label text when the DOM order differs.
      const exact = group.find(r => labelText(r) === OPTIONS[selectedIndex]);
      if (exact) target = exact;

      if (target && !target.checked) {
        activate(target);
        count++;
      }
    }
    return count;
  }

  function buttons() {
    return [...document.querySelectorAll(
      'button,a,input[type="button"],input[type="submit"]'
    )].filter(visible);
  }

  function findButton(words) {
    return buttons().find(el => {
      const text = norm(el.innerText || el.value || el.getAttribute("aria-label"));
      return words.some(w => text === w || text.includes(w));
    });
  }

  async function clickNextOrSubmit() {
    await sleep(25);
    const submit = findButton(["submit","finish","complete","save & submit"]);
    if (submit) { activate(submit); return "submitted"; }

    const next = findButton(["next","continue","save & next","proceed"]);
    if (next) { activate(next); return "next"; }

    return "none";
  }

  async function clickGiveFeedback() {
    const button = findButton(["give feedback"]);
    if (button) { activate(button); return true; }
    return false;
  }

  async function run() {
    if (running) return;
    running = true;

    try {
      for (let i = 0; i < 50; i++) {
        if (questionGroups().length) {
          await fill();
          const nav = await clickNextOrSubmit();
          if (nav !== "none") {
            await sleep(150);
            continue;
          }
        }

        if (await clickGiveFeedback()) {
          await sleep(150);
          continue;
        }

        break;
      }
    } finally {
      running = false;
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg?.type === "RUN") {
      run().then(() => sendResponse({ok:true}));
      return true;
    }
  });
})();