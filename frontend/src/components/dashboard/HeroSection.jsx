import { useState, useEffect } from "react";
import SafeImage from "../common/SafeImage";

// ── Utility: Time-based greeting ──
function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour >= 5  && hour < 12) return "GOOD MORNING";
  if (hour >= 12 && hour < 17) return "GOOD AFTERNOON";
  if (hour >= 17 && hour < 21) return "GOOD EVENING";
  return "GOOD NIGHT";
}

// ── Utility: Extract clean first name from user/profile data ──
function getDisplayName(user, profile) {
  // 1. Try profile display_name first
  if (profile?.display_name && profile.display_name !== "Explorer") {
    return profile.display_name.split(" ")[0].toUpperCase();
  }

  // 2. Try full_name from profile
  if (profile?.full_name) {
    return profile.full_name.split(" ")[0].toUpperCase();
  }

  // 3. Derive from email — take the part before @, clean it
  if (user?.email) {
    const local = user.email.split("@")[0];
    // Remove numbers, dots, underscores and capitalize
    const cleaned = local.replace(/[._0-9-]/g, " ").trim().split(" ")[0];
    if (cleaned.length >= 2) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toUpperCase();
    }
  }

  // 4. Graceful fallback
  return "FRIEND";
}

export default function HeroSection({ user, profile }) {
  const [greeting, setGreeting] = useState(getGreetingByTime());
  const displayName = getDisplayName(user, profile);

  // Update greeting every minute so it stays accurate without page reload
  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreetingByTime());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

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
          {greeting}, {displayName}
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
        <SafeImage
          src="/media/hero-forest-walker.jpg"
          alt="A person walking through a misty forest with sunrays"
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
