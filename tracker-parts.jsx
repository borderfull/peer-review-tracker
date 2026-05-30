// tracker-parts.jsx — PixelBar, SourceBadges, ImportanceDot, XPBadge, TaskItem, ThemeCard

const { useState } = React;

/* ── Progress Bar (clean, warm terracotta) ───────────────────────────────── */
function ProgressBar({ earned, total }) {
  const C   = window.C;
  const pct = total > 0 ? earned / total : 0;
  const { level, nextLevel } = window.getLevel(earned);

  return (
    <div>
      {/* Level name + XP counter */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:10 }}>
        <span style={{ fontSize:15, fontWeight:700, fontFamily:"Georgia, serif", color:C.text }}>
          {level.name}
        </span>
        <span style={{ fontSize:13, color:C.textMuted }}>
          <strong style={{ color:C.terra, fontVariantNumeric:"tabular-nums" }}>{earned}</strong>
          <span style={{ color:C.border }}> / </span>
          {total} XP
        </span>
      </div>

      {/* Bar track */}
      <div style={{ height:9, borderRadius:5, background:C.borderLight, overflow:"hidden", marginBottom:8 }}>
        <div style={{
          height:"100%", borderRadius:5,
          background: `linear-gradient(90deg, ${C.terra}, oklch(60% 0.14 42))`,
          width:`${pct * 100}%`,
          transition:"width 0.5s cubic-bezier(.4,0,.2,1)",
        }} />
      </div>

      {/* Progress labels */}
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:C.textMuted }}>
        <span>{Math.round(pct * 100)}% complete</span>
        {nextLevel
          ? <span>{nextLevel.xpNeeded - earned} XP to {nextLevel.name}</span>
          : <span style={{ color:C.sage }}>Maximum rank reached</span>
        }
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
    <div style={{ display:"flex", gap:3, alignItems:"center", flexShrink:0 }}>
      {labels.map(l => (
        <span key={l} style={{
          fontSize:9, padding:"1px 5px", borderRadius:3, fontWeight:600, letterSpacing:"0.02em",
          background:C.surface2, border:`1px solid ${C.borderLight}`, color:C.textMuted,
        }}>
          {l}
        </span>
      ))}
    </div>
  );
}

/* ── Importance Dot ──────────────────────────────────────────────────────── */
function ImportanceDot({ importance }) {
  const labels = { essential:"Essential", major:"Major", moderate:"Moderate", minor:"Minor", trivial:"Trivial" };
  return (
    <span title={labels[importance] || importance} style={{
      display:"inline-block", width:7, height:7, borderRadius:"50%", flexShrink:0, marginTop:5,
      background: window.IMPORTANCE_DOT[importance] || window.IMPORTANCE_DOT.moderate,
    }} />
  );
}

/* ── XP Badge ────────────────────────────────────────────────────────────── */
function XPBadge({ xp, done }) {
  const C = window.C;
  return (
    <span style={{
      display:"inline-flex", alignItems:"center", flexShrink:0,
      fontSize:10.5, fontWeight:700, letterSpacing:"0.03em", padding:"2px 7px", borderRadius:4,
      color:      done ? C.terraDark  : C.textMuted,
      background: done ? C.amberLight : C.surface2,
      border:     `1px solid ${done ? C.amber : C.border}`,
      transition: "all 0.2s",
    }}>
      {done ? "✓ " : "+"}{xp} XP
    </span>
  );
}

/* ── Task Item ───────────────────────────────────────────────────────────── */
function TaskItem({ task, onToggle }) {
  const [hover, setHover] = useState(false);
  const C = window.C;
  return (
    <div
      onClick={onToggle}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:"flex", alignItems:"flex-start", gap:9,
        padding:"6px 8px", borderRadius:6, cursor:"pointer",
        background: task.done ? C.sageLight : hover ? C.terraBg : "transparent",
        transition:"background 0.12s",
      }}
    >
      <ImportanceDot importance={task.importance} />
      <div style={{
        width:16, height:16, borderRadius:3, flexShrink:0, marginTop:2,
        border:`2px solid ${task.done ? C.sage : hover ? C.terra : C.border}`,
        background: task.done ? C.sage : "transparent",
        display:"flex", alignItems:"center", justifyContent:"center",
        transition:"all 0.14s",
      }}>
        {task.done && (
          <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
            <path d="M1 3l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <span style={{
        flex:1, fontSize:13.5, lineHeight:1.55,
        color: task.done ? C.textMuted : C.text,
        textDecoration: task.done ? "line-through" : "none",
        textDecorationColor: C.border,
        transition:"all 0.2s",
      }}>
        {task.text}
      </span>
      <SourceBadges sources={task.sources} />
      <XPBadge xp={task.xp} done={task.done} />
    </div>
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
    <div style={{
      background:C.surface, borderRadius:10, marginBottom:12, overflow:"hidden",
      border:`1px solid ${isComplete ? "oklch(78% 0.07 145)" : C.border}`,
      boxShadow:"0 1px 4px oklch(0% 0 0 / 0.05)", transition:"border 0.3s",
    }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(c => !c)}
        style={{
          display:"flex", alignItems:"center", gap:10, padding:"14px 18px", cursor:"pointer",
          background: isComplete ? C.sageLight : C.surface2,
          borderBottom: collapsed ? "none" : `1px solid ${C.borderLight}`,
        }}
      >
        <div style={{ width:10, height:10, borderRadius:"50%", background: isComplete ? C.sage : color, flexShrink:0 }} />
        <span style={{ flex:1, fontSize:14.5, fontWeight:700, color:C.text, fontFamily:"Georgia, serif", display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
          {theme.themeName}
          {isComplete && <span style={{ fontSize:10, fontWeight:600, color:C.sage, letterSpacing:"0.05em" }}>✓ COMPLETE</span>}
        </span>
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{ width:64, height:4, borderRadius:2, background:C.borderLight, overflow:"hidden" }}>
            <div style={{ height:"100%", borderRadius:2, background: isComplete ? C.sage : color, width:`${pct*100}%`, transition:"width 0.4s ease" }} />
          </div>
          <span style={{ fontSize:11, color:C.textMuted }}>{done}/{total}</span>
        </div>
        <span style={{ fontSize:12, color:C.textMuted, display:"inline-block", transform:`rotate(${collapsed?0:180}deg)`, transition:"transform 0.2s" }}>▾</span>
      </div>

      {/* Body */}
      {!collapsed && (
        <div style={{ padding:"0 18px 12px" }}>
          {/* Summary */}
          {theme.summary && (
            <p style={{
              fontSize:13, color:C.textMuted, lineHeight:1.65, fontStyle:"italic",
              padding:"12px 2px 10px", margin:"0 0 4px",
              borderBottom:`1px solid ${C.borderLight}`,
            }}>
              {theme.summary}
            </p>
          )}
          {/* Tasks */}
          {theme.tasks.map(task => (
            <TaskItem key={task.id} task={task} onToggle={() => onToggleTask(task.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

Object.assign(window, { ProgressBar, SourceBadges, ImportanceDot, XPBadge, TaskItem, ThemeCard });
