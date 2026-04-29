import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../Icon";
import WeeklyMirrorModal from "../weeklyMirror/WeeklyMirrorModal";
import { useWeeklyMirror } from "../../hooks/useWeeklyMirror";

export default function WeeklyMirrorCard() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [phase, setPhase] = useState("intro");
  const {
    status,
    synthesis,
    error,
    loading,
    revealWeeklyMirror,
    carryFocus,
    carryRecommendation,
    reset,
  } = useWeeklyMirror();

  const openMirror = () => {
    reset();
    setPhase("intro");
    setIsOpen(true);
  };

  const closeMirror = () => {
    setIsOpen(false);
  };

  const revealPattern = async () => {
    setPhase("loading");
    const payload = await revealWeeklyMirror();
    if (payload?.status === "success") {
      setPhase("result");
    } else if (payload?.status === "fallback") {
      setPhase("fallback");
    } else if (payload?.status === "insufficient_data") {
      setPhase("insufficient_data");
    } else {
      setPhase("error");
    }
  };

  const isStillForming = status === "insufficient_data";

  const handleRecommendationAction = (recommendation) => {
    const routeByType = {
      task: "/loop",
      reflection: "/reflection",
      reset: "/meditation",
      book: "/curator",
    };
    const recommendationType = recommendation?.type;

    if (recommendationType === "real_world_action") {
      carryRecommendation(recommendation);
      closeMirror();
      return;
    }

    const route = routeByType[recommendationType];
    if (route) {
      closeMirror();
      navigate(route);
      return;
    }

    carryRecommendation(recommendation);
    closeMirror();
  };

  return (
    <>
      <section
        className="weekly-mirror-card"
        style={{
          position: "relative",
          overflow: "hidden",
          minHeight: 136,
          marginBottom: 24,
          padding: "22px 24px",
          border: "1px solid rgba(126, 217, 154, 0.18)",
          borderRadius: "var(--r-md)",
          background:
            "linear-gradient(135deg, rgba(6, 22, 16, 0.9), rgba(16, 26, 20, 0.68)), url('/media/misty-lake.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          boxShadow: "var(--shadow-soft)",
          backdropFilter: "blur(24px)",
          animation: "fadeUp 0.6s ease 0.42s both",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(circle at 85% 20%, rgba(240, 165, 0, 0.12), transparent 32%), " +
              "radial-gradient(circle at 15% 80%, rgba(46, 204, 113, 0.12), transparent 38%), " +
              "linear-gradient(90deg, rgba(4, 10, 8, 0.92), rgba(4, 10, 8, 0.58))",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            right: 24,
            top: 18,
            width: 96,
            height: 96,
            borderRadius: "50%",
            border: "1px solid rgba(126, 217, 154, 0.2)",
            background:
              "repeating-radial-gradient(circle, transparent 0 12px, rgba(126, 217, 154, 0.14) 13px 14px)",
            opacity: 0.8,
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) auto",
            gap: 18,
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h3
              style={{
                margin: "0 0 8px",
                color: "var(--text)",
                fontFamily: "var(--font-display)",
                fontSize: "clamp(24px, 4vw, 32px)",
                fontWeight: 500,
                lineHeight: 1.12,
              }}
            >
              Weekly Mirror
            </h3>
            <p
              style={{
                margin: 0,
                color: "rgba(232, 232, 227, 0.72)",
                fontSize: 14,
                lineHeight: 1.55,
              }}
            >
              A quiet look at what your week has been teaching you.
            </p>
            <p
              style={{
                margin: "10px 0 0",
                color: "rgba(232, 232, 227, 0.58)",
                fontSize: 13,
                lineHeight: 1.5,
              }}
            >
              {isStillForming
                ? "Your mirror is still forming. Save a few reflections and complete small tasks this week."
                : "Built from your reflections, tasks, and inner weather."}
            </p>
          </div>

          <button
            type="button"
            onClick={openMirror}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              border: "1px solid rgba(46, 204, 113, 0.35)",
              borderRadius: 999,
              background: "linear-gradient(135deg, var(--green), var(--green-bright))",
              color: "#03110b",
              cursor: loading ? "default" : "pointer",
              fontFamily: "var(--font-body)",
              fontSize: 13,
              fontWeight: 800,
              lineHeight: 1,
              padding: "13px 18px",
              whiteSpace: "nowrap",
              boxShadow: "0 12px 28px rgba(46, 204, 113, 0.18)",
              opacity: loading ? 0.72 : 1,
            }}
          >
            <Icon name="sprout" size={16} />
            Reveal My Week
          </button>
        </div>
      </section>

      <WeeklyMirrorModal
        isOpen={isOpen}
        phase={phase}
        status={status}
        synthesis={synthesis}
        error={error}
        onClose={closeMirror}
        onReveal={revealPattern}
        onCarryFocus={carryFocus}
        onRecommendationAction={handleRecommendationAction}
      />

      <style>{`
        @media (max-width: 720px) {
          .weekly-mirror-card > div:last-of-type {
            grid-template-columns: 1fr !important;
          }

          .weekly-mirror-card button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
