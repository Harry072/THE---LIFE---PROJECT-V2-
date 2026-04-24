/**
 * ProgressPage — Full-size tree view with detailed growth stats.
 * Primary view of the Growth Tree with stage timeline below.
 */
import GrowthTree from "../components/GrowthTree";
import { useGrowthTree } from "../hooks/useGrowthTree";
import TreeStatCards from "../components/TreeStatCards";
import Sidebar from "../components/dashboard/Sidebar";
import TopBar from "../components/dashboard/TopBar";

export default function ProgressPage() {
  const { stage, STAGES } = useGrowthTree();

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      position: "relative",
    }}>
      {/* Atmospheric background */}
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

      <main style={{
        marginLeft: 240,
        position: "relative", zIndex: 1,
      }}>
        <TopBar />

        <div style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "8px 32px 48px",
        }}>
          {/* Full-size tree */}
          <div style={{
            animation: "fadeUp 0.6s ease 0.15s both",
          }}>
            <GrowthTree compact={false} />
          </div>

          {/* Stats row */}
          <div style={{
            marginBottom: 32,
            animation: "fadeUp 0.6s ease 0.25s both",
          }}>
            <TreeStatCards />
          </div>

          {/* Stage timeline */}
          <div style={{
            background: "var(--bg-card)",
            backdropFilter: "blur(24px)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: "24px",
            animation: "fadeUp 0.6s ease 0.35s both",
          }}>
            <h3 style={{
              margin: "0 0 20px",
              fontSize: 11,
              fontWeight: 500,
              letterSpacing: 2.5,
              textTransform: "uppercase",
              color: "var(--text-faint)",
            }}>
              Growth Stages
            </h3>

            <div style={{
              display: "flex",
              flexDirection: "column",
              gap: 0,
            }}>
              {STAGES.map((s, i) => {
                const isActive = s.id === stage.id;
                const isPast = s.id < stage.id;
                const isFuture = s.id > stage.id;

                return (
                  <div key={s.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    padding: "12px 0",
                    position: "relative",
                  }}>
                    {/* Timeline line */}
                    {i < STAGES.length - 1 && (
                      <div style={{
                        position: "absolute",
                        left: 15,
                        top: 36,
                        width: 2,
                        height: "calc(100% - 12px)",
                        background: isPast
                          ? "var(--green-bright)"
                          : "rgba(255,255,255,0.06)",
                        transition: "background 0.6s ease",
                      }} />
                    )}

                    {/* Circle */}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "50%",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "var(--font-body)",
                      background: isActive
                        ? "var(--green-bright)"
                        : isPast
                        ? "rgba(46,204,113,0.2)"
                        : "rgba(255,255,255,0.04)",
                      color: isActive
                        ? "#0A0F0D"
                        : isPast
                        ? "var(--green-bright)"
                        : "var(--text-faint)",
                      border: isActive
                        ? "2px solid var(--green-bright)"
                        : isPast
                        ? "2px solid rgba(46,204,113,0.3)"
                        : "2px solid rgba(255,255,255,0.06)",
                      boxShadow: isActive
                        ? "0 0 16px var(--green-glow)"
                        : "none",
                      transition: "all 0.6s ease",
                      zIndex: 2,
                    }}>
                      {isPast ? "✓" : s.id}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1 }}>
                      <p style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: isActive ? 600 : 400,
                        color: isFuture ? "var(--text-dim)" : "var(--text)",
                        fontFamily: "var(--font-body)",
                      }}>
                        {s.name}
                      </p>
                      <p style={{
                        margin: "2px 0 0",
                        fontSize: 12,
                        color: "var(--text-faint)",
                        fontFamily: "var(--font-body)",
                      }}>
                        {s.max === Infinity
                          ? `${s.min}+ pts`
                          : `${s.min} – ${s.max} pts`}
                        {isActive && " · Current"}
                      </p>
                    </div>

                    {/* Stage message */}
                    <p style={{
                      margin: 0,
                      fontSize: 12,
                      color: isActive ? "var(--green-bright)" : "var(--text-faint)",
                      fontStyle: "italic",
                      fontFamily: "var(--font-display)",
                      maxWidth: 200,
                      textAlign: "right",
                      opacity: isFuture ? 0.4 : 1,
                    }}>
                      {s.message}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      {/* Responsive CSS */}
      <style>{`
        @media (max-width: 1023px) {
          aside { width: 64px !important; }
          aside nav span,
          aside [data-widget],
          aside [data-profile-text] {
            display: none !important;
          }
          main { margin-left: 64px !important; }
        }
        @media (max-width: 767px) {
          aside { display: none; }
          main { margin-left: 0 !important; }
          .tree-stat-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
