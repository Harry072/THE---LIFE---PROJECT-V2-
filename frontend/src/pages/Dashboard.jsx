import "../styles/tokens.css";
import { useEffect, useState } from "react";
import Sidebar from "../components/dashboard/Sidebar";
import DashboardHero from "../components/dashboard/DashboardHero";
import PrimaryActionCard from "../components/dashboard/PrimaryActionCard";
import FeatureGrid from "../components/dashboard/FeatureGrid";
import FounderNoteModal from "../components/dashboard/FounderNoteModal";
import DashboardSkeleton from "../components/dashboard/DashboardSkeleton";
import { useDashboard } from "../hooks/useDashboard";

const FOUNDER_NOTE_SESSION_KEY = "tlp.founder_note_shown";

/**
 * Dashboard — three zones, in this order, nothing else:
 *   1. Greeting hero (season-matched imagery, composed salutation)
 *   2. Primary action (the one thing the day asks)
 *   3. Feature discovery grid (cards 2-6 from the orchestrator)
 * Everything is driven by one orchestrator payload; the safe default in
 * useDashboard means this page always renders.
 */
export default function Dashboard() {
  const { payload, loading } = useDashboard();
  const [founderNoteOpen, setFounderNoteOpen] = useState(false);

  // Auto-open on first session / every 7th day (orchestrator decides);
  // at most once per browser session so navigation doesn't re-trigger it.
  useEffect(() => {
    if (!payload?.show_founder_note) return;
    try {
      if (window.sessionStorage.getItem(FOUNDER_NOTE_SESSION_KEY)) return;
      window.sessionStorage.setItem(FOUNDER_NOTE_SESSION_KEY, "1");
    } catch {
      // Storage unavailable — still opens this once.
    }
    setFounderNoteOpen(true);
  }, [payload?.show_founder_note]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      position: "relative",
    }}>
      {/* Atmospheric background gradient */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        background: `
          radial-gradient(ellipse 70% 40% at 80% 20%,
            rgba(46,204,113,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 50% 40% at 10% 80%,
            rgba(46,204,113,0.03) 0%, transparent 60%)
        `,
        pointerEvents: "none",
      }} />

      <Sidebar />

      <main className="sidebar-main">
        {loading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <DashboardHero
              payload={payload}
              onOpenFounderNote={() => setFounderNoteOpen(true)}
            />

            <div className="dashboard-content" style={{
              maxWidth: 1200,
              margin: "0 auto",
              padding: "0 20px 48px",
            }}>
              <PrimaryActionCard payload={payload} />
              <FeatureGrid payload={payload} />
            </div>
          </>
        )}
      </main>

      {founderNoteOpen ? (
        <FounderNoteModal onClose={() => setFounderNoteOpen(false)} />
      ) : null}

      <style>{`
        @media (min-width: 768px) {
          .dashboard-content {
            padding-left: 32px !important;
            padding-right: 32px !important;
          }
        }
      `}</style>
    </div>
  );
}
