// tracker-utils.jsx — theme-centric data model, synthesis API

// ── Rate Limit Management ────────────────────────────────────────────────
const RATE_LIMIT_KEY = "rt_rateLimit_v1";
const RATE_LIMIT_MAX = 3;

function getRateLimitState() {
  try {
    const stored = JSON.parse(localStorage.getItem(RATE_LIMIT_KEY));
    if (!stored) return { used: 0, resetTime: getNextMidnightUTC() };
    
    const now = Date.now();
    if (now >= stored.resetTime) {
      return { used: 0, resetTime: getNextMidnightUTC() };
    }
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
  textMuted:   "oklch(50%   0.025 60)",
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

const LEVELS = [
  { name: "Novice",              xpNeeded: 0   },
  { name: "Graduate Scholar",    xpNeeded: 60  },
  { name: "Researcher",          xpNeeded: 150 },
  { name: "Senior Researcher",   xpNeeded: 280 },
  { name: "Associate Professor", xpNeeded: 420 },
  { name: "Full Professor",      xpNeeded: 600 },
];

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

function getLevel(xp) {
  let idx = 0;
  for (let i = LEVELS.length - 1; i >= 0; i--) { if (xp >= LEVELS[i].xpNeeded) { idx = i; break; } }
  return { level: LEVELS[idx], nextLevel: LEVELS[idx + 1] || null };
}
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
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
    "# Peer Review Revision Progress", `Exported: ${date}`, "",
    `**Overall: ${earnedXP} / ${totalXP} XP  (${Math.round(earnedXP/Math.max(totalXP,1)*100)}% complete)**`, "",
  ];
  for (const th of themes) {
    const thT = th.tasks.reduce((s,t)=>s+t.xp, 0);
    const thE = th.tasks.filter(t=>t.done).reduce((s,t)=>s+t.xp, 0);
    lines.push(`## ${th.themeName}  (${thE}/${thT} XP)`);
    if (th.summary) lines.push(`> ${th.summary}`, "");
    for (const t of th.tasks) {
      const src = t.sources?.length ? `  [${t.sources.join(", ")}]` : "";
      lines.push(`- [${t.done?"x":" "}] ${t.text}  *(+${t.xp} XP, ${t.importance})${src}*`);
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

// ── API helpers ───────────────────────────────────────────────────────────
function shapeResult(parsed) {
  return (parsed.themes || []).map(th => ({
    id: generateId(),
    themeName: th.themeName || "General",
    summary: th.summary || "",
    tasks: (th.tasks || []).map(t => ({
      id: generateId(), text: t.text || "",
      xp: Math.max(3, Math.min(35, Number(t.xp) || 15)),
      importance: t.importance || "moderate",
      sources: Array.isArray(t.sources) ? t.sources : [],
      done: false,
    })).filter(t => t.text),
  })).filter(th => th.tasks.length > 0);
}

async function callAPI(userMsg, systemPrompt) {
  if (!canMakeRequest()) {
    throw new Error("__RATE_LIMIT__");
  }

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: systemPrompt,
        user: userMsg,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err.error?.message || err.message || "").toLowerCase();
      if (res.status === 429 || msg.includes("rate")) throw new Error("__RATE_LIMIT__");
      if (res.status === 401) throw new Error("Backend authentication failed. Please check server configuration.");
      throw new Error(err.error?.message || err.message || `Backend error ${res.status}`);
    }

    const data = await res.json();
    incrementRateLimit();
    return data.text || data.response || "";
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

const SYNTH_SYSTEM = `You are an academic paper revision assistant. Multiple peer reviewers have submitted feedback.

Synthesize ALL reviewer comments into a unified, theme-organized revision plan.

Critical rules:
- NEVER write "Reviewer 1 says..." or attribute concerns to specific reviewers in task text.
- Write every task as a clear, direct action the author should take.
- Where multiple reviewers raise the same concern, merge into ONE task — do not duplicate.
- Record which reviewers mentioned each concern in the sources array (for reference only).
- Write a concise 1-2 sentence summary per theme capturing the collective concern.

Return ONLY valid JSON — no markdown fences, no extra text:
{
  "themes": [
    {
      "themeName": "Methodology",
      "summary": "The experimental design needs clearer justification, particularly around sampling.",
      "tasks": [
        {
          "text": "Clarify the sampling methodology and justify its appropriateness in Section 3",
          "xp": 20,
          "importance": "major",
          "sources": ["Reviewer 1", "Reviewer 2"]
        }
      ]
    }
  ]
}

Theme names from: Methodology, Literature Review, Theory, Experiments, Writing Quality, Citations, Structure, Format, Contribution, Discussion.
Importance + XP (average ~15 XP per task): essential 25-35, major 18-24, moderate 13-18, minor 8-12, trivial 3-7.
Return only JSON.`;

async function parseAllFeedback(feedbackList) {
  const userMsg = "Synthesize the following reviewer feedback:\n\n" +
    feedbackList.map(f => `--- ${f.label} ---\n${f.text}`).join("\n\n");
  const text  = await callAPI(userMsg, SYNTH_SYSTEM);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI did not return valid JSON. Please try again.");
  return shapeResult(JSON.parse(match[0]));
}

async function parseSingleFeedback(text, label) {
  const userMsg = `Synthesize the following reviewer feedback:\n\n--- ${label} ---\n${text}`;
  const result  = await callAPI(userMsg, SYNTH_SYSTEM);
  const match   = result.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("AI did not return valid JSON. Please try again.");
  return shapeResult(JSON.parse(match[0]));
}

Object.assign(window, {
  C, LEVELS, IMPORTANCE_DOT, getLevel, generateId, getThemeColor,
  getDailyQuests, exportProgress, mergeIntoThemes, parseAllFeedback, parseSingleFeedback,
  getRateLimitState, canMakeRequest, RATE_LIMIT_MAX,
});
