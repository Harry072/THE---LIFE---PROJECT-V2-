export default function ExecutionEngineCard({
  action,
  loading,
  error,
  dismissed,
  celebrated,
  painPoint,
  onDismiss,
  onGenerateLoop,
}) {
  if (dismissed) return null;
  if (error && !action) return null;

  const outerStyle = {
    borderRadius: 24,
    padding: "32px 28px",
    background: "rgba(255,255,255,0.025)",
    boxShadow: "0 0 0 1px rgba(255,255,255,0.055), 0 8px 32px rgba(0,0,0,0.28)",
    position: "relative",
    overflow: "hidden",
    animation: "eeCardIn 0.42s cubic-bezier(0.22,1,0.36,1) both",
    minHeight: 160,
  };

  if (loading) {
    return (
      <div style={outerStyle}>
        <div style={{
          height: 14, width: "55%", borderRadius: 6,
          background: "rgba(255,255,255,0.06)", marginBottom: 20,
          animation: "eePulse 1.4s ease-in-out infinite",
        }} />
        <div style={{
          height: 28, width: "85%", borderRadius: 8,
          background: "rgba(255,255,255,0.06)", marginBottom: 12,
          animation: "eePulse 1.4s ease-in-out infinite 0.15s",
        }} />
        <div style={{
          height: 14, width: "40%", borderRadius: 6,
          background: "rgba(255,255,255,0.06)", marginBottom: 28,
          animation: "eePulse 1.4s ease-in-out infinite 0.3s",
        }} />
        <div style={{
          height: 16, width: "70%", borderRadius: 6,
          background: "rgba(255,255,255,0.04)",
          animation: "eePulse 1.4s ease-in-out infinite 0.45s",
        }} />
        <style>{`
          @keyframes eePulse {
            0%, 100% { opacity: 0.4; }
            50% { opacity: 0.08; }
          }
        `}</style>
      </div>
    );
  }

  if (celebrated) {
    return (
      <div style={{ ...outerStyle, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 200 }}>
        <span style={{ fontSize: 40, marginBottom: 16, animation: "eeCheckBounce 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both" }}>✓</span>
        <p style={{
          fontFamily: "var(--font-display)",
          fontSize: 22,
          fontWeight: 700,
          color: "var(--green-bright)",
          margin: 0,
          letterSpacing: 0.2,
        }}>
          Done. That counts.
        </p>
        <style>{`
          @keyframes eeCheckBounce {
            0% { opacity: 0; transform: scale(0.5); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div style={outerStyle}>
      {painPoint && (
        <span style={{
          display: "inline-block",
          padding: "4px 12px",
          borderRadius: 99,
          background: "rgba(46,204,113,0.08)",
          boxShadow: "0 0 0 1px rgba(46,204,113,0.18)",
          fontSize: 11,
          letterSpacing: 1.4,
          textTransform: "uppercase",
          color: "var(--green-bright)",
          fontFamily: "var(--font-body)",
          marginBottom: 18,
          fontWeight: 600,
        }}>
          {painPoint}
        </span>
      )}

      <h2 style={{
        fontFamily: "var(--font-display)",
        fontSize: "clamp(20px, 3.5vw, 28px)",
        fontWeight: 700,
        color: "var(--text)",
        lineHeight: 1.22,
        margin: "0 0 12px",
        maxWidth: "95%",
      }}>
        {action?.taskTitle}
      </h2>

      {action?.durationLabel && (
        <span style={{
          display: "inline-block",
          padding: "5px 14px",
          borderRadius: 99,
          background: "rgba(255,255,255,0.04)",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.08)",
          fontSize: 12,
          color: "var(--text-dim)",
          fontFamily: "var(--font-body)",
          marginBottom: 16,
        }}>
          {action.durationLabel}
        </span>
      )}

      {action?.contextNote && (
        <p style={{
          fontSize: 14,
          color: "var(--text-dim)",
          lineHeight: 1.68,
          fontFamily: "var(--font-body)",
          margin: "0 0 28px",
        }}>
          {action.contextNote}
        </p>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            background: "var(--green-bright)",
            border: "none",
            color: "#000",
            fontWeight: 700,
            cursor: "pointer",
            fontSize: 14,
            fontFamily: "var(--font-body)",
            letterSpacing: 0.2,
            transition: "opacity 0.18s ease",
          }}
        >
          I did it
        </button>
        <button
          type="button"
          onClick={onGenerateLoop}
          style={{
            padding: "12px 24px",
            borderRadius: 12,
            background: "transparent",
            border: "none",
            boxShadow: "0 0 0 1px rgba(255,255,255,0.1)",
            color: "var(--text-dim)",
            cursor: "pointer",
            fontSize: 14,
            fontFamily: "var(--font-body)",
            letterSpacing: 0.2,
            transition: "box-shadow 0.18s ease",
          }}
        >
          Generate Today&apos;s Loop
        </button>
      </div>

      <style>{`
        @keyframes eeCardIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
