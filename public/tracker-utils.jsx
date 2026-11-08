// tracker-utils.jsx — theme-centric data model, synthesis API
// Security fixes applied:
//   ✅ SYNTH_SYSTEM removed — system prompt now lives server-side only
//   ✅ shapeResult removed — data.themes consumed directly from API response
//   ✅ callAPI no longer sends a 'system' field to the backend
//   ✅ crypto.randomUUID() replaces fragile Date.now() IDs
//   ✅ CLIENT_APP_TOKEN matches APP_TOKEN env var on the server (set both)

// ── App token (optional) ─────────────────────────────────────────────────
// To enable the token check, set APP_TOKEN in your Vercel environment variables
// AND set CLIENT_APP_TOKEN here to the same value. Leave empty to skip.
const CLIENT_APP_TOKEN = "";

// ── Rate Limit Management ────────────────────────────────────────────────
const RATE_LIMIT_KEY = "rt_rateLimit_v1";
const RATE_LIMIT_MAX = 2;

function getRateLimitState() {
  try {
    const stored = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY));
    if (!stored) return { used: 0, resetTime: getNextMidnightUTC() };
    const now = Date.now();
    if (now >= stored.resetTime) return { used: 0, resetTime: getNextMidnightUTC() };
    return stored;
  } catch {
    return { used: 0, resetTime: getNextMidnightUTC() };
  }
}

function getNextMidnightUTC() {
  const t = new Date();
  t.setUTCDate(t.getUTCDate() + 1);
  t.setUTCHours(0, 0, 0, 0);
  return t.getTime();
}

function incrementRateLimit() {
  const state = getRateLimitState();
  state.used = Math.min(state.used + 1, RATE_LIMIT_MAX);
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
  return state;
}

function canMakeRequest() {
  return getRateLimitState().used < RATE_LIMIT_MAX;
}

const C = {
  bg:          "oklch(93.5% 0.018 74)",
  surface:     "oklch(98.5% 0.010 78)",
  surface2:    "oklch(96.0% 0.015 74)",
  text:        "oklch(22%   0.030 58)",
  textMuted:   "oklch(45%   0.025 60)",
  border:      "oklch(86%   0.038 70)",
  borderLight: "oklch(91%   0.022 74)",
  terra:       "oklch(55%   0.140 32)",
  terraLight:  "oklch(91%   0.055 35)",
  terraDark:   "oklch(42%   0.115 32)",
  terraBg:     "oklch(96.5% 0.030 38)",
  amber:       "oklch(65%   0.140 72)",
  amberLight:  "oklch(93%   0.050 74)",
  sage:        "oklch(50%   0.095 145)",
  sageLight:   "oklch(93%   0.030 145)",
};

// Revision stages, based on share of points earned (0–1)
const LEVELS = [
  { name: "Getting started",       share: 0    },
  { name: "First pass",            share: 0.15 },
  { name: "Major issues addressed",share: 0.4  },
  { name: "Polishing",             share: 0.7  },
  { name: "Final checks",          share: 0.9  },
  { name: "Ready to resubmit",     share: 1    },
];

// ── Analytics: Vercel custom events (no review text is ever sent) ─────────
function track(name, data) {
  try { if (typeof window.va === "function") window.va("event", data ? { name, data } : { name }); } catch {}
  try { if (typeof window.gtag === "function") window.gtag("event", name, data || {}); } catch {}
}

