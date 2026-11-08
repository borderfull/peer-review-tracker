// tracker-parts.jsx — ProgressBar, SourceBadges, ImportanceDot, XPBadge, TaskItem, ThemeCard

const { useState } = React;

/* ── Progress Bar: tasks first, points secondary ─────────────────────────── */
function ProgressBar({ earned, total, doneTasks, totalTasks }) {
  const C   = window.C;
  const pct = total > 0 ? earned / total : 0;
  const { level, nextLevel } = window.getLevel(earned, total);

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", gap:12, flexWrap:"wrap", marginBottom:10 }}>
        <span style={{ fontSize:15, fontWeight:700, fontFamily:"Georgia, serif", color:C.text }}>
          <span style={{ fontVariantNumeric:"tabular-nums" }}>{doneTasks}</span> of {totalTasks} tasks done
        </span>
        <span style={{ fontSize:12.5, color:C.textMuted }}>
          Stage: <strong style={{ color:C.terraDark }}>{level.name}</strong>
        </span>
      </div>

      <div role="progressbar" aria-label="Revision progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct*100)}
        style={{ height:9, borderRadius:5, background:C.borderLight, overflow:"hidden", marginBottom:8 }}>
        <div style={{
          height:"100%", borderRadius:5,
          background: `linear-gradient(90deg, ${C.terra}, oklch(60% 0.14 42))`,
          width:`${pct * 100}%`,
          transition:"width 0.5s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>

      <div style={{ display:"flex", justifyContent:"space-between", gap:12, flexWrap:"wrap", fontSize:12, color:C.textMuted }}>
        <span>{Math.round(pct * 100)}% of the work, weighted by importance · {earned}/{total} pts</span>
        {nextLevel
          ? <span>Next: {nextLevel.name}</span>
          : <span style={{ color:C.sage, fontWeight:600 }}>Every task is done</span>}
      </div>
    </div>
  );
}

/* ── Source Badges ───────────────────────────────────────────────────────── */
function SourceBadges({ sources }) {
  const C = window.C;
  if (!sources || !sources.length) return null;
  const labels = sources.map(s => s.replace(/reviewer\s*/i, "R"));
  return (
    <span style={{ display:"flex", gap:3, alignItems:"center", flexShrink:0 }} aria-label={`Raised by ${sources.join(", ")}`}>
      {labels.map(l => (
        <span key={l} aria-hidden="true" style={{
          fontSize:10, padding:"1px 5px", borderRadius:3, fontWeight:600, letterSpacing:"0.02em",
          background:C.surface2, border:`1px solid ${C.borderLight}`, color:C.textMuted,
        }}>
          {l}
        </span>
      ))}
    </span>
  );
}

/* ── Importance Dot ──────────────────────────────────────────────────────── */
function ImportanceDot({ importance }) {
  const labels = { essential:"Essential", major:"Major", moderate:"Moderate", minor:"Minor", trivial:"Trivial" };
  return (
    <span title={labels[importance] || importance} aria-label={`${labels[importance] || importance} importance`} style={{
      display:"inline-block", width:7, height:7, borderRadius:"50%", flexShrink:0, marginTop:6,
      background: window.IMPORTANCE_DOT[importance] || window.IMPORTANCE_DOT.moderate,
    }} />
  );
}

/* ── Points Badge (quiet) ────────────────────────────────────────────────── */
function XPBadge({ xp, done }) {
  const C = window.C;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", flexShrink:0,
      fontSize:10.5, fontWeight:600, padding:"1px 6px", borderRadius:4,
      color: done ? C.sage : C.textMuted,
      background: "transparent",
      border: `1px solid ${C.borderLight}`,
      fontVariantNumeric:"tabular-nums",
    }}>
      {xp} pts
    </span>
  );
}

