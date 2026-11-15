(() => {
"use strict";
if (window.__sparxReaderTutorLoaded) return;
window.__sparxReaderTutorLoaded = true;

const KEY = "sparxReaderTutorSettings";
const DEFAULT_MODEL = "gemini-3.8-flash";
const MAX_EXCERPT = 500;
const state = { running:false, raf:0, last:0, speed:90, seen:new Set(), sending:false };

const css = "#srt-panel{position:fixed;z-index:2147483646;right:18px;top:90px;width:310px;max-height:calc(100vh - 110px);overflow:auto;background:#101827;color:#eaf1ff;border:1px solid #33496c;border-radius:14px;box-shadow:0 14px 45px #0008;font:13px/1.45 system-ui,sans-serif;padding:13px}" +
"#srt-panel *{box-sizing:border-box}#srt-panel .head{display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:15px;margin-bottom:9px}" +
"#srt-panel button{border:0;border-radius:8px;padding:8px 10px;background:#2563eb;color:white;font-weight:700;cursor:pointer}" +
"#srt-panel button.secondary{background:#26364f;color:#dce8ff}#srt-panel button:disabled{opacity:.55;cursor:wait}" +
"#srt-panel input{width:100%;padding:8px;border:1px solid #40516e;border-radius:7px;background:#0b1220;color:#fff;margin:4px 0 8px}" +
"#srt-panel label{display:block;color:#b9c9e4;font-size:12px;margin-top:7px}#srt-panel .row{display:flex;gap:7px}" +
"#srt-panel .row>*{flex:1}#srt-panel .muted{color:#a9bad5;font-size:11px}#srt-panel .status,#srt-panel .result{white-space:pre-wrap;overflow-wrap:anywhere;padding:9px;background:#0b1220;border-radius:8px;margin:9px 0}" +
"#srt-panel .result{max-height:220px;overflow:auto}#srt-toggle{position:fixed;right:18px;top:45px;z-index:2147483646;background:#2563eb;color:white;border:0;border-radius:9px;padding:8px 12px;font:700 12px system-ui;cursor:pointer}";
const style = document.createElement("style");
style.textContent = css;
document.documentElement.appendChild(style);

const toggle = document.createElement("button");
toggle.id = "srt-toggle";
toggle.textContent = "Reader Tutor";
document.documentElement.appendChild(toggle);

const panel = document.createElement("section");
panel.id = "srt-panel";
panel.innerHTML = [
'<div class="head"><span>Sparx Reader Tutor</span><button class="secondary" id="srt-hide">Hide</button></div>',
'<div class="muted">Explains one short, currently visible excerpt. It does not answer or submit checkpoints.</div>',
'<label for="srt-key">Gemini API key</label><input id="srt-key" type="password" autocomplete="off" placeholder="Paste your own API key">',
'<div class="row"><button class="secondary" id="srt-save">Save key</button><button id="srt-test">Test Gemini</button></div>',
'<label for="srt-model">Gemini model</label><input id="srt-model" value="gemini-3.8-flash" spellcheck="false">',
'<label for="srt-speed">Auto-scroll speed: <span id="srt-speed-value">90</span> px/sec</label><input id="srt-speed" type="range" min="20" max="400" value="90">',
'<div class="row"><button id="srt-start">Start scrolling</button><button class="secondary" id="srt-stop">Pause</button></div>',
'<div class="status" id="srt-status">Looking for the Sparx Reader area…</div>',
'<div class="row"><button id="srt-explain">Explain visible excerpt</button><button class="secondary" id="srt-clear">Clear</button></div>',
'<div class="result" id="srt-result">Gemini explanation appears here.</div>'
].join("");
document.documentElement.appendChild(panel);

const $ = id => panel.querySelector("#" + id);
const setStatus = value => { $("srt-status").textContent = value; };
const setResult = value => { $("srt-result").textContent = value; };

function getArea() {
  const known = document.querySelector("#book-scroll");
  if (known && known.scrollHeight > known.clientHeight + 20) return known;
  const content = document.querySelector(".read-content");
  if (content) {
    let node = content.parentElement;
    while (node && node !== document.body) {
      const css = getComputedStyle(node);
      if (node.scrollHeight > node.clientHeight + 20 && /(auto|scroll)/.test(css.overflowY)) return node;
      node = node.parentElement;
    }
  }
  return document.scrollingElement || document.documentElement;
}
function checkpoint() {
  return [...document.querySelectorAll("button")].find(b =>
    /i have read up to here/i.test((b.innerText || b.textContent || "").trim())
  ) || null;
}
function checkpointNear(area) {
  const button = checkpoint();
  if (!button) return false;
  const r = button.getBoundingClientRect();
  const a = area.getBoundingClientRect();
  return r.top < a.bottom + 100 && r.bottom > a.top - 100;
}
function stopScroll(message) {
  state.running = false;
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = 0;
  state.last = 0;
  $("srt-start").textContent = "Start scrolling";
  if (message) setStatus(message);
}
function updateSeen(area) {
  const a = area.getBoundingClientRect();
  document.querySelectorAll("#book-scroll .read-content p, .read-content p").forEach(p => {
    const r = p.getBoundingClientRect();
    if (r.bottom > a.top && r.top < a.bottom && r.bottom > 0 && r.top < innerHeight) state.seen.add(p);
  });
}
function frame(now) {
  if (!state.running) return;
  const area = getArea();
  if (checkpointNear(area)) {
    stopScroll("Checkpoint reached. Scrolling paused. Click the Sparx checkpoint yourself when ready.");
    return;
  }
  if (state.last) area.scrollTop += state.speed * Math.min(50, now - state.last) / 1000;
  state.last = now;
  updateSeen(area);
  setStatus("Auto-scrolling · " + state.seen.size + " visible paragraphs encountered");
  if (area.scrollTop + area.clientHeight >= area.scrollHeight - 3) {
    stopScroll("End of the current reading area reached.");
    return;
  }
  state.raf = requestAnimationFrame(frame);
}
function visibleExcerpt() {
  const area = getArea();
  const a = area.getBoundingClientRect();
  const paragraphs = [...document.querySelectorAll("#book-scroll .read-content p, .read-content p")];
  const visible = paragraphs.filter(p => {
    const r = p.getBoundingClientRect();
    return r.bottom > Math.max(a.top, 0) && r.top < Math.min(a.bottom, innerHeight) && r.width > 0 && r.height > 0;
  });
  let text = visible.map(p => (p.innerText || p.textContent || "").trim()).filter(Boolean).join(" ");
  if (!text) {
    const content = document.querySelector("#book-scroll .read-content, .read-content");
    if (content) text = (content.innerText || "").trim();
  }
  return text.replace(/\s+/g, " ").trim().slice(0, MAX_EXCERPT);
}
function storageGet() {
  return new Promise(resolve => {
    try {
      chrome.storage.local.get([KEY], data => {
        if (chrome.runtime.lastError) return resolve({});
        resolve(data[KEY] || {});
      });
    } catch (_) { resolve({}); }
  });
}
function storageSet(value) {
  return new Promise((resolve, reject) => {
    try {
      chrome.storage.local.set({ [KEY]:value }, () => {
        const error = chrome.runtime.lastError;
        if (error) reject(new Error(error.message)); else resolve();
      });
    } catch (error) { reject(error); }
  });
}
async function loadSettings() {
  const saved = await storageGet();
  if (saved.apiKey) $("srt-key").value = saved.apiKey;
  if (saved.model) $("srt-model").value = saved.model;
}
function requestGemini(prompt) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({
      type: "SRT_GEMINI_REQUEST",
      apiKey: $("srt-key").value.trim(),
      model: $("srt-model").value.trim(),
      prompt
    }, response => {
      const runtimeError = chrome.runtime.lastError;
      if (runtimeError) return reject(new Error(runtimeError.message));
      if (!response) return reject(new Error("No reply from the extension background worker. Reload the extension and try again."));
      if (!response.ok) return reject(new Error(response.error || "Gemini request failed."));
      resolve(response.answer);
    });
  });
}

