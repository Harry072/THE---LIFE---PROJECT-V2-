/**
 * WeeklyMirrorPage — the Weekly Mirror's own home (it previously lived
 * only as a dashboard section). Minimal shell around the existing card.
 */
import Sidebar from "../components/dashboard/Sidebar";
import WeeklyMirrorCard from "../components/dashboard/WeeklyMirrorCard";

export default function WeeklyMirrorPage() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      position: "relative",
    }}>
      <Sidebar />

      <main className="sidebar-main">
        <div style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "40px 24px 48px",
        }}>
          <header style={{ marginBottom: 22 }}>
            <p style={{
              margin: "0 0 8px",
              color: "var(--text-faint)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2.4,
              textTransform: "uppercase",
              fontFamily: "var(--font-body)",
            }}>
              Weekly Mirror
            </p>
            <h1 style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              fontSize: "clamp(30px, 5vw, 44px)",
              fontWeight: 500,
              lineHeight: 1.05,
            }}>
              What your week has been teaching you.
            </h1>
          </header>

          <WeeklyMirrorCard />
        </div>
      </main>
    </div>
  );
}
