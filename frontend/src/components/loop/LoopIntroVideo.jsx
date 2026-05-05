import { useEffect, useState } from "react";

const LOOP_INTRO_VIDEO_SRC = "/media/loop-intro-story.mp4";

export default function LoopIntroVideo({ isOpen, onDismiss }) {
  const [hasVideoError, setHasVideoError] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onDismiss?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onDismiss]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loop-intro-video-title"
      className="loop-intro-video-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(14px)",
      }}
    >
      <div
        className="loop-intro-video-shell"
        style={{
          width: "100%",
          maxWidth: 900,
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 28,
          border: "1px solid rgba(126,217,154,0.22)",
          background:
            "linear-gradient(180deg, rgba(6,17,15,0.98) 0%, rgba(2,8,7,0.97) 100%)",
          boxShadow:
            "0 30px 100px rgba(0,0,0,0.55), 0 0 44px rgba(46,204,113,0.08)",
          color: "var(--text, #fff)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 18,
            padding: "24px 24px 18px",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 9px",
                color: "rgba(126,217,154,0.82)",
                fontSize: 11,
                letterSpacing: 2.3,
                textTransform: "uppercase",
                fontFamily: "var(--font-body)",
              }}
            >
              The Loop
            </p>
            <h2
              id="loop-intro-video-title"
              style={{
                margin: 0,
                fontSize: "clamp(28px, 5vw, 42px)",
                lineHeight: 1.05,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
              }}
            >
              Before You Begin
            </h2>
            <p
              style={{
                maxWidth: 640,
                margin: "14px 0 0",
                color: "rgba(255,255,255,0.7)",
                fontSize: 15,
                lineHeight: 1.65,
                fontFamily: "var(--font-body)",
              }}
            >
              These tasks are not here to make you busy. They are here to return
              you to useful action.
            </p>
          </div>

          <button
            type="button"
            aria-label="Close intro video"
            className="loop-intro-video-control"
            onClick={onDismiss}
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.06)",
              color: "rgba(255,255,255,0.74)",
              cursor: "pointer",
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            x
          </button>
        </div>

        <div style={{ padding: "0 24px 24px" }}>
          <div
            style={{
              margin: "0 auto",
              display: "flex",
              maxHeight: "70vh",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderRadius: 20,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "#000",
              boxShadow: "0 18px 56px rgba(0,0,0,0.38)",
            }}
          >
            {hasVideoError ? (
              <div
                style={{
                  width: "100%",
                  minHeight: 280,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 18,
                  padding: 28,
                  textAlign: "center",
                  background:
                    "radial-gradient(circle at 50% 0%, rgba(46,204,113,0.12), transparent 38%), #000",
                }}
              >
                <p
                  style={{
                    maxWidth: 460,
                    margin: 0,
                    color: "rgba(255,255,255,0.78)",
                    fontSize: 16,
                    lineHeight: 1.65,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  The Loop story is unavailable right now. You can still begin
                  today&apos;s practices.
                </p>
                <button
                  type="button"
                  className="loop-intro-video-primary loop-intro-video-control"
                  onClick={onDismiss}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 999,
                    border: "1px solid rgba(46,204,113,0.34)",
                    background:
                      "linear-gradient(135deg, rgba(46,204,113,0.94), rgba(126,217,154,0.88))",
                    color: "#04100a",
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  Begin Today&apos;s Loop
                </button>
              </div>
            ) : (
              <video
                controls
                playsInline
                preload="metadata"
                aria-label="The Loop story video"
                title="The Loop story video"
                onError={() => setHasVideoError(true)}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "70vh",
                  objectFit: "contain",
                  background: "#000",
                  borderRadius: 20,
                  display: "block",
                }}
              >
                <source src={LOOP_INTRO_VIDEO_SRC} type="video/mp4" />
              </video>
            )}
          </div>

          {!hasVideoError && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginTop: 20,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                className="loop-intro-video-secondary loop-intro-video-control"
                onClick={onDismiss}
                style={{
                  padding: "11px 16px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(255,255,255,0.72)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontFamily: "var(--font-body)",
                }}
              >
                Skip for now
              </button>

              <button
                type="button"
                className="loop-intro-video-primary loop-intro-video-control"
                onClick={onDismiss}
                style={{
                  padding: "12px 22px",
                  borderRadius: 999,
                  border: "1px solid rgba(46,204,113,0.34)",
                  background:
                    "linear-gradient(135deg, rgba(46,204,113,0.94), rgba(126,217,154,0.88))",
                  color: "#04100a",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 700,
                  fontFamily: "var(--font-body)",
                  boxShadow: "0 14px 30px rgba(46,204,113,0.18)",
                }}
              >
                Begin Today&apos;s Loop
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .loop-intro-video-control:focus-visible {
          outline: 2px solid rgba(126, 217, 154, 0.92);
          outline-offset: 3px;
        }

        .loop-intro-video-shell::-webkit-scrollbar {
          width: 8px;
        }

        .loop-intro-video-shell::-webkit-scrollbar-track {
          background: transparent;
        }

        .loop-intro-video-shell::-webkit-scrollbar-thumb {
          background: rgba(126, 217, 154, 0.32);
          border-radius: 999px;
        }

        @media (max-width: 640px) {
          .loop-intro-video-overlay {
            padding: 12px !important;
            align-items: center !important;
          }

          .loop-intro-video-shell {
            max-height: 92vh !important;
            border-radius: 22px !important;
          }
        }
      `}</style>
    </div>
  );
}