// ── Example plan (loads instantly, no API call, doesn't count toward the limit)
function getSampleThemes() {
  const id = () => crypto.randomUUID();
  const t = (text, xp, importance, sources, done = false) => ({ id: id(), text, xp, importance, sources, done });
  return [
    { id: id(), themeName: "Methodology", summary: "Reviewers want the sampling and analysis choices justified more clearly.", tasks: [
      t("Explain why you chose purposive sampling and what its limits are (Section 3.1)", 28, "essential", ["Reviewer 1", "Reviewer 2"]),
      t("Report how many participants were invited, how many took part, and why some dropped out", 20, "major", ["Reviewer 2"], true),
      t("Add a short paragraph describing how the interview codes were checked by a second coder", 18, "major", ["Reviewer 1"]),
    ]},
    { id: id(), themeName: "Literature Review", summary: "The review misses recent work and doesn't position the study against it.", tasks: [
      t("Add and discuss 3–5 studies from 2022 onward on the same topic", 22, "major", ["Reviewer 3"]),
      t("End the review with two sentences stating the gap this paper fills", 15, "moderate", ["Reviewer 1", "Reviewer 3"], true),
    ]},
    { id: id(), themeName: "Discussion", summary: "Findings are summarised but not linked back to theory or practice.", tasks: [
      t("Connect each main finding to the framework introduced in Section 2", 24, "major", ["Reviewer 2"]),
      t("Add a 'Limitations' subsection covering sample size and context", 14, "moderate", ["Reviewer 1"]),
    ]},
    { id: id(), themeName: "Writing Quality", summary: "Some passages are long and repetitive.", tasks: [
      t("Shorten the introduction to about one page", 10, "minor", ["Reviewer 3"]),
      t("Define every acronym the first time it appears", 5, "trivial", ["Reviewer 2"]),
      t("Fix the inconsistent tense in the Results section", 6, "trivial", ["Reviewer 1"]),
    ]},
  ];
}

const THEME_COLORS = {
  "Methodology":      "oklch(50% 0.12 32)",
  "Literature Review":"oklch(48% 0.10 295)",
  "Theory":           "oklch(48% 0.10 258)",
  "Experiments":      "oklch(48% 0.10 185)",
  "Writing Quality":  "oklch(48% 0.10 145)",
  "Citations":        "oklch(52% 0.12 62)",
  "Structure":        "oklch(50% 0.12 22)",
  "Format":           "oklch(48% 0.10 100)",
  "Contribution":     "oklch(48% 0.10 318)",
  "Discussion":       "oklch(48% 0.10 200)",
};

const IMPORTANCE_DOT = {
  essential: "#b84030", major: "#c47030",
  moderate: "#5070b8", minor: "#507850", trivial: "#988070",
};

function getLevel(earned, total) {
  const share = total > 0 ? earned / total : 0;
  let idx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) { if (share >= LEVELS[i].share) { idx = i; break; } }
  return { level: LEVELS[idx], nextLevel: LEVELS[idx + 1] || null };
}

// ✅ Uses crypto.randomUUID() — guaranteed unique, no collision risk
function generateId() { return crypto.randomUUID(); }

function getThemeColor(name) { return THEME_COLORS[name] || C.terra; }

// ── Daily quests from themes[] ────────────────────────────────────────────
function getDailyQuests(themes) {
  const all = [];
  for (const th of themes)
    for (const t of th.tasks)
      if (!t.done) all.push({ ...t, themeName: th.themeName });
  if (!all.length) return [];
  const dateStr = new Date().toISOString().slice(0, 10);
  let seed = dateStr.split("").reduce((s, c) => s * 31 + c.charCodeAt(0), 7);
  const rng = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return Math.abs(seed) / 0xffffffff; };
  const high = all.filter(t => t.xp >= 20).sort((a, b) => b.xp - a.xp);
  const low  = all.filter(t => t.xp <= 12).sort(() => rng() - 0.5);
  const result = [];
  if (high.length) result.push(high[Math.floor(rng() * high.length)]);
  for (const t of low) { if (result.length >= 4) break; if (!result.find(r => r.id === t.id)) result.push(t); }
  return result;
}

