// tracker-app.jsx — theme-centric App

const { useState, useEffect, useRef } = React;

/* ── Error Boundary ─────────────────────────────────────────────────────── */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      const C = window.C || {};
      return (
        <div style={{ minHeight: "100vh", background: C.bg || "#f6f4f0", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ maxWidth: 480, textAlign: "center" }}>
            <div aria-hidden="true" style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: 20, color: C.text || "#1e1a14", marginBottom: 10 }}>Something went wrong</h2>
            <p style={{ fontSize: 14, color: C.textMuted || "#7a7060", lineHeight: 1.65, marginBottom: 24 }}>
              An unexpected error occurred. Your progress is saved — try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: "10px 22px", borderRadius: 8, border: "none", background: C.terra || "#9b3e1e", color: "white", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
              Refresh page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
const STORAGE_KEY = "reviewTracker_v4";

/* ── "More" menu: holds the less-used actions ───────────────────────────── */
function MoreMenu({ items }) {
  const C = window.C;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const esc = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); };
  }, [open]);
  return (
    <div ref={ref} style={{ position:"relative" }}>
      <button type="button" aria-label="More actions" aria-expanded={open} onClick={() => setOpen(o => !o)}
        style={{ padding:"8px 11px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surface, cursor:"pointer", fontSize:14, lineHeight:1, color:C.text }}>
        •••
      </button>
      {open && (
        <div style={{ position:"absolute", right:0, top:"calc(100% + 6px)", minWidth:190, background:C.surface, border:`1px solid ${C.border}`, borderRadius:8, boxShadow:"0 10px 30px oklch(0% 0 0 / 0.12)", padding:4, zIndex:50 }}>
          {items.map(it => (
            <button key={it.label} type="button" onClick={() => { setOpen(false); it.onClick(); }}
              style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 12px", borderRadius:6, border:"none", background:"transparent", cursor:"pointer", fontSize:13, color: it.danger ? "oklch(42% 0.13 32)" : C.text }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const C = window.C;

  const saved = (() => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; } })();

  const [mode,      setMode]      = useState(saved?.themes?.length ? "tracking" : "onboarding");
  const [themes,    setThemes]    = useState(saved?.themes    || []);
  const [isExample, setIsExample] = useState(!!saved?.isExample);
  const [showModal, setShowModal] = useState(false);
  const [showEmailPopup, setShowEmailPopup] = useState(false);
  const [rateLimitState, setRateLimitState] = useState(window.getRateLimitState());

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ themes, isExample })); } catch {}
  }, [themes, isExample]);

  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitState(window.getRateLimitState());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOnboardingSubmit = (parsedThemes) => {
    setThemes(parsedThemes);
    setIsExample(false);
    setMode("tracking");
    setRateLimitState(window.getRateLimitState());
  };

  const showExample = () => {
    window.track("example_viewed");
    setThemes(window.getSampleThemes());
    setIsExample(true);
    setMode("tracking");
    window.scrollTo(0, 0);
  };

  const mergeNewFeedback = newThemes => { setThemes(prev => window.mergeIntoThemes(prev, newThemes)); setIsExample(false); };

  const leaveExample = () => { window.track("example_to_own_plan"); setThemes([]); setIsExample(false); setMode("onboarding"); window.scrollTo(0, 0); };

  const startOver = () => {
    if (!window.confirm("Start a new plan? This clears your current tasks and progress.")) return;
    window.track("plan_reset");
    setThemes([]); setIsExample(false); setMode("onboarding");
  };

  const toggleTask = (themeId, taskId) => {
    const task = themes.find(th => th.id === themeId)?.tasks.find(t => t.id === taskId);
    if (task && !task.done) window.track("task_completed", { example: isExample });
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
    return (
      <div style={{ background:C.bg, minHeight:"100vh", fontFamily:"system-ui, -apple-system, sans-serif" }}>
        <PortfolioLink />
        <OnboardingPage onSubmit={handleOnboardingSubmit} onExample={showExample} />
      </div>
    );
  }

  const sorted = [...themes].sort((a, b) => {
    const aDone = a.tasks.every(t => t.done);
    const bDone = b.tasks.every(t => t.done);
    if (aDone !== bDone) return aDone ? 1 : -1;
    return b.tasks.length - a.tasks.length;
  });

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"system-ui, -apple-system, sans-serif" }}>
      <PortfolioLink />
      <RateLimitBanner state={rateLimitState} />

      {isExample && (
        <div style={{ background:C.amberLight, borderBottom:`1px solid ${C.amber}`, padding:"10px 16px" }}>
          <div style={{ maxWidth:700, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
            <span style={{ fontSize:13, color:C.text }}>
              <strong>This is an example plan.</strong> Tick a few tasks to see how it works.
            </span>
            <button type="button" onClick={leaveExample}
              style={{ padding:"7px 14px", borderRadius:7, border:"none", background:C.terra, color:"white", fontSize:13, fontWeight:600, cursor:"pointer" }}>
              Make my own plan
            </button>
          </div>
        </div>
      )}

      <div style={{ maxWidth:700, margin:"0 auto", padding:"14px 16px 64px" }}>

        {/* Page header */}
        <div className="hdr" style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, marginBottom:22 }}>
          <div>
            <h1 style={{ margin:0, fontSize:21, fontFamily:"Georgia, serif", fontWeight:700, color:C.text, letterSpacing:"-0.01em" }}>
              Your revision plan
            </h1>
            <p style={{ margin:"4px 0 0", fontSize:12.5, color:C.textMuted }}>
              Peer Review Planner · progress saves automatically in this browser
            </p>
          </div>
          <div className="hdr-actions" style={{ display:"flex", gap:8, flexShrink:0, alignItems:"center" }}>
            <button type="button" onClick={() => { window.track("plan_exported", { example: isExample }); window.exportProgress(themes); }} style={{ padding:"8px 13px", borderRadius:7, border:`1px solid ${C.border}`, background:C.surface, cursor:"pointer", fontSize:12.5, color:C.text, display:"flex", alignItems:"center", gap:6 }}>
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
                <path d="M6.5 1v7M3.5 5.5l3 3 3-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M1 10v1a1 1 0 001 1h9a1 1 0 001-1v-1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
              Export
            </button>
            <button type="button" onClick={() => setShowModal(true)} style={{ padding:"9px 16px", borderRadius:7, border:"none", background:C.terra, color:"white", fontSize:13.5, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" }}>
              + Add reviews
            </button>
            <MoreMenu items={[
              { label: "Send feedback about this tool", onClick: () => { window.track("feedback_opened"); setShowEmailPopup(true); } },
              { label: "Start a new plan", onClick: isExample ? leaveExample : startOver, danger: !isExample },
            ]} />
          </div>
        </div>

        <TrackerSummary themes={themes} earnedXP={earnedXP} totalXP={totalXP} />

        <DailyQuests themes={themes} />

        <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.09em", textTransform:"uppercase", color:C.textMuted, marginBottom:12, display:"flex", justifyContent:"space-between" }}>
          <span>{themes.length} Theme{themes.length!==1?"s":""}</span>
          <span style={{ fontWeight:400 }}>{doneTasks}/{totalTasks} tasks done</span>
        </div>

        {sorted.map(th => (
          <ThemeCard
            key={th.id}
            theme={th}
            onToggleTask={taskId => toggleTask(th.id, taskId)}
          />
        ))}

        {/* Legend */}
        <div style={{ display:"flex", gap:14, flexWrap:"wrap", marginTop:20, padding:"12px 16px", borderRadius:8, background:C.surface, border:`1px solid ${C.borderLight}` }}>
          <span style={{ fontSize:11.5, fontWeight:600, color:C.textMuted, alignSelf:"center" }}>Importance:</span>
          {[
            { key:"essential", label:"Essential" },
            { key:"major",     label:"Major"     },
            { key:"moderate",  label:"Moderate"  },
            { key:"minor",     label:"Minor"     },
            { key:"trivial",   label:"Trivial"   },
          ].map(({ key, label }) => (
            <div key={key} style={{ display:"flex", alignItems:"center", gap:5 }}>
              <span aria-hidden="true" style={{ width:7, height:7, borderRadius:"50%", background:window.IMPORTANCE_DOT[key], display:"inline-block", flexShrink:0 }} />
              <span style={{ fontSize:11.5, color:C.textMuted }}>{label}</span>
            </div>
          ))}
          <span className="legend-note" style={{ fontSize:11.5, color:C.textMuted, marginLeft:"auto", alignSelf:"center" }}>
            R1, R2… show which reviewers raised a point · pts weight bigger tasks more
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
