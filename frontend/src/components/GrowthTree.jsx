/**
 * GrowthTree — Cinematic tree component.
 *
 * Renders a dark forest floor background with the tree image for the current
 * stage, a glassmorphism progress bar, ambient glow, and encouragement text.
 * Cross-fades between stages. Uses SVG fallback when images fail to load.
 *
 * Props:
 *   compact  — boolean (default false). If true renders at 280px for sidebar.
 */
import { useState, useEffect, useRef } from "react";
import { useGrowthTree } from "../hooks/useGrowthTree";
import SvgTree from "./SvgTree";
import StageUpOverlay from "./StageUpOverlay";

export default function GrowthTree({ compact = false }) {
  const {
    score, vitality, stage, progress,
    todayTasks, message, stageMessage,
    loading, stageUp, dismissStageUp,
  } = useGrowthTree();

  const [prevStage, setPrevStage] = useState(stage);
  const [transitioning, setTransitioning] = useState(false);
  const [glowPulse, setGlowPulse] = useState(false);
  const [imgError, setImgError] = useState(false);
  const prevScore = useRef(score);

  // Cross-fade on stage change
  useEffect(() => {
    if (stage.id !== prevStage.id) {
      setTransitioning(true);
      setImgError(false);
      setTimeout(() => {
        setPrevStage(stage);
        setTransitioning(false);
      }, 800);
    }
  }, [stage]);

  // Glow pulse on score increase
  useEffect(() => {
    if (score > prevScore.current) {
      setGlowPulse(true);
      const t = setTimeout(() => setGlowPulse(false), 1200);
      prevScore.current = score;
      return () => clearTimeout(t);
    }
    prevScore.current = score;
  }, [score]);

  if (loading) {
    return (
      <div style={{
        width: "100%",
        height: compact ? 280 : 400,
        borderRadius: compact ? 16 : 20,
        background: "#0A0E0C",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}>
        <div style={{
          width: 32, height: 32,
          border: "2px solid rgba(46,204,113,0.2)",
          borderTopColor: "var(--green-bright)",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const glowOpacity = vitality >= 80
    ? 0.35 : vitality >= 50
    ? 0.2 : vitality >= 20
    ? 0.08 : 0;

  const height = compact ? 280 : 400;

  return (
    <>
      <div style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: compact ? 16 : 20,
        overflow: "hidden",
        background: "#0A0E0C",
        animation: "fadeUp 0.6s ease 0.3s both",
      }}>
        {/* Forest floor background */}
        <img
          src="/media/tree/forest-floor.jpg"
          alt=""
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover", opacity: 0.6,
          }}
        />

        {/* Ambient glow */}
        <div style={{
          position: "absolute", inset: 0,
          background: `radial-gradient(
            ellipse 80% 60% at 50% 100%,
            rgba(46,204,113,${glowOpacity * 0.8}),
            transparent 80%
          )`,
          transition: "all 1.5s ease",
          animation: glowPulse
            ? "treePulse 1.2s ease" : "ambientLight 8s ease-in-out infinite alternate",
        }} />

        {/* Cinematic Sunbeams Overlay */}
        <div style={{
          position: "absolute",
          top: -100, right: -100,
          width: "150%", height: "150%",
          background: "radial-gradient(circle at 80% 20%, rgba(255, 240, 180, 0.15), transparent 60%)",
          transform: "rotate(-15deg)",
          zIndex: 1,
          pointerEvents: "none",
        }} />
        <div style={{
          position: "absolute",
          top: 0, right: 0,
          width: "100%", height: "100%",
          background: "repeating-linear-gradient(115deg, rgba(255,255,255,0.03) 0px, transparent 100px, rgba(255,255,255,0.03) 200px)",
          maskImage: "radial-gradient(circle at 100% 0%, black, transparent 70%)",
          WebkitMaskImage: "radial-gradient(circle at 100% 0%, black, transparent 70%)",
          zIndex: 1,
          pointerEvents: "none",
          opacity: 0.4,
        }} />

        {/* Floating Particles (Dust/Pollen) */}
        <div className="particles-container" style={{
          position: "absolute", inset: 0,
          zIndex: 1,
          pointerEvents: "none",
        }}>
          {Array.from({ length: compact ? 8 : 15 }).map((_, i) => (
            <div key={i} className="particle" style={{
              position: "absolute",
              width: 2, height: 2,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.4)",
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.5,
              animation: `particleFloat ${5 + Math.random() * 10}s linear infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }} />
          ))}
        </div>

        {/* Tree image or SVG fallback */}
        {imgError ? (
          <div style={{
            position: "absolute",
            bottom: compact ? 40 : 60,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 2,
            filter: vitality < 20
              ? "saturate(0.5) brightness(0.7)"
              : vitality < 50
              ? "saturate(0.8)"
              : "none",
            transition: "filter 1.5s ease",
          }}>
            <SvgTree stage={stage} vitality={vitality} />
          </div>
        ) : (
          <img
            src={stage.image}
            alt={stage.name}
            onError={() => setImgError(true)}
            style={{
              position: "absolute",
              bottom: 0,
              left: "50%",
              transform: "translateX(-50%)",
              height: "75%",
              objectFit: "contain",
              opacity: transitioning ? 0 : 1,
              transition: "opacity 0.8s ease-in-out, filter 1.5s ease",
              filter: vitality < 20
                ? "saturate(0.5) brightness(0.7)"
                : vitality < 50
                ? "saturate(0.8)"
                : "none",
              zIndex: 2,
              animation: "treeSway 6s ease-in-out infinite",
              transformOrigin: "bottom center",
            }}
          />
        )}

        {/* Progress bar (glassmorphism overlay) */}
        <div style={{
          position: "absolute",
          top: compact ? 10 : 16,
          left: compact ? 10 : 20,
          right: compact ? 10 : 20,
          zIndex: 10,
          padding: compact ? "8px 12px" : "12px 16px",
          background: "rgba(10, 15, 13, 0.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(46,204,113,0.15)",
          borderRadius: 14,
        }}>
            <div style={{
              display: "flex",
              alignItems: "baseline", gap: 10,
            }}>
              <span style={{
                fontSize: compact ? 12 : 24,
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                color: "var(--text)",
                letterSpacing: "0.02em",
              }}>
                Progress
              </span>
              <span style={{
                fontSize: compact ? 14 : 22,
                fontFamily: "var(--font-display)",
                fontWeight: 400,
                color: "rgba(232, 232, 227, 0.6)",
              }}>
                {score} pts.
              </span>
            </div>
            <span style={{
              fontSize: compact ? 11 : 14,
              color: "var(--green-bright)",
              fontFamily: "var(--font-body)",
              opacity: 0.8,
              letterSpacing: "0.01em",
            }}>
              {todayTasks.done}/{todayTasks.total} {compact ? "" : "Tasks Completed"}
            </span>

          {/* Progress bar track */}
          <div style={{
            height: compact ? 4 : 6,
            borderRadius: 3,
            background: "rgba(255,255,255,0.08)",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${progress}%`,
              borderRadius: 3,
              background: "linear-gradient(90deg, var(--green), var(--green-bright))",
              transition: "width 0.8s ease",
              boxShadow: glowPulse
                ? "0 0 12px var(--green-glow)" : "none",
            }} />
          </div>
        </div>

        {/* Bottom labels */}
        <div style={{
          position: "absolute",
          bottom: compact ? 8 : 16,
          left: 0, right: 0,
          textAlign: "center",
          zIndex: 10,
        }}>
          <p style={{
            margin: 0,
            fontSize: compact ? 14 : 22,
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            color: "var(--green-bright)",
            textShadow: "0 2px 10px rgba(0,0,0,0.6)",
            letterSpacing: "0.03em",
          }}>
            You’re Growing +
          </p>
          <p style={{
            margin: "4px 0 0",
            fontSize: compact ? 11 : 14,
            color: "rgba(232,232,227,0.4)",
            fontFamily: "var(--font-body)",
            textShadow: "0 1px 4px rgba(0,0,0,0.5)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
          }}>
            Keep Going!
          </p>
        </div>

        <style>{`
          @keyframes treePulse {
            0% { 
              opacity: 1; 
              background: radial-gradient(ellipse 60% 50% at 50% 70%, rgba(46,204,113,0.1), transparent 70%);
            }
            50% { 
              opacity: 1;
              background: radial-gradient(
                ellipse 85% 75% at 50% 70%,
                rgba(46,204,113,0.5),
                transparent 70%); 
            }
            100% { 
              opacity: 1; 
              background: radial-gradient(ellipse 60% 50% at 50% 70%, rgba(46,204,113,0.1), transparent 70%);
            }
          }

          @keyframes treeSway {
            0%, 100% { transform: translateX(-50%) rotate(0deg) skewX(0deg); }
            25% { transform: translateX(-50%) rotate(0.5deg) skewX(0.2deg); }
            75% { transform: translateX(-50%) rotate(-0.5deg) skewX(-0.2deg); }
          }

          @keyframes ambientLight {
            0% { opacity: 0.6; transform: scale(1); }
            100% { opacity: 1; transform: scale(1.1); }
          }

          @keyframes particleFloat {
            0% { transform: translate(0, 0); opacity: 0; }
            10% { opacity: 0.5; }
            90% { opacity: 0.5; }
            100% { transform: translate(20px, -100px); opacity: 0; }
          }
        `}</style>
      </div>

      {/* Stage-up celebration overlay */}
      <StageUpOverlay stageUp={stageUp} onDismiss={dismissStageUp} />
    </>
  );
}
