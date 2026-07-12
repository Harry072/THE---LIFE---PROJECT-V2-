export default function PatternRevealModal({
  description = "",
  question = "",
  onClose,
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pattern-reveal-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          border: "none",
          background: "rgba(4, 8, 6, 0.80)",
          backdropFilter: "blur(16px)",
          cursor: "default",
        }}
      />

      <section
        style={{
          position: "relative",
          width: "min(440px, 100%)",
          borderRadius: 20,
          border: "1px solid rgba(126, 217, 154, 0.18)",
          background: "linear-gradient(180deg, rgba(13, 25, 18, 0.99), rgba(8, 15, 12, 0.99))",
          boxShadow: "0 32px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(46,204,113,0.08)",
          padding: 28,
          color: "var(--text, #fff)",
          animation: "fadeSlideUp 0.25s ease both",
        }}
      >
        <p style={{
          margin: 0,
          fontSize: 10,
          letterSpacing: 2,
          textTransform: "uppercase",
          color: "var(--text-faint)",
        }}>
          Something I&rsquo;ve noticed
        </p>
        <h2
          id="pattern-reveal-title"
          style={{
            margin: "8px 0 14px",
            fontSize: 22,
            fontFamily: "var(--font-display)",
            fontWeight: 500,
          }}
        >
          A pattern worth seeing
        </h2>

        <p style={{
          margin: 0,
          color: "var(--text-dim)",
          fontSize: 15,
          lineHeight: 1.6,
        }}>
          {description}
        </p>

        <p style={{
          margin: "20px 0 0",
          color: "var(--text)",
          fontSize: 14,
          lineHeight: 1.5,
          fontStyle: "italic",
        }}>
          {question}
        </p>

        <div style={{
          display: "flex",
          justifyContent: "flex-end",
          marginTop: 26,
        }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              border: "1px solid rgba(126, 217, 154, 0.32)",
              background: "var(--green-bright)",
              color: "#06100b",
              cursor: "pointer",
              fontWeight: 700,
              fontFamily: "var(--font-body)",
              fontSize: 13,
              transition: "all 0.2s ease",
            }}
          >
            I see it
          </button>
        </div>
      </section>

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