/* ── Task Item: a real checkbox inside a label ───────────────────────────── */
function TaskItem({ task, onToggle }) {
  const [hover, setHover] = useState(false);
  const C = window.C;
  return (
    <label
      className="task-row"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:"flex", alignItems:"flex-start", gap:9,
        padding:"7px 8px", borderRadius:6, cursor:"pointer",
        background: task.done ? C.sageLight : hover ? C.terraBg : "transparent",
        transition:"background 0.12s",
      }}
    >
      <input type="checkbox" className="sr-only" checked={task.done} onChange={onToggle} />
      <span aria-hidden="true" style={{
        width:17, height:17, borderRadius:4, flexShrink:0, marginTop:2,
        border:`2px solid ${task.done ? C.sage : hover ? C.terra : C.border}`,
        background: task.done ? C.sage : C.surface,
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"all 0.14s",
      }}>
        {task.done && (
          <svg width="9" height="7" viewBox="0 0 8 6" fill="none" aria-hidden="true">
            <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <ImportanceDot importance={task.importance} />
      <span style={{
        flex:1, minWidth:0, fontSize:13.5, lineHeight:1.55,
        color: task.done ? C.textMuted : C.text,
        textDecoration: task.done ? "line-through" : "none",
        textDecorationColor: C.border,
      }}>
        {task.text}
      </span>
      <span style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap", justifyContent:"flex-end" }}>
        <SourceBadges sources={task.sources} />
        <XPBadge xp={task.xp} done={task.done} />
      </span>
    </label>
  );
}

/* ── Theme Card ──────────────────────────────────────────────────────────── */
function ThemeCard({ theme, onToggleTask }) {
  const [collapsed, setCollapsed] = useState(false);
  const C     = window.C;
  const color = window.getThemeColor(theme.themeName);
  const done  = theme.tasks.filter(t => t.done).length;
  const total = theme.tasks.length;
  const pct   = total ? done / total : 0;
  const isComplete = total > 0 && done === total;

  return (
    <section style={{
      background:C.surface, borderRadius:10, marginBottom:12, overflow:"hidden",
      border:`1px solid ${isComplete ? "oklch(78% 0.07 145)" : C.border}`,
      boxShadow:"0 1px 4px oklch(0% 0 0 / 0.05)", transition:"border 0.3s",
    }}>
      <button
        type="button"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed(c => !c)}
        style={{
          width:"100%", textAlign:"left", font:"inherit", border:"none",
          display:"flex", alignItems:"center", gap:10, padding:"14px 18px", cursor:"pointer",
          background: isComplete ? C.sageLight : C.surface2,
          borderBottom: collapsed ? "none" : `1px solid ${C.borderLight}`,
        }}
      >
        <span aria-hidden="true" style={{ width:10, height:10, borderRadius:"50%", background: isComplete ? C.sage : color, flexShrink:0 }} />
        <span style={{ flex:1, fontSize:14.5, fontWeight:700, color:C.text, fontFamily:"Georgia, serif", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          {theme.themeName}
          {isComplete && <span style={{ fontSize:10.5, fontWeight:600, color:C.sage, letterSpacing:"0.05em", fontFamily:"system-ui, sans-serif" }}>✓ DONE</span>}
        </span>
        <span style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <span aria-hidden="true" style={{ width:56, height:4, borderRadius:2, background:C.borderLight, overflow:"hidden", display:"block" }}>
            <span style={{ display:"block", height:"100%", borderRadius:2, background: isComplete ? C.sage : color, width:`${pct*100}%`, transition:"width 0.4s ease" }} />
          </span>
          <span style={{ fontSize:11.5, color:C.textMuted }}>{done}/{total}</span>
        </span>
        <span aria-hidden="true" style={{ fontSize:12, color:C.textMuted, display:"inline-block", transform:`rotate(${collapsed?0:180}deg)`, transition:"transform 0.2s" }}>▾</span>
      </button>

      {!collapsed && (
        <div style={{ padding:"0 12px 12px" }}>
          {theme.summary && (
            <p style={{
              fontSize:13, color:C.textMuted, lineHeight:1.65, fontStyle:"italic",
              padding:"12px 8px 10px", margin:"0 0 4px",
              borderBottom:`1px solid ${C.borderLight}`,
            }}>
              {theme.summary}
            </p>
          )}
          {theme.tasks.map(task => (
            <TaskItem key={task.id} task={task} onToggle={() => onToggleTask(task.id)} />
          ))}
        </div>
      )}
    </section>
  );
}

Object.assign(window, { ProgressBar, SourceBadges, ImportanceDot, XPBadge, TaskItem, ThemeCard });
