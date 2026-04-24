import { useMemo } from "react";
import { useGrowthTree } from "../hooks/useGrowthTree";

const PARTICLES = [
  { left: "14%", top: "72%", delay: "0.2s", duration: "8s" },
  { left: "27%", top: "64%", delay: "1.1s", duration: "10s" },
  { left: "42%", top: "76%", delay: "0.7s", duration: "9s" },
  { left: "58%", top: "69%", delay: "1.8s", duration: "11s" },
  { left: "73%", top: "74%", delay: "0.4s", duration: "8.5s" },
  { left: "84%", top: "61%", delay: "1.4s", duration: "10.5s" },
];

function TreeMark({ size = 18 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--green-bright)"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 22V12" />
      <path d="M12 12c-3-1-5-3-5-6 0-2.2 2-4 5-4s5 1.8 5 4c0 3-2 5-5 6z" />
      <path d="M12 16c-2.8 0-5 1.7-6 4" />
      <path d="M12 16c2.8 0 5 1.7 6 4" />
    </svg>
  );
}

export default function GrowthTree({ compact = false }) {
  const {
    score,
    vitality,
    stage,
    progress,
    tasks,
    message,
    vitalityMsg,
    loading,
  } = useGrowthTree();

  const visuals = useMemo(() => {
    const imgOpacity = vitality >= 80
      ? 0.8
      : vitality >= 50
        ? 0.65
        : vitality >= 20
          ? 0.5
          : 0.4;
    const glowStrength = vitality >= 80
      ? 0.35
      : vitality >= 50
        ? 0.2
        : vitality >= 20
          ? 0.08
          : 0;
    const filter = vitality < 20
      ? "saturate(0.5) brightness(0.7)"
      : vitality < 50
        ? "saturate(0.75) brightness(0.85)"
        : "saturate(1) brightness(1)";

    return { imgOpacity, glowStrength, filter };
  }, [vitality]);

  const height = compact ? 300 : 420;
  const particleOpacity = vitality >= 80 ? 1 : vitality >= 50 ? 0.55 : 0;

  if (loading) {
    return (
      <div style={{ animation: "fadeUp 0.6s ease 0.2s both" }}>
        {!compact && (
          <p style={{
            margin: "0 0 8px",
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: 2.5,
            textTransform: "uppercase",
            color: "var(--text-faint)",
            fontFamily: "var(--font-body)",
          }}>
            Growth Tree
          </p>
        )}
        <div style={{
          width: "100%",
          height,
          borderRadius: compact ? 16 : 20,
          background: "#080E0A",
          border: "1px solid rgba(46,204,113,0.08)",
          overflow: "hidden",
        }} />
      </div>
    );
  }

  return (
    <div style={{ animation: "fadeUp 0.6s ease 0.2s both" }}>
      {!compact && (
        <p style={{
          margin: "0 0 8px",
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          color: "var(--text-faint)",
          fontFamily: "var(--font-body)",
        }}>
          Growth Tree
        </p>
      )}

      <div style={{
        position: "relative",
        width: "100%",
        height,
        borderRadius: compact ? 16 : 20,
        overflow: "hidden",
        background: "#080E0A",
        border: "1px solid rgba(46,204,113,0.08)",
        boxShadow: compact ? "none" : "0 24px 70px rgba(0,0,0,0.36)",
      }}>
        <img
          key={stage.id}
          src={stage.image}
          alt={stage.name}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: visuals.imgOpacity,
            transition: "opacity 0.6s ease-in-out, filter 1.5s ease",
            filter: visuals.filter,
            animation: "stageCrossFade 0.6s ease-in-out both",
          }}
        />

        <div style={{
          position: "absolute",
          inset: 0,
          background: "linear-gradient(180deg, rgba(0,0,0,0.26) 0%, rgba(0,0,0,0.04) 46%, rgba(0,0,0,0.42) 100%)",
          zIndex: 1,
          pointerEvents: "none",
        }} />

        <div key={`glow-${score}`} style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          background: `radial-gradient(
            ellipse 60% 50% at 50% 75%,
            rgba(46,204,113,${visuals.glowStrength}),
            transparent 70%
          )`,
          transition: "all 1.5s ease",
          animation: score > 0 ? "treePulse 1.2s ease" : "none",
          pointerEvents: "none",
        }} />

        <div style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          opacity: particleOpacity,
          transition: "opacity 1.5s ease",
          pointerEvents: "none",
        }}>
          {PARTICLES.slice(0, compact ? 4 : PARTICLES.length).map((particle, index) => (
            <span
              key={index}
              style={{
                position: "absolute",
                left: particle.left,
                top: particle.top,
                width: 3,
                height: 3,
                borderRadius: "50%",
                background: "rgba(232,232,227,0.55)",
                boxShadow: "0 0 10px rgba(46,204,113,0.35)",
                animation: `treeParticle ${particle.duration} linear ${particle.delay} infinite`,
              }}
            />
          ))}
        </div>

        <div style={{
          position: "absolute",
          top: compact ? 12 : 16,
          left: compact ? 12 : 20,
          right: compact ? 12 : 20,
          zIndex: 10,
          padding: compact ? "10px 12px" : "14px 18px",
          background: "rgba(10, 15, 13, 0.55)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(46,204,113,0.15)",
          borderRadius: 14,
        }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: 10,
          }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: compact ? 7 : 10,
              minWidth: 0,
            }}>
              <TreeMark size={compact ? 16 : 18} />
              <span style={{
                fontSize: compact ? 13 : 16,
                fontWeight: 500,
                color: "var(--text)",
                fontFamily: "var(--font-body)",
                whiteSpace: "nowrap",
              }}>
                Progress
              </span>
              <span style={{
                fontSize: compact ? 16 : 20,
                fontWeight: 500,
                color: "var(--green-bright)",
                fontFamily: "var(--font-display)",
                whiteSpace: "nowrap",
              }}>
                {score} pts.
              </span>
            </div>
            <span style={{
              fontSize: compact ? 11 : 14,
              color: "var(--green-bright)",
              fontFamily: "var(--font-body)",
              whiteSpace: "nowrap",
            }}>
              {tasks.done}/{tasks.total} {compact ? "Tasks" : "Tasks Completed"}
            </span>
          </div>

          <div style={{
            height: 6,
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
              boxShadow: score > 0 ? "0 0 12px var(--green-glow)" : "none",
            }} />
          </div>
        </div>

        <div style={{
          position: "absolute",
          bottom: compact ? 16 : 20,
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 10,
          padding: "0 18px",
        }}>
          <p style={{
            margin: 0,
            fontSize: compact ? 16 : 20,
            fontFamily: "var(--font-display)",
            fontWeight: 500,
            color: "var(--green-bright)",
            fontStyle: "italic",
            textShadow: "0 2px 12px rgba(0,0,0,0.64)",
          }}>
            {message}
          </p>
          <p style={{
            margin: "4px 0 0",
            fontSize: compact ? 11 : 12,
            color: "rgba(232,232,227,0.45)",
            fontFamily: "var(--font-body)",
            letterSpacing: 1,
            textShadow: "0 2px 8px rgba(0,0,0,0.6)",
          }}>
            Stage {stage.id} - {stage.name} - {vitalityMsg}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes treePulse {
          0% {
            background: radial-gradient(
              ellipse 60% 50% at 50% 75%,
              rgba(46,204,113,${visuals.glowStrength}),
              transparent 70%
            );
          }
          50% {
            background: radial-gradient(
              ellipse 65% 55% at 50% 75%,
              rgba(46,204,113,0.45),
              transparent 70%
            );
          }
          100% {
            background: radial-gradient(
              ellipse 60% 50% at 50% 75%,
              rgba(46,204,113,${visuals.glowStrength}),
              transparent 70%
            );
          }
        }

        @keyframes treeParticle {
          0% { transform: translate3d(0, 0, 0); opacity: 0; }
          15% { opacity: 0.55; }
          85% { opacity: 0.45; }
          100% { transform: translate3d(18px, -98px, 0); opacity: 0; }
        }

        @keyframes stageCrossFade {
          from { opacity: 0; }
          to { opacity: ${visuals.imgOpacity}; }
        }
      `}</style>
    </div>
  );
}