async function runGemini(testOnly) {
  if (state.sending) return;
  const apiKey = $("srt-key").value.trim();
  const model = $("srt-model").value.trim();
  const excerpt = testOnly ? "" : visibleExcerpt();
  if (!apiKey) { setStatus("Paste your Gemini API key and press Save key first."); return; }
  if (!/^[a-zA-Z0-9._-]+$/.test(model)) { setStatus("Invalid model name."); return; }
  if (!testOnly && !excerpt) { setStatus("No reading text is visible. Scroll to a paragraph first."); return; }

  state.sending = true;
  $("srt-explain").disabled = true;
  $("srt-test").disabled = true;
  setStatus(testOnly ? "Testing Gemini connection…" : "Sending one short visible excerpt to Gemini…");
  setResult(testOnly ? "Waiting for Gemini connection test…" : "Waiting for Gemini…");
  const prompt = testOnly
    ? "Reply with exactly: Gemini connection successful."
    : "You are a reading tutor. Explain this short passage in clear, age-appropriate language. Clarify difficult vocabulary and briefly describe what is happening. Do not answer school quiz questions, choose options, or provide checkpoint answers. Use only this excerpt:\\n\\n" + excerpt;
  try {
    const answer = await requestGemini(prompt);
    setResult(answer);
    setStatus(testOnly
      ? "Gemini connection successful. Your API key and model are working."
      : "Gemini replied successfully. Only the visible excerpt was sent.");
  } catch (error) {
    setResult("Request failed: " + (error.message || String(error)));
    setStatus("Gemini request failed. See the result box for the exact reason.");
  } finally {
    state.sending = false;
    $("srt-explain").disabled = false;
    $("srt-test").disabled = false;
  }
}

