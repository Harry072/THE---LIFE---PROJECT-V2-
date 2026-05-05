import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import SafeImage from "../common/SafeImage";
import Icon from "../Icon";
import { getPreferredUsername } from "../../utils/userDisplayName";
import { useContextualGreeting } from "../../hooks/useContextualGreeting";

// ── Utility: Time-based greeting ──
function getGreetingByTime() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "GOOD MORNING";
  if (hour >= 12 && hour < 17) return "GOOD AFTERNOON";
  if (hour >= 17 && hour < 21) return "GOOD EVENING";
  return "GOOD NIGHT";
}

export default function HeroSection({ user, profile }) {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState(getGreetingByTime());
  const displayName = getPreferredUsername(user, profile, "Friend");
  const { whisper } = useContextualGreeting(user?.id, user?.user_tree?.streak ?? 0);

  // Update greeting every minute so it stays accurate without page reload
  useEffect(() => {
    const interval = setInterval(() => {
      setGreeting(getGreetingByTime());
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="dashboard-hero-section" style={{
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
          letterSpacing: 2.5,
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
          {whisper}
        </p>
      </div>

      {/* Right: Cinematic image */}
      <div className="dashboard-hero-image-area">
        <div className="dashboard-hero-image-card" style={{
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

        <button
          type="button"
          className="dashboard-founder-story-cta"
          onClick={() => navigate("/story")}
          aria-label="Open Founder Story"
        >
          <span className="dashboard-founder-story-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="14" r="3" />
              <path d="M12 17v4" />
              <path d="M9.5 16.5l-2.5 2.5" />
              <path d="M14.5 16.5l2.5 2.5" />
              <path d="M12 11C12 11 9 8.5 12 3C12 3 15 5.5 15 8C15 9.5 12 11 12 11Z" />
            </svg>
          </span>
          <span className="dashboard-founder-story-copy">
            <span>Founder Story</span>
            <span>Why this Project exists</span>
          </span>
          <Icon name="arrow" size={16} />
        </button>
      </div>

      <style>{`
        .dashboard-hero-image-area {
          position: relative;
        }

        .dashboard-founder-story-cta {
          position: absolute;
          right: 18px;
          bottom: 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 214px;
          padding: 12px 14px;
          border: 1px solid rgba(140, 255, 188, 0.24);
          border-radius: var(--r-md);
          background:
            linear-gradient(135deg, rgba(8, 18, 14, 0.92), rgba(12, 40, 26, 0.82));
          color: var(--text);
          box-shadow: 0 18px 42px rgba(0, 0, 0, 0.35),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          cursor: pointer;
          font-family: var(--font-body);
          text-align: left;
          transition: border-color 0.2s ease, transform 0.2s ease,
            box-shadow 0.2s ease;
        }

        .dashboard-founder-story-cta:hover {
          border-color: rgba(140, 255, 188, 0.48);
          transform: translateY(-2px);
          box-shadow: 0 22px 50px rgba(0, 0, 0, 0.42),
            0 0 24px rgba(46, 204, 113, 0.12);
        }

        .dashboard-founder-story-badge {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: rgba(110, 231, 183, 0.9);
          background: rgba(2, 44, 34, 0.5);
          border: 1px solid rgba(52, 211, 153, 0.25);
          box-shadow: 0 0 24px rgba(52, 211, 153, 0.12), inset 0 0 8px rgba(52, 211, 153, 0.08);
          flex-shrink: 0;
          transition: all 0.3s ease;
        }

        .dashboard-founder-story-cta:hover .dashboard-founder-story-badge {
          border-color: rgba(110, 231, 183, 0.45);
          box-shadow: 0 0 28px rgba(52, 211, 153, 0.18), inset 0 0 16px rgba(52, 211, 153, 0.12);
          color: #a7f3d0;
        }

        .dashboard-founder-story-copy {
          display: flex;
          flex-direction: column;
          gap: 2px;
          flex: 1;
          min-width: 0;
        }

        .dashboard-founder-story-copy span:first-child {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
        }

        .dashboard-founder-story-copy span:last-child {
          font-size: 11px;
          color: var(--text-faint);
        }

        @media (max-width: 767px) {
          .dashboard-hero-image-card {
            height: 260px !important;
          }

          .dashboard-founder-story-cta {
            position: static;
            width: 100%;
            margin-top: 14px;
            justify-content: flex-start;
          }
        }
      `}</style>
    </section>
  );
}
