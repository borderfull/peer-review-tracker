// tracker-components.jsx — OnboardingPage, RateLimitBanner, TrackerSummary, DailyQuests, AddFeedbackModal

const { useState } = React;

/* ── Rate Limit Banner ──────────────────────────────────────────────────── */
function RateLimitBanner({ state }) {
  const C = window.C;
  const { used, resetTime } = state;
  const max = window.RATE_LIMIT_MAX;
  const isLimited = used >= max;
  // Only speak up once the limit is actually reached
  if (!isLimited) return null;
  const pct = used / max * 100;

  const now = Date.now();
  const msUntilReset = Math.max(0, resetTime - now);
  const hoursUntilReset = Math.ceil(msUntilReset / (1000 * 60 * 60));

  return (
    <div style={{ background: isLimited ? "oklch(96% 0.04 40)" : C.terraBg, borderBottom: `1px solid ${isLimited ? "oklch(85% 0.09 40)" : C.terraLight}`, padding: "12px 18px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: isLimited ? "oklch(36% 0.12 35)" : C.terraDark, letterSpacing: "0.04em" }}>
              You've used today's plan builds. Your current plan still works as normal.
            </span>
            {isLimited &&
            <span style={{ fontSize: 11, color: "oklch(36% 0.12 35)" }}>
                Check back in {hoursUntilReset}h
              </span>
            }
          </div>
          <div style={{ height: 5, borderRadius: 3, background: isLimited ? "oklch(88% 0.06 40)" : "oklch(88% 0.06 35)", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              borderRadius: 3,
              background: isLimited ? "oklch(50% 0.14 40)" : "oklch(55% 0.14 32)",
              width: `${Math.min(pct, 100)}%`,
              transition: "width 0.3s ease"
            }} />
          </div>
        </div>
      </div>
    </div>);

}

/* ── Onboarding Page ─────────────────────────────────────────────────────── */
function OnboardingPage({ onSubmit, onExample }) {
  const C = window.C;
  // Start with ONE box: most people have a single decision letter
  const [feedbacks, setFeedbacks] = useState(() => [{ id: crypto.randomUUID(), text: "" }]);
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState("");
  const [error, setError] = useState("");

  const single = feedbacks.length === 1;
  const addReviewer = () => { window.track("reviewer_box_added"); setFeedbacks((f) => [...f, { id: crypto.randomUUID(), text: "" }]); };
  const setFeedback = (id, v) => setFeedbacks((f) => f.map((x) => x.id === id ? { ...x, text: v } : x));
  const removeFeedback = (id) => setFeedbacks((f) => f.filter((x) => x.id !== id));

  const handleSubmit = async () => {
    const active = feedbacks
      .map((f, i) => ({ text: f.text.trim(), label: single ? "All reviewers (identify each reviewer from the text)" : `Reviewer ${i + 1}` }))
      .filter((f) => f.text);
    if (!active.length) { setError("Paste your reviewer comments first."); return; }
    if (!window.canMakeRequest()) { setError("You've used today's plan builds. Come back tomorrow, or try the example in the meantime."); return; }
    setParsing(true); setError("");
    try {
      setParseStatus("Reading the comments and grouping them into tasks…");
      window.track("plan_build_started", { boxes: active.length });
      const themes = await window.parseAllFeedback(active);
      window.track("plan_built", { themes: themes.length, tasks: themes.reduce((s, th) => s + th.tasks.length, 0) });
      onSubmit(themes);
    } catch (e) {
      window.track("plan_build_failed", { reason: e.message === "__RATE_LIMIT__" ? "rate_limit" : "error" });
      setError(e.message === "__RATE_LIMIT__" ?
        "You've used today's plan builds. Come back tomorrow, or try the example in the meantime." :
        e.message || "Something went wrong. Please try again.");
    } finally { setParsing(false); setParseStatus(""); }
  };

  const canSubmit = !parsing && feedbacks.some((f) => f.text.trim());
  const field = { width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13.5, background: C.surface, color: C.text, boxSizing: "border-box", fontFamily: "inherit" };
  const remaining = Math.max(0, window.RATE_LIMIT_MAX - window.getRateLimitState().used);

  const steps = [
    { n: "1", t: "Paste", d: "your decision letter or reviewer comments" },
    { n: "2", t: "Get a plan", d: "grouped by theme, duplicates merged" },
    { n: "3", t: "Tick off tasks", d: "progress saves in this browser" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "44px 16px 80px", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 620 }}>

        {/* Hero */}
        <div style={{ marginBottom: 28, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div aria-hidden="true" style={{ display: "flex", width: 56, height: 56, borderRadius: 14, background: C.terra, marginBottom: 16, alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 28 28" width="30" height="30" fill="none">
              <rect x="4" y="5" width="5" height="5" rx="1.2" fill="white" />
              <path d="M5.2 7.5l1.2 1.2 2-2.3" stroke="oklch(55% 0.14 32)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="12" y="6.6" width="12" height="1.8" rx="0.9" fill="white" />
              <rect x="4" y="12" width="5" height="5" rx="1.2" fill="white" />
              <path d="M5.2 14.5l1.2 1.2 2-2.3" stroke="oklch(55% 0.14 32)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="12" y="13.6" width="9" height="1.8" rx="0.9" fill="white" />
              <rect x="4.6" y="19.6" width="3.8" height="3.8" rx="1" stroke="white" strokeWidth="1.2" />
              <rect x="12" y="20.6" width="11" height="1.8" rx="0.9" fill="white" opacity="0.6" />
            </svg>
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.terraDark, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
            Peer Review Planner
          </div>
          <h1 style={{ margin: "0 0 12px", fontSize: "clamp(24px, 5vw, 32px)", lineHeight: 1.2, fontFamily: "Georgia, serif", fontWeight: 700, color: C.text, letterSpacing: "-0.015em", maxWidth: 520 }}>
            Turn reviewer comments into a revision checklist
          </h1>
          <p style={{ margin: "0 0 18px", fontSize: 15, color: C.textMuted, lineHeight: 1.6, maxWidth: 470 }}>
            Paste your reviews and get one clear plan: concerns grouped by theme, duplicates merged, and every comment rewritten as a task you can tick off.
          </p>
          <button type="button" onClick={onExample}
            style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.text, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            See an example plan →
          </button>
        </div>

        {/* How it works */}
        <ol style={{ listStyle: "none", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 22 }}>
          {steps.map((s) => (
            <li key={s.n} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px", borderRadius: 8, background: C.surface2, border: `1px solid ${C.borderLight}` }}>
              <span aria-hidden="true" style={{ width: 20, height: 20, borderRadius: "50%", background: C.terraBg, border: `1px solid ${C.terraLight}`, color: C.terraDark, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</span>
              <span style={{ fontSize: 12.5, color: C.textMuted, lineHeight: 1.45 }}><strong style={{ color: C.text }}>{s.t}</strong> {s.d}</span>
            </li>
          ))}
        </ol>

        {/* Paste area */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 20px", marginBottom: 14, boxShadow: `0 1px 4px oklch(0% 0 0 / 0.06)` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {feedbacks.map((fb, i) =>
              <div key={fb.id}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 7 }}>
                  <label htmlFor={`fb-${fb.id}`} style={{ fontSize: 13, fontWeight: 600, color: single ? C.text : C.terraDark }}>
                    {single ? "Reviewer comments" : `Reviewer ${i + 1}`}
                  </label>
                  {!single &&
                    <button type="button" onClick={() => removeFeedback(fb.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12.5, color: C.textMuted, padding: "0 2px" }}>Remove</button>}
                </div>
                <textarea
                  id={`fb-${fb.id}`}
                  value={fb.text} onChange={(e) => setFeedback(fb.id, e.target.value)}
                  placeholder={single
                    ? "Paste the whole decision letter or all reviewer comments here. No need to split them up: the planner works out which reviewer said what."
                    : `Paste Reviewer ${i + 1}'s comments here…`}
                  style={{ ...field, height: single ? 220 : 150, lineHeight: 1.65, resize: "vertical", fontFamily: "Georgia, serif" }} />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={addReviewer}
            style={{ marginTop: 12, background: "none", border: `1px dashed ${C.border}`, borderRadius: 7, cursor: "pointer", width: "100%", padding: "9px", fontSize: 13, color: C.textMuted }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.terraBg}
            onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
            {single ? "Prefer to paste each reviewer separately? Add a box" : "+ Add another reviewer"}
          </button>
        </div>

        {error &&
          <div role="alert" style={{ padding: "11px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13, lineHeight: 1.55, background: "oklch(96% 0.04 40)", border: `1px solid oklch(85% 0.09 40)`, color: "oklch(36% 0.12 35)" }}>
            {error}
          </div>}

        {remaining === 0 && !error &&
          <p style={{ fontSize: 12.5, color: "oklch(36% 0.12 35)", marginBottom: 10, textAlign: "center" }}>
            You've used today's plan builds. Come back tomorrow, or look at the example in the meantime.
          </p>}

        <button
          type="button"
          onClick={handleSubmit} disabled={!canSubmit}
          style={{
            width: "100%", padding: "15px", borderRadius: 9, border: "none",
            background: canSubmit ? C.terra : C.border, color: canSubmit ? "white" : C.textMuted,
            fontSize: 15.5, fontWeight: 700, cursor: canSubmit ? "pointer" : "default",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: canSubmit ? `0 4px 18px oklch(0% 0 0 / 0.14)` : "none",
            transition: "background 0.2s, box-shadow 0.2s"
          }}>
          {parsing && <span aria-hidden="true" style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
          {parsing ? parseStatus || "Building your plan…" : "Make my revision plan"}
        </button>

        {/* Privacy, short and calm, after the action */}
        <p style={{ margin: "14px auto 0", maxWidth: 480, fontSize: 12, color: C.textMuted, lineHeight: 1.6, textAlign: "center" }}>
          Your text is sent to Anthropic's Claude to build the plan. This site doesn't store it, and your plan stays in this browser.{" "}
          <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: C.terraDark }}>Privacy policy</a>
        </p>
      </div>
    </div>);
}

/* ── Tracker Summary (intro + progress bar) ──────────────────────────────── */
function TrackerSummary({ themes, earnedXP, totalXP }) {
  const C = window.C;
  const totalTasks = themes.reduce((s, th) => s + th.tasks.length, 0);
  const doneTasks = themes.reduce((s, th) => s + th.tasks.filter((t) => t.done).length, 0);

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 22px", marginBottom: 20, boxShadow: `0 1px 4px oklch(0% 0 0 / 0.05)` }}>
      <p style={{ fontSize: 13.5, color: C.text, lineHeight: 1.65, margin: "0 0 16px", fontFamily: "Georgia, serif" }}>
        Your revision plan covers <strong>{totalTasks} tasks</strong> across <strong>{themes.length} theme{themes.length !== 1 ? "s" : ""}</strong>.{" "}
        {doneTasks > 0 ?
        <>{doneTasks} completed so far — keep going.</> :
        <>Work through them in any order, or start with today's picks below.</>}
      </p>
      <ProgressBar earned={earnedXP} total={totalXP} doneTasks={doneTasks} totalTasks={totalTasks} />
    </div>);

}

/* ── Daily Quests ─────────────────────────────────────────────────────────── */
function DailyQuests({ themes }) {
  const C = window.C;
  const quests = window.getDailyQuests(themes);
  if (!quests.length) return null;
  const boss = quests[0];
  const side = quests.slice(1);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });

  return (
    <div style={{ background: C.terraBg, border: `1px solid ${C.terraLight}`, borderRadius: 10, padding: "16px 18px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1l1.6 3.2 3.5.5-2.55 2.48.6 3.52L7 9l-3.15 1.7.6-3.52L2 4.7l3.5-.5L7 1z" fill={C.amber} stroke={C.terra} strokeWidth="0.5" />
        </svg>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: C.terraDark }}>Today's picks</span>
        <span style={{ fontSize: 11, color: C.textMuted, marginLeft: "auto" }}>{today}</span>
      </div>
      <div style={{ padding: "11px 14px", borderRadius: 8, marginBottom: 8, background: C.amberLight, border: `1px solid ${C.amber}` }}>
        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.terraDark, marginBottom: 5 }}>Start here · high priority</div>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>{boss.text}</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>{boss.themeName}</div>
      </div>
      {side.map((q, i) =>
      <div key={q.id || i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, flexWrap: "wrap", padding: "9px 14px", borderRadius: 8, marginBottom: 6, background: C.surface, border: `1px solid ${C.borderLight}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>{q.text}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{q.themeName}</div>
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, flexShrink: 0, padding: "2px 8px", borderRadius: 4, background: C.sageLight, color: C.sage, border: `1px solid oklch(82% 0.06 145)` }}>Quick win</span>
        </div>
      )}
    </div>);

}

/* ── Add Feedback Modal (post-onboarding) ─────────────────────────────────── */
function AddFeedbackModal({ onMerge, onClose }) {
  const C = window.C;
  const [label, setLabel] = useState("");
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!feedback.trim() || loading) return;
    if (!window.canMakeRequest()) {setError("Daily limit reached. Check back tomorrow at midnight UTC.");return;}
    setLoading(true);setError("");
    try {
      const lbl = label.trim() || `Additional Reviewer`;
      const themes = await window.parseSingleFeedback(feedback.trim(), lbl);
      window.track("reviews_added", { themes: themes.length });
      onMerge(themes);onClose();
    } catch (e) {
      setError(e.message === "__RATE_LIMIT__" ? "☕ Daily limit reached — check back tomorrow at midnight UTC." : e.message || "Something went wrong.");
    } finally {setLoading(false);}
  };

  const field = { width: "100%", padding: "10px 13px", borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13.5, background: C.surface, color: C.text, boxSizing: "border-box", fontFamily: "inherit" };

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "oklch(0% 0 0 / 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 12, width: "100%", maxWidth: 540, padding: 28, boxShadow: "0 24px 64px oklch(0% 0 0 / 0.18)", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontFamily: "Georgia, serif", color: C.text }}>Add more reviews</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted, marginBottom: 6 }}>Reviewer label (optional)</label>
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Reviewer 3, Editor, etc." style={{ ...field }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted, marginBottom: 6 }}>Feedback</label>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Paste the reviewer's comments here…" style={{ ...field, height: 190, lineHeight: 1.65, resize: "vertical", fontFamily: "Georgia, serif" }} />
        </div>
        {error && <div style={{ padding: "10px 14px", borderRadius: 7, marginBottom: 14, fontSize: 13, lineHeight: 1.5, background: "oklch(96% 0.04 40)", border: `1px solid oklch(85% 0.09 40)`, color: "oklch(36% 0.12 35)" }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ padding: "10px 18px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface2, cursor: "pointer", fontSize: 14, color: C.text }}>Cancel</button>
          <button onClick={handleAdd} disabled={loading || !feedback.trim()} style={{ padding: "10px 22px", borderRadius: 7, border: "none", background: loading || !feedback.trim() ? C.border : C.terra, color: "white", cursor: loading || !feedback.trim() ? "default" : "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", gap: 8 }}>
            {loading && <span style={{ display: "inline-block", width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
            {loading ? "Adding to your plan…" : "Add to my plan"}
          </button>
        </div>
      </div>
    </div>);

}

/* ── Email Popup ────────────────────────────────────────────────────────── */
function EmailPopup({ onClose }) {
  const C = window.C;
  const email = "ptomar@tlu.ee";

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "oklch(0% 0 0 / 0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.surface, borderRadius: 12, width: "100%", maxWidth: 420, padding: 28, boxShadow: "0 24px 64px oklch(0% 0 0 / 0.18)", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontFamily: "Georgia, serif", color: C.text }}>Send Feedback</h2>
          <button type="button" aria-label="Close" onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1 }}>×</button>
        </div>

        <p style={{ margin: "0 0 18px", fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>
          We'd love to hear what you think of the Peer Review Planner. Send your feedback directly to:
        </p>

        <div style={{ padding: "16px 14px", borderRadius: 8, background: C.terraBg, border: `1px solid ${C.terraLight}`, marginBottom: 20, textAlign: "center" }}>
          <a href={`mailto:${email}`} style={{ fontSize: 15, fontWeight: 600, color: C.terra, textDecoration: "none", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 2h12c.55 0 1 .45 1 1v8c0 .55-.45 1-1 1H1c-.55 0-1-.45-1-1V3c0-.55.45-1 1-1z" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
              <path d="M1 3l6 4 6-4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {email}
          </a>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.6, textAlign: "center" }}>
          Share your suggestions, report bugs, or let us know what's working well for you.
        </p>

        <button onClick={onClose} style={{ marginTop: 20, width: "100%", padding: "10px 18px", borderRadius: 7, border: `1px solid ${C.border}`, background: C.surface2, cursor: "pointer", fontSize: 14, color: C.text, fontWeight: 500 }}>
          Close
        </button>
      </div>
    </div>
  );
}

Object.assign(window, { OnboardingPage, RateLimitBanner, TrackerSummary, DailyQuests, AddFeedbackModal, EmailPopup });