toggle.addEventListener("click", () => { panel.style.display = panel.style.display === "none" ? "block" : "none"; });
$("srt-hide").addEventListener("click", () => { panel.style.display = "none"; });
$("srt-save").addEventListener("click", async () => {
  try {
    await storageSet({apiKey:$("srt-key").value.trim(),model:$("srt-model").value.trim() || DEFAULT_MODEL});
    setStatus("Settings saved locally in this browser.");
  } catch (error) { setStatus("Could not save settings: " + error.message); }
});
$("srt-model").addEventListener("change", async () => {
  try { await storageSet({apiKey:$("srt-key").value.trim(),model:$("srt-model").value.trim() || DEFAULT_MODEL}); } catch (_) {}
});
$("srt-speed").addEventListener("input", event => {
  state.speed = Number(event.target.value);
  $("srt-speed-value").textContent = String(state.speed);
});
$("srt-start").addEventListener("click", () => {
  const area = getArea();
  if (!area || area.scrollHeight <= area.clientHeight + 5) { setStatus("Could not find a scrollable Sparx reading area."); return; }
  if (checkpointNear(area)) { setStatus("Checkpoint reached. Click it yourself when ready."); return; }
  state.running = true;
  state.last = 0;
  $("srt-start").textContent = "Scrolling…";
  setStatus("Auto-scrolling started.");
  state.raf = requestAnimationFrame(frame);
});
$("srt-stop").addEventListener("click", () => stopScroll("Scrolling paused."));
$("srt-explain").addEventListener("click", () => runGemini(false));
$("srt-test").addEventListener("click", () => runGemini(true));
$("srt-clear").addEventListener("click", () => setResult("Gemini explanation appears here."));

const observer = new MutationObserver(() => {
  if (state.running && checkpointNear(getArea())) {
    stopScroll("Checkpoint detected. Scrolling paused. Click the checkpoint yourself.");
  }
});
observer.observe(document.documentElement,{childList:true,subtree:true});
loadSettings();
setStatus("Sparx Reader detected. Scroll to a passage, then explain the visible excerpt.");
})();