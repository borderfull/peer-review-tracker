// tracker-components.jsx — OnboardingPage, RateLimitBanner, TrackerSummary, DailyQuests, AddFeedbackModal

const { useState } = React;

/* ── Rate Limit Banner ──────────────────────────────────────────────────── */
function RateLimitBanner({ state }) {
  const C = window.C;
  const { used, resetTime } = state;
  const max = window.RATE_LIMIT_MAX;
  const isLimited = used >= max;
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
              {isLimited ? "Daily limit reached" : `You have used ${used} out of ${max} daily requests`}
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
function OnboardingPage({ onSubmit }) {
  const C = window.C;
  const [feedbacks, setFeedbacks] = useState(["", ""]);
  const [parsing, setParsing] = useState(false);
  const [parseStatus, setParseStatus] = useState("");
  const [error, setError] = useState("");

  const addReviewer = () => setFeedbacks((f) => [...f, ""]);
  const setFeedback = (i, v) => setFeedbacks((f) => f.map((x, j) => j === i ? v : x));
  const removeFeedback = (i) => setFeedbacks((f) => f.filter((_, j) => j !== i));

  const handleSubmit = async () => {
    const active = feedbacks.map((f, i) => ({ text: f.trim(), label: `Reviewer ${i + 1}` })).filter((f) => f.text);
    if (!active.length) {setError("Please paste at least one reviewer's feedback.");return;}
    if (!window.canMakeRequest()) {setError("Daily limit reached. Check back tomorrow at midnight UTC.");return;}
    setParsing(true);setError("");
    try {
      setParseStatus(`Synthesising ${active.length} reviewer${active.length > 1 ? "s" : ""}…`);
      const themes = await window.parseAllFeedback(active);
      onSubmit(themes);
    } catch (e) {
      setError(e.message === "__RATE_LIMIT__" ?
      "☕ You've hit the daily limit — check back tomorrow at midnight UTC." :
      e.message || "Something went wrong. Please try again.");
    } finally {setParsing(false);setParseStatus("");}
  };

  const canSubmit = !parsing && feedbacks.some((f) => f.trim());
  const field = { width: "100%", padding: "10px 13px", borderRadius: 7, border: `1px solid ${C.border}`, fontSize: 13.5, background: C.surface, color: C.text, boxSizing: "border-box", fontFamily: "inherit" };
  const rlState = window.getRateLimitState();
  const remaining = Math.max(0, window.RATE_LIMIT_MAX - rlState.used);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "48px 20px 80px" }}>
      <div style={{ width: "100%", maxWidth: 620 }}>

        {/* Header */}
        <div style={{ marginBottom: 36, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", width: 60, height: 60, borderRadius: 14, background: C.terra, marginBottom: 18, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <svg viewBox="0 0 28 28" width="30" height="30" fill="none">
              <path d="M4 2h14l6 6v18a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z" fill="rgba(255,255,255,0.22)" />
              <path d="M18 2l6 6h-5a1 1 0 01-1-1V2z" fill="rgba(255,255,255,0.22)" />
              <rect x="7" y="11" width="14" height="2"   rx="1" fill="white" opacity="0.95" />
              <rect x="7" y="16" width="10" height="1.8" rx="0.9" fill="white" opacity="0.6"  />
              <rect x="7" y="21" width="12" height="1.8" rx="0.9" fill="white" opacity="0.6"  />
            </svg>
          </div>
          <h1 style={{ margin: "0 0 6px", fontSize: 26, fontFamily: "Georgia, serif", fontWeight: 700, color: C.text, letterSpacing: "-0.01em" }}>
            Peer Review Tracker <span style={{ fontSize: 14, fontWeight: 400, color: C.textMuted, fontFamily: "system-ui, sans-serif", letterSpacing: "0.03em" }}>(Experimental)</span>
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: C.textMuted, lineHeight: 1.65, maxWidth: 440, marginInline: "auto" }}>Paste all your reviewer feedback below. The AI will synthesize it into a unified, theme-based revision plan in clear tasks to work through.

          </p>

          {/* Claude AI Disclaimer */}
          <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 8, background: "oklch(98% 0.015 260)", border: `1px solid oklch(88% 0.04 260)`, maxWidth: 440, marginInline: "auto" }}>
            <p style={{ margin: 0, fontSize: 12, color: "oklch(40% 0.08 258)", lineHeight: 1.6 }}>
              <strong>Powered by Claude AI:</strong> This tool uses Claude Sonnet 4.6 to analyze and organize your reviewer feedback. Your feedback text is sent to Anthropic's servers for processing. Please review Anthropic's <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "oklch(45% 0.12 258)", textDecoration: "underline" }}>privacy policy</a> before proceeding.
            </p>
          </div>
        </div>

        {/* Reviewer Feedback */}
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "20px 22px", marginBottom: 16, boxShadow: `0 1px 4px oklch(0% 0 0 / 0.06)` }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.textMuted, marginBottom: 18 }}>
            Reviewer Feedback
          </label>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {feedbacks.map((fb, i) =>
            <div key={i}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.terra, letterSpacing: "0.04em" }}>Reviewer {i + 1}</span>
                  {feedbacks.length > 1 &&
                <button onClick={() => removeFeedback(i)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 13, color: C.textMuted, padding: "0 2px" }}>Remove</button>
                }
                </div>
                <textarea
                value={fb} onChange={(e) => setFeedback(i, e.target.value)}
                placeholder={`Paste Reviewer ${i + 1}'s full comments here…`}
                style={{ ...field, height: 160, lineHeight: 1.65, resize: "vertical", fontFamily: "Georgia, serif", fontSize: 13 }} />
              
              </div>
            )}
          </div>
          <button
            onClick={addReviewer}
            style={{ marginTop: 14, background: "none", border: `1px dashed ${C.border}`, borderRadius: 7, cursor: "pointer", width: "100%", padding: "9px", fontSize: 13, color: C.textMuted }}
            onMouseEnter={(e) => e.currentTarget.style.background = C.terraBg}
            onMouseLeave={(e) => e.currentTarget.style.background = "none"}>
            
            + Add another reviewer
          </button>
        </div>

        {error &&
        <div style={{ padding: "11px 14px", borderRadius: 8, marginBottom: 14, fontSize: 13, lineHeight: 1.55, background: "oklch(96% 0.04 40)", border: `1px solid oklch(85% 0.09 40)`, color: "oklch(36% 0.12 35)" }}>
            {error}
          </div>
        }

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 12, color: remaining === 0 ? "oklch(36% 0.12 35)" : C.textMuted }}>
            {remaining === 0
              ? "You've used today's allowance — come back tomorrow"
              : <><strong style={{ color: remaining <= 1 ? C.terra : C.text }}>{remaining}</strong> tracker build{remaining !== 1 ? "s" : ""} left for you today</>
            }
          </span>
          <div style={{ display: "flex", gap: 4 }}>
            {Array.from({ length: window.RATE_LIMIT_MAX }).map((_, i) => (
              <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < rlState.used ? (remaining === 0 ? "oklch(50% 0.14 40)" : C.terra) : C.borderLight, transition: "background 0.2s" }} />
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit} disabled={!canSubmit}
          style={{
            width: "100%", padding: "15px", borderRadius: 9, border: "none",
            background: canSubmit ? C.terra : C.border, color: "white",
            fontSize: 15, fontWeight: 700, cursor: canSubmit ? "pointer" : "default",
            letterSpacing: "0.02em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            boxShadow: canSubmit ? `0 4px 18px oklch(0% 0 0 / 0.14)` : "none",
            transition: "background 0.2s, box-shadow 0.2s"
          }}>
          
          {parsing && <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />}
          {parsing ? parseStatus || "Synthesising…" : "Synthesise & Build Tracker"}
        </button>
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
        <>Work through them at your own pace, or follow today's suggestions below.</>}
      </p>
      <ProgressBar earned={earnedXP} total={totalXP} />
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
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", textTransform: "uppercase", color: C.terraDark }}>Today's Suggested Tasks</span>
        <span style={{ fontSize: 11, color: C.textMuted, marginLeft: "auto" }}>{today}</span>
      </div>
      <div style={{ padding: "11px 14px", borderRadius: 8, marginBottom: 8, background: C.amberLight, border: `1px solid ${C.amber}` }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.terraDark, marginBottom: 5 }}>High Priority · +{boss.xp} XP</div>
        <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.55 }}>{boss.text}</div>
        <div style={{ fontSize: 11, color: C.textMuted, marginTop: 5 }}>{boss.themeName}</div>
      </div>
      {side.map((q, i) =>
      <div key={q.id || i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: "9px 14px", borderRadius: 8, marginBottom: 6, background: C.surface, border: `1px solid ${C.borderLight}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13.5, color: C.text, lineHeight: 1.5 }}>{q.text}</div>
            <div style={{ fontSize: 11, color: C.textMuted, marginTop: 3 }}>{q.themeName}</div>
          </div>
          <span style={{ fontSize: 10.5, fontWeight: 700, flexShrink: 0, padding: "2px 8px", borderRadius: 4, background: C.sageLight, color: C.sage, border: `1px solid oklch(82% 0.06 145)` }}>+{q.xp} XP</span>
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
          <h2 style={{ margin: 0, fontSize: 17, fontFamily: "Georgia, serif", color: C.text }}>Add More Feedback</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1 }}>×</button>
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
            {loading ? "Synthesising…" : "Add & Merge"}
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
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: C.textMuted, lineHeight: 1 }}>×</button>
        </div>

        <p style={{ margin: "0 0 18px", fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>
          We'd love to hear your thoughts about the Peer Review Tracker! Send your feedback directly to:
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