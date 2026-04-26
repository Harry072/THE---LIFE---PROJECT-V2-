import { useState } from "react";

const WHY_CHOSEN_FALLBACKS = {
  awareness: "This practice helps you notice the inner loop before it controls the day.",
  action: "This practice turns mental noise into one useful movement.",
  meaning: "This practice connects the day to something larger than distraction.",
};

const getWhyChosen = (task) => {
  const explicitReason = String(task?.why_chosen || "").trim();
  if (explicitReason) return explicitReason;

  const category = String(task?.category || "").trim().toLowerCase();
  return (
    WHY_CHOSEN_FALLBACKS[category] ||
    "Based on your current growth path, this practice helps turn awareness into action."
  );
};

export default function LoopDetailContent({ task, isMobile = false }) {
  const [showWhy, setShowWhy] = useState(false);

  if (!task) return null;

  const detailDescription = String(task.detail_description || "").trim();
  const whyChosen = getWhyChosen(task);
  const duration = task.duration_minutes || task.estimated_duration_mins;
  const metaParts = [task.preferred_time, duration ? `${duration} Minutes` : null]
    .filter(Boolean);

  return (
    <div
      style={{
        position: isMobile ? "relative" : "absolute",
        inset: isMobile ? "auto" : "auto 0 0 0",
        color: "white",
        animation: isMobile ? "fadeUp 0.3s ease both" : "none",
      }}
    >
      <div
        className="loop-detail-content-shell"
        style={{
          position: "relative",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 0,
            pointerEvents: "none",
            background:
              "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.62) 54%, rgba(0,0,0,0.18) 86%, rgba(0,0,0,0) 100%)",
          }}
        />

        <div
          className="loop-detail-content-scroll max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-500/80 scrollbar-track-transparent"
          style={{
            position: "relative",
            zIndex: 1,
            maxHeight: isMobile ? "52vh" : "60vh",
            overflowY: "auto",
            padding: isMobile ? "18px 18px 14px" : "84px 28px 28px",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(107, 114, 128, 0.85) transparent",
          }}
        >
          <h3
            style={{
              margin: "0 0 14px",
              fontSize: isMobile ? 22 : 30,
              fontWeight: 500,
              fontFamily: "var(--font-display)",
              lineHeight: 1.12,
              letterSpacing: "0.01em",
              maxWidth: "92%",
            }}
          >
            {task.detail_title || task.title}
          </h3>

          {detailDescription && (
            <div
              className="rounded-[20px] border border-white/10 bg-black/40 p-5"
              style={{
                marginBottom: 18,
                padding: isMobile ? "18px 18px 20px" : "22px 22px 24px",
                borderRadius: 20,
                border: "1px solid rgba(255,255,255,0.1)",
                background:
                  "linear-gradient(180deg, rgba(10,16,14,0.84) 0%, rgba(4,7,6,0.66) 100%)",
                backdropFilter: "blur(16px)",
                boxShadow: "0 18px 44px rgba(0,0,0,0.24)",
                overflow: "hidden",
              }}
            >
              <p
                className="whitespace-pre-wrap text-white/80 leading-relaxed"
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.78,
                  letterSpacing: "0.015em",
                  fontFamily: "var(--font-body)",
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                }}
              >
                {detailDescription}
              </p>
            </div>
          )}

          {whyChosen && (
            <div
              style={{
                margin: "0 0 18px",
                padding: "14px 16px",
                borderRadius: 16,
                border: "1px solid rgba(126,217,154,0.16)",
                background: "rgba(46,204,113,0.055)",
              }}
            >
              <p
                style={{
                  margin: "0 0 6px",
                  fontSize: 10,
                  lineHeight: 1.4,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "rgba(126,217,154,0.78)",
                  fontFamily: "var(--font-body)",
                }}
              >
                Why this was chosen
              </p>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  lineHeight: 1.62,
                  color: "rgba(255,255,255,0.72)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {whyChosen}
              </p>
            </div>
          )}

          {metaParts.length > 0 && (
            <p
              style={{
                margin: "0 0 18px",
                fontSize: 12,
                lineHeight: 1.5,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "rgba(255,255,255,0.46)",
                fontFamily: "var(--font-body)",
              }}
            >
              {metaParts.join(" · ")}
            </p>
          )}

          <button
            onClick={(event) => {
              event.stopPropagation();
              setShowWhy(!showWhy);
            }}
            style={{
              padding: "9px 20px",
              background: showWhy
                ? "rgba(255,255,255,0.16)"
                : "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              color: "white",
              fontSize: 13,
              letterSpacing: "0.04em",
              fontFamily: "var(--font-body)",
              cursor: "pointer",
              transition: "all 0.3s ease",
            }}
          >
            {showWhy ? "Close" : "Why this helps"}
          </button>

          {showWhy && task.why && (
            <div
              style={{
                marginTop: 16,
                padding: "16px 18px",
                background: "rgba(0,0,0,0.38)",
                backdropFilter: "blur(14px)",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.1)",
                animation: "fadeUp 0.3s ease both",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  lineHeight: 1.72,
                  letterSpacing: "0.01em",
                  color: "rgba(255,255,255,0.8)",
                  fontFamily: "var(--font-body)",
                }}
              >
                {task.why}
              </p>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .loop-detail-content-scroll::-webkit-scrollbar {
          width: 6px;
        }

        .loop-detail-content-scroll::-webkit-scrollbar-track {
          background: transparent;
        }

        .loop-detail-content-scroll::-webkit-scrollbar-thumb {
          background: rgba(107, 114, 128, 0.85);
          border-radius: 999px;
        }

        .loop-detail-content-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(156, 163, 175, 0.95);
        }
      `}</style>
    </div>
  );
}