// ── Export ────────────────────────────────────────────────────────────────
function exportProgress(themes) {
  const date    = new Date().toLocaleDateString("en-US", { year:"numeric", month:"long", day:"numeric" });
  const totalXP  = themes.reduce((s,th) => s+th.tasks.reduce((ss,t)=>ss+t.xp, 0), 0);
  const earnedXP = themes.reduce((s,th) => s+th.tasks.filter(t=>t.done).reduce((ss,t)=>ss+t.xp, 0), 0);
  const lines = [
    "# Peer Review Planner — Revision Plan", `Exported: ${date}`, "",
    `**Overall: ${themes.reduce((s,th)=>s+th.tasks.filter(t=>t.done).length,0)} of ${themes.reduce((s,th)=>s+th.tasks.length,0)} tasks done  (${Math.round(earnedXP/Math.max(totalXP,1)*100)}% of points)**`, "",
  ];
  for (const th of themes) {
    const thT = th.tasks.reduce((s,t)=>s+t.xp, 0);
    const thE = th.tasks.filter(t=>t.done).reduce((s,t)=>s+t.xp, 0);
    lines.push(`## ${th.themeName}  (${th.tasks.filter(t=>t.done).length}/${th.tasks.length} tasks)`);
    if (th.summary) lines.push(`> ${th.summary}`, "");
    for (const t of th.tasks) {
      const src = t.sources?.length ? `  [${t.sources.join(", ")}]` : "";
      lines.push(`- [${t.done?"x":" "}] ${t.text}  *(${t.importance}, ${t.xp} pts)${src}*`);
    }
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type:"text/markdown;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement("a"), { href:url, download:`review-progress-${new Date().toISOString().slice(0,10)}.md` });
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ── Merge new themes into existing ────────────────────────────────────────
function mergeIntoThemes(existing, incoming) {
  const result = existing.map(th => ({ ...th, tasks: [...th.tasks] }));
  for (const inc of incoming) {
    const found = result.find(th => th.themeName === inc.themeName);
    if (found) { found.tasks.push(...inc.tasks); }
    else { result.push({ ...inc, id: generateId() }); }
  }
  return result;
}

// ── API call ──────────────────────────────────────────────────────────────
// ✅ Does NOT send 'system' — prompt is hardcoded server-side
// ✅ Returns data.themes directly — no client-side JSON parsing/shaping
async function callAPI(userMsg) {
  if (!canMakeRequest()) {
    throw new Error("__RATE_LIMIT__");
  }

  try {
    const headers = { "Content-Type": "application/json" };
    if (CLIENT_APP_TOKEN) headers["X-App-Token"] = CLIENT_APP_TOKEN;

    const res = await fetch("/api/analyze", {
      method: "POST",
      headers,
      body: JSON.stringify({ user: userMsg }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err.error?.message || err.message || "").toLowerCase();
      if (res.status === 429 || msg.includes("rate")) throw new Error("__RATE_LIMIT__");
      if (res.status === 401) throw new Error("Backend authentication failed. Please check server configuration.");
      throw new Error(err.error?.message || err.message || `Backend error ${res.status}`);
    }

    const data = await res.json();
    if (!data.themes || !Array.isArray(data.themes)) {
      throw new Error("AI did not return valid data. Please try again.");
    }
    incrementRateLimit();
    return data.themes;
  } catch (e) {
    if (e.message === "__RATE_LIMIT__") throw e;
    const m = String(e?.message || e).toLowerCase();
    if (m.includes("rate") || m.includes("limit") || m.includes("429")) throw new Error("__RATE_LIMIT__");
    if (m.includes("network") || m.includes("fetch")) {
      throw new Error("Network error — cannot reach backend. Ensure /api/analyze is available.");
    }
    throw e;
  }
}

// ── Public API functions ──────────────────────────────────────────────────
async function parseAllFeedback(feedbackList) {
  const userMsg = "Synthesize the following reviewer feedback:\n\n" +
    feedbackList.map(f => `--- ${f.label} ---\n${f.text}`).join("\n\n");
  return await callAPI(userMsg);
}

async function parseSingleFeedback(text, label) {
  const userMsg = `Synthesize the following reviewer feedback:\n\n--- ${label} ---\n${text}`;
  return await callAPI(userMsg);
}

Object.assign(window, {
  C, LEVELS, IMPORTANCE_DOT, getSampleThemes, track, getLevel, generateId, getThemeColor,
  getDailyQuests, exportProgress, mergeIntoThemes, parseAllFeedback, parseSingleFeedback,
  getRateLimitState, canMakeRequest, RATE_LIMIT_MAX,
});
