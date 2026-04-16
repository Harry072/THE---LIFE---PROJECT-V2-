export default function QuoteFooter() {
  return (
    <section style={{
      position: "relative",
      margin: "40px -32px -48px",  // bleed edges
      minHeight: 160,
      display: "flex", alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}>
      <img
        src="/media/misty-lake.jpg"
        alt=""
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover", opacity: 0.45,
        }}
      />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to bottom, "
          + "var(--bg) 0%, transparent 30%, "
          + "transparent 70%, var(--bg) 100%)",
      }} />
      <p style={{
        position: "relative",
        margin: 0,
        fontFamily: "var(--font-display)",
        fontSize: "clamp(20px, 2.5vw, 28px)",
        fontStyle: "italic",
        fontWeight: 400,
        color: "var(--text)",
        textAlign: "center",
        padding: "0 24px",
      }}>
        Discipline turns dreams into reality.
      </p>
    </section>
  );
}
