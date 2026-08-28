/**
 * ProgressPage — Full-size tree view with detailed growth stats.
 * Primary view of the Growth Tree with stage timeline below.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "../contexts/AppStateContext";
import GrowthTree from "../components/GrowthTree";
import { useGrowthTree } from "../hooks/useGrowthTree";
import { useTreeSeason } from "../hooks/useTreeSeason";
import TreeStatCards from "../components/TreeStatCards";
import Sidebar from "../components/dashboard/Sidebar";
import TopBar from "../components/dashboard/TopBar";
import ContinuationCard from "../components/ContinuationCard";
import ChainDebugOverlay from "../components/ChainDebugOverlay";
import { endChain, evaluateCompletion } from "../hooks/useContinuationChain";

// "2026-05-05" -> "May 5" (year shown only when it isn't this year).
function formatJourneyDate(isoDate) {
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (!Number.isFinite(parsed.getTime())) return isoDate;
  const options = { month: "long", day: "numeric" };
  if (parsed.getFullYear() !== new Date().getFullYear()) {
    options.year = "numeric";
  }
  return parsed.toLocaleDateString("en-US", options);
}

export default function ProgressPage() {
  const { stage, STAGES } = useGrowthTree();
  const { journey } = useTreeSeason({ includeJourney: true });
  const navigate = useNavigate();
  const location = useLocation();
  const [chainResult, setChainResult] = useState(null);
  // GlobalNowPlaying (App.jsx) is fixed to bottom:0 at height 72 / z-index 100
  // whenever a track is playing. Reading the same state here lets the dock sit
  // ABOVE it rather than underneath it.
  const { currentTrack } = useAppState();
  const dockOffset = currentTrack ? 72 : 0;

  // Set only when the chain itself sent the user here (see the accept
  // handlers in TheLoopPage/ReflectionPage/ResetSpace). Router state is
  // per-navigation, so a refresh or a direct visit simply has none.
  const fromChain = Boolean(location.state?.fromChain);

  // Memoizes the in-flight evaluation itself, not a "did we start" boolean,
  // so StrictMode's dev double-mount awaits the SAME result instead of making
  // a second call. Same technique and same reason as usePatternReveal's
  // checkPromiseRef.
  //
  // Without this the card never rendered in dev, and the cause was the atomic
  // duplicate guard added to evaluateCompletion: mount 1 claimed "tree" and
  // returned the offer, but its own StrictMode cleanup had already set
  // cancelled=true so the offer was thrown away; mount 2 then hit the guard,
  // got null, and never called setChainResult. The winning result was
  // discarded and the surviving one was empty, so chainResult stayed null and
  // nothing rendered. One promise, awaited twice, fixes it without touching
  // the guard — evaluateCompletion is now only ever called once here.
  //
  // A card only renders on a chain hand-off. Arriving from the sidebar or
  // the dashboard still records the visit and still costs no depth, because
  // rendersCard stays false and the event remains passive (the F3 rule:
  // depth counts offers SHOWN).
  const evaluationRef = useRef(null);
  useEffect(() => {
    let cancelled = false;
    if (!evaluationRef.current) {
      evaluationRef.current = evaluateCompletion(
        "tree_viewed", undefined, undefined, { rendersCard: fromChain },
      );
    }
    evaluationRef.current.then((result) => {
      if (!cancelled && fromChain && result) setChainResult(result);
    });
    return () => { cancelled = true; };
  }, [fromChain]);

  const handleChainAccept = useCallback(() => {
    const route = chainResult?.nextRoute;
    setChainResult(null);
    if (route) navigate(route, { state: { fromChain: true } });
  }, [chainResult, navigate]);

  const handleChainDismiss = useCallback(() => {
    endChain();
    setChainResult(null);
  }, []);

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
        marginLeft: 180,
        position: "relative", zIndex: 1,
      }}>
        <TopBar />

        <div style={{
          maxWidth: 900,
          margin: "0 auto",
          padding: "8px 32px 48px",
        }}>
          <header style={{
            marginBottom: 22,
            animation: "fadeUp 0.6s ease 0.1s both",
          }}>
            <p style={{
              margin: "0 0 8px",
              color: "var(--text-faint)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2.4,
              textTransform: "uppercase",
            }}>
              Growth Tree
            </p>
            <h1 style={{
              margin: 0,
              color: "var(--text)",
              fontFamily: "var(--font-display)",
              fontSize: "clamp(34px, 6vw, 52px)",
              fontWeight: 500,
              lineHeight: 1.05,
            }}>
              Your consistency made visible.
            </h1>
          </header>

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



          {/* Tree Memory — real milestones only; hidden below 2 items.
              No icons, no dots, no lines. The words carry the weight. */}
          {journey.length >= 2 && (
            <div style={{
              background: "var(--bg-card)",
              backdropFilter: "blur(24px)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: "24px",
              marginBottom: 32,
              animation: "fadeUp 0.6s ease 0.3s both",
            }}>
              <h3 style={{
                margin: "0 0 16px",
                fontSize: 11,
                fontWeight: 500,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                color: "var(--text-faint)",
              }}>
                Your Journey
              </h3>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {journey.map((item) => (
                  <div
                    key={`${item.date}-${item.label}`}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      gap: 16,
                      padding: "8px 0",
                    }}
                  >
                    <span style={{
                      minWidth: 92,
                      flexShrink: 0,
                      color: "var(--text-faint)",
                      fontSize: 12,
                      fontFamily: "var(--font-body)",
                    }}>
                      {formatJourneyDate(item.date)}
                    </span>
                    <p style={{
                      margin: 0,
                      color: "var(--text)",
                      fontSize: 14,
                      fontFamily: "var(--font-body)",
                      lineHeight: 1.5,
                    }}>
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

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
        {/* Keeps the last content scrollable clear of the fixed dock. */}
        {chainResult && <div style={{ height: 132 + dockOffset }} aria-hidden="true" />}
      </main>

      {/* Docked to the bottom of the VIEWPORT, never above the tree: the user
          was sent here to look at something, so the content leads and the next
          action stays reachable without scrolling. z-index 90 sits above page
          content but below GlobalNowPlaying's 100, and dockOffset lifts it
          clear of that player when a track is running. ContinuationCard itself
          is unchanged — it is still the same inline block, and Reflection,
          Reset Space and The Loop keep rendering it inline. */}
      {chainResult && (
        <div className="tree-continuation-dock" style={{ bottom: dockOffset }}>
          <ContinuationCard
            headline={chainResult.headline}
            question={chainResult.question}
            nextFeatureName={chainResult.nextFeatureName}
            isTerminal={chainResult.isTerminal}
            onAccept={handleChainAccept}
            onDismiss={handleChainDismiss}
          />
        </div>
      )}

      <ChainDebugOverlay fromChain={fromChain} chainResult={chainResult} />

      {/* Responsive CSS — the rail is 60px at all desktop widths */}
      <style>{`
        .tree-continuation-dock {
          position: fixed;
          left: 180px;
          right: 0;
          z-index: 90;
          padding: 12px 32px;
          padding-bottom: max(12px, env(safe-area-inset-bottom));
          pointer-events: none;
        }

        .tree-continuation-dock > * {
          pointer-events: auto;
          max-width: 900px;
          margin: 0 auto;
        }

        @media (max-width: 767px) {
          main { margin-left: 0 !important; }
          .tree-continuation-dock {
            left: 0;
            padding: 12px;
            padding-bottom: max(12px, env(safe-area-inset-bottom));
          }
          .tree-stat-grid {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
      `}</style>
    </div>
  );
}
