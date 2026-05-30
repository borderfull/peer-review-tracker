// tracker-app.jsx — theme-centric App

const { useState, useEffect } = React;
const STORAGE_KEY = "reviewTracker_v4";

function App() {
  const C = window.C;

  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } })();

  const [mode,      setMode]      = useState(saved?.themes?.length ? "tracking" : "onboarding");
  const [themes,    setThemes]    = useState(saved?.themes    || []);
  const [showModal, setShowModal] = useState(false);
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [rateLimitState, setRateLimitState] = useState(window.getRateLimitState());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themes }));
  }, [themes]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitState(window.getRateLimitState());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOnboardingSubmit = (parsedThemes) => {
    setThemes(parsedThemes);
    setMode("tracking");
    setRateLimitState(window.getRateLimitState());
  };

  const mergeNewFeedback = newThemes => setThemes(prev => window.mergeIntoThemes(prev, newThemes));

  const startOver = () => {
    if (!window.confirm("Start fresh? This will clear all current progress.")) return;
    setThemes([]); setMode("onboarding");
  };

  // Toggle a task by themeId + taskId
  const toggleTask = (themeId, taskId) => {
    setThemes(prev => prev.map(th => {
      if (th.id !== themeId) return th;
      return { ...th, tasks: th.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) };
    }));
  };

  const totalXP   = themes.reduce((s,th) => s + th.tasks.reduce((ss,t) => ss+t.xp, 0), 0);
  const earnedXP  = themes.reduce((s,th) => s + th.tasks.filter(t=>t.done).reduce((ss,t) => ss+t.xp, 0), 0);
  const totalTasks = themes.reduce((s,th) => s + th.tasks.length, 0);
  const doneTasks  = themes.reduce((s,th) => s + th.tasks.filter(t=>t.done).length, 0);

  if (mode === "onboarding") {
    return <OnboardingPage onSubmit={handleOnboardingSubmit} />;
  }

  // Sort themes: incomplete first (by task count desc), complete last
  const sorted = [...themes].sort((a, b) => {
    const aDone = a.tasks.every(t => t.done);
    const bDone = b.tasks.every(t => t.done);
    if (aDone !== bDone) return aDone ? 1 : -1;
    return b.tasks.length - a.tasks.length;
  });

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"system-ui, -apple-system, sans-serif" }}>
      {/* Rate Limit Banner */}
      <RateLimitBanner state={rateLimitState} />

      <div style={{ maxWidth:700, margin:"0 auto", padding:"26px 18px 64px" }}>

        {/* Page header */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:22 }}>
          <div>
            <h1 style={{ margin:0, fontSize:20, fontFamily:"Georgia, serif", fontWeight:700, color:C.text, letterSpacing:"-0.01em" }}>
              Peer Review Tracker <span style={{ fontSize:13, fontWeight:400, color:C.textMuted, fontFamily:"system-ui, sans-serif" }}>(Experimental)</span>
            </h1>
            <p style={{ margin:"4px 0 0", fontSize:12, color:C.textMuted }}>
              Synthesised revision plan · progress auto-saved
            </p>
          </div>
          <div style={{ display:"flex", gap:8, flexShrink:0, alignItems:"center" }}>
            <button onClick={() => setShowEmailPopup(true)} title="Send feedback about this tool" style={{ padding:"6px 10px", borderRadius:6, border:`1px solid ${C.borderLight}`, background:"transparent", cursor:"pointer", fontSize:12, color:C.textMuted, transition:"all 0.2s", display:"flex", alignItems:"center", gap:4 }} onMouseEnter={e => e.currentTarget.style.borderColor = C.terra} onMouseLeave={e => e.currentTarget.style.borderColor = C.borderLight}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M1 1h10v7H1V1Zm0 7l2-2m8 2l-2-2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Feedback
            </button>
            <button onClick={startOver} style={{ padding:"8px 13px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surface, cursor:"pointer", fontSize:12.5, color:C.textMuted }}>
              Start Over
            </button>
            <button onClick={() => window.exportProgress(themes)} style={{ padding:"8px 14px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surface, cursor:"pointer", fontSize:12.5, color:C.text, display:"flex", alignItems:"center", gap:6 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1v7M3.5 5.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 10v1a1 1 0 001 1h9a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Export
            </button>
            <button onClick={() => setShowModal(true)} style={{ padding:"9px 18px", borderRadius:7, border:"none", background:C.terra, color:"white", fontSize:13.5, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
              + Add Feedback
            </button>
          </div>
        </div>

        {/* Summary card: intro + progress bar */}
        <TrackerSummary themes={themes} earnedXP={earnedXP} totalXP={totalXP} />

        {/* Daily quests */}
        <DailyQuests themes={themes} />

        {/* Stats row */}
        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", color:C.textMuted, marginBottom:12, display:"flex", justifyContent:"space-between" }}>
          <span>{themes.length} Theme{themes.length!==1?"s":""}</span>
          <span style={{ fontWeight:400 }}>{doneTasks}/{totalTasks} tasks complete</span>
        </div>

        {/* Theme cards */}
        {sorted.map(th => (
          <ThemeCard
            key={th.id}
            theme={th}
            onToggleTask={taskId => toggleTask(th.id, taskId)}
          />
        ))}

        {/* Importance legend */}
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginTop:20, padding:"12px 16px", borderRadius:8, background:C.surface, border:`1px solid ${C.borderLight}` }}>
          <span style={{ fontSize:11, fontWeight:600, color:C.textMuted, alignSelf:"center" }}>Importance:</span>
          {[
            { key:"essential", label:"Essential 25–35 XP" },
            { key:"major",     label:"Major 18–24 XP"     },
            { key:"moderate",  label:"Moderate 13–18 XP"  },
            { key:"minor",     label:"Minor 8–12 XP"      },
            { key:"trivial",   label:"Trivial 3–7 XP"     },
          ].map(({ key, label }) => (
            <div key={key} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span style={{ width:7, height:7, borderRadius:"50%", background:window.IMPORTANCE_DOT[key], display:"inline-block", flexShrink:0 }} />
              <span style={{ fontSize:11, color:C.textMuted }}>{label}</span>
            </div>
          ))}
          <span style={{ fontSize:11, color:C.textMuted, marginLeft:"auto", alignSelf:"center" }}>
            Source badges (R1, R2…) show which reviewers raised each concern
          </span>
        </div>

      </div>

      {showModal && (
        <AddFeedbackModal
          onMerge={mergeNewFeedback}
          onClose={() => setShowModal(false)}
        />
      )}

      {showEmailPopup && (
        <EmailPopup
          onClose={() => setShowEmailPopup(false)}
        />
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
