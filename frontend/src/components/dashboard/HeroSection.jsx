export default function HeroSection({ userName = "Arjun" }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning"
    : hour < 17 ? "Good Afternoon" : "Good Evening";
 
  return (
    <section style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 32,
      alignItems: "center",
      marginBottom: 40,
      animation: "fadeUp 0.6s ease 0.15s both",
    }}>
      {/* Left: Text */}
      <div>
        <p style={{
          margin: 0,
          fontSize: 11, fontWeight: 500,
          letterSpacing: 2.5, textTransform: "uppercase",
          color: "var(--text-faint)",
          fontFamily: "var(--font-body)",
        }}>
          {greeting}, {userName}
        </p>
        <h1 style={{
          margin: "12px 0 16px",
          fontSize: "clamp(40px, 5vw, 56px)",
          lineHeight: 1.05, fontWeight: 500,
          fontFamily: "var(--font-display)",
        }}>
          <span style={{ color: "var(--text)" }}>
            Become Who
          </span>
          <br />
          <span style={{
            color: "var(--green-bright)",
            fontStyle: "italic",
          }}>
            You&rsquo;re Meant to Be.
          </span>
        </h1>
        <p style={{
          margin: 0, fontSize: 15,
          color: "var(--text-dim)",
          fontFamily: "var(--font-body)",
          maxWidth: 400, lineHeight: 1.6,
        }}>
          Stay consistent. Trust the process.
        </p>
      </div>
 
      {/* Right: Cinematic image */}
      <div style={{
        position: "relative",
        height: 320,
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
        boxShadow: "var(--shadow-lift)",
      }}>
        <img
          src="/media/hero-forest-walker.jpg"
          alt="A person walking through a misty forest
            with sunrays"
          style={{
            width: "100%", height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(to right, "
            + "var(--bg) 0%, transparent 20%, "
            + "transparent 80%, rgba(10,15,13,0.6) 100%)",
        }} />
      </div>
    </section>
  );
}
