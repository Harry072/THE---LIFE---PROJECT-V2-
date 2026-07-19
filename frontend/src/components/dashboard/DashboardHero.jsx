import { useNavigate } from "react-router-dom";
import Icon from "../Icon";
import LiveClock from "./LiveClock";
import { toTitleCase } from "../../utils/userDisplayName";

// Zone 1 — the greeting hero. Composed salutation, quote, and the season
// whisper. The user came to act, not admire: 48vh mobile / 42vh desktop.

const HERO_IMAGE = "/media/dashboard/hero_mountain_valley.png";

function timeSalutation() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 21) return "Good evening";
  return "Good night";
}

export default function DashboardHero({ payload, onOpenFounderNote }) {
  const navigate = useNavigate();
  const prefix = payload?.greeting_prefix === "welcome"
    ? "Welcome"
    : timeSalutation();

  return (
    <section className="dashboard-hero" aria-label="Your day at a glance">
      <img
        src={HERO_IMAGE}
        alt=""
        aria-hidden="true"
        className="dashboard-hero-image"
      />
      <div className="dashboard-hero-overlay" aria-hidden="true" />

      <div className="dashboard-hero-topright">
        <div className="dashboard-hero-actions">
          <button
            type="button"
            className="dashboard-hero-note-btn"
            aria-label="Founder Story — why this project exists"
            title="Founder Story"
            onClick={() => navigate("/story")}
          >
            <Icon name="story" size={19} />
          </button>
          <button
            type="button"
            className="dashboard-hero-note-pill"
            aria-label="A note from the founder"
            onClick={onOpenFounderNote}
          >
            <Icon name="leaf" size={14} />
            <span>A note from the founder</span>
          </button>
        </div>
        <LiveClock />
      </div>

      <div className="dashboard-hero-copy">
        <h1>
          {prefix}, {toTitleCase(payload?.user_display_name) || "there"}.
        </h1>
        <p className="dashboard-hero-greeting-line">{payload?.greeting}</p>
        <p className="dashboard-hero-quote">{payload?.daily_quote}</p>
        <p className="dashboard-hero-whisper">{payload?.season?.message}</p>
      </div>

      <style>{`
        .dashboard-hero {
          position: relative;
          height: 48vh;
          min-height: 260px;
          overflow: hidden;
          isolation: isolate;
        }

        @media (min-width: 768px) {
          .dashboard-hero {
            height: 42vh;
          }
        }

        .dashboard-hero-image {
          position: absolute;
          inset: 0;
          z-index: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }

        .dashboard-hero-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(180deg,
            rgba(0, 0, 0, 0.10) 0%,
            rgba(0, 0, 0, 0.25) 50%,
            rgba(0, 0, 0, 0.65) 100%);
          pointer-events: none;
        }

        .dashboard-hero-topright {
          position: absolute;
          top: 16px;
          right: 16px;
          z-index: 3;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 14px;
        }

        .dashboard-hero-actions {
          display: flex;
          gap: 10px;
        }

        .dashboard-hero-note-btn {
          width: 44px;
          height: 44px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: var(--r-sm);
          background: rgba(4, 8, 6, 0.42);
          backdrop-filter: blur(10px);
          color: rgba(255, 255, 255, 0.82);
          cursor: pointer;
          transition: border-color 0.2s ease-in-out;
        }

        .dashboard-hero-note-btn:hover {
          border-color: rgba(255, 255, 255, 0.36);
        }

        .dashboard-hero-note-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 44px;
          padding: 6px 12px;
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 20px;
          background: rgba(0, 0, 0, 0.45);
          color: #FFFFFF;
          font-family: var(--font-body);
          font-size: 11px;
          white-space: nowrap;
          cursor: pointer;
          transition: border-color 0.2s ease-in-out;
        }

        .dashboard-hero-note-pill:hover {
          border-color: rgba(255, 255, 255, 0.36);
        }

        .dashboard-hero-copy {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          z-index: 2;
          padding: 0 20px 28px 32px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .dashboard-hero-copy h1 {
          margin: 0;
          color: #FFFFFF;
          font-family: var(--font-display);
          font-size: 28px;
          font-weight: 700;
          line-height: 1.1;
        }

        @media (min-width: 768px) {
          .dashboard-hero-copy h1 {
            font-size: 38px;
          }
        }

        .dashboard-hero-greeting-line {
          margin: 8px 0 0;
          color: var(--amber);
          font-family: var(--font-display);
          font-size: 15px;
          font-style: italic;
          font-weight: 400;
          line-height: 1.3;
        }

        .dashboard-hero-quote {
          margin: 10px 0 0;
          color: rgba(255, 255, 255, 0.75);
          font-family: var(--font-body);
          font-size: 11px;
          line-height: 1.5;
        }

        @media (min-width: 768px) {
          .dashboard-hero-quote {
            font-size: 13px;
          }
        }

        .dashboard-hero-whisper {
          margin: 6px 0 0;
          color: rgba(255, 255, 255, 0.50);
          font-family: var(--font-body);
          font-style: italic;
          font-size: 11px;
          line-height: 1.5;
          animation: fadeIn 0.6s ease-in both;
        }

        @media (min-width: 768px) {
          .dashboard-hero-whisper {
            font-size: 12px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dashboard-hero-whisper {
            animation: none;
          }
          .dashboard-hero-note-btn,
          .dashboard-hero-note-pill {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
