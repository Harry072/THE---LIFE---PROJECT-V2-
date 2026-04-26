import { useState } from "react";

const STORY_SLIDES = [
  "Most people do not fail because they lack potential. They fail because attention gets trapped in loops: scrolling, overthinking, delaying, escaping.",
  "The first step is not motivation. The first step is seeing clearly what is happening inside you.",
  "When a person finds one useful thing to do, distraction begins to lose its grip.",
  "The Loop gives you three practices: one for awareness, one for action, and one for meaning.",
  "Complete them slowly. Your score grows. Your streak continues. Your tree gains life. Small actions become identity.",
];

export default function LoopIntroStory({ isOpen, onDismiss }) {
  const [slideIndex, setSlideIndex] = useState(0);

  if (!isOpen) return null;

  const isFinalSlide = slideIndex === STORY_SLIDES.length - 1;

  const handleDismiss = () => {
    setSlideIndex(0);
    onDismiss?.();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="loop-intro-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        background:
          "radial-gradient(circle at 50% 0%, rgba(46,204,113,0.16), transparent 34%), rgba(0,0,0,0.74)",
        backdropFilter: "blur(12px)",
      }}
      onClick={handleDismiss}
    >
      <div
        style={{
          width: "min(560px, 100%)",
          borderRadius: 24,
          border: "1px solid rgba(126, 217, 154, 0.22)",
          background:
            "linear-gradient(180deg, rgba(13,23,18,0.98) 0%, rgba(5,10,8,0.96) 100%)",
          boxShadow: "0 28px 90px rgba(0,0,0,0.52)",
          color: "var(--text, #fff)",
          overflow: "hidden",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            padding: "28px 28px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 18,
            }}
          >
            <div>
              <p
                style={{
                  margin: "0 0 10px",
                  color: "rgba(126,217,154,0.86)",
                  fontSize: 11,
                  letterSpacing: 2.4,
                  textTransform: "uppercase",
                  fontFamily: "var(--font-body)",
                }}
              >
                The Loop
              </p>
              <h2
                id="loop-intro-title"
                style={{
                  margin: 0,
                  fontSize: "clamp(28px, 5vw, 40px)",
                  lineHeight: 1.05,
                  fontFamily: "var(--font-display)",
                  fontWeight: 600,
                }}
              >
                Before You Begin
              </h2>
            </div>
            <button
              type="button"
              aria-label="Close story"
              onClick={handleDismiss}
              style={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                color: "rgba(255,255,255,0.72)",
                cursor: "pointer",
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              x
            </button>
          </div>

          <p
            style={{
              margin: "18px 0 0",
              color: "rgba(255,255,255,0.72)",
              fontSize: 15,
              lineHeight: 1.7,
              fontFamily: "var(--font-body)",
            }}
          >
            These tasks are not here to make you busy. They are here to return
            you to useful action.
          </p>
        </div>

        <div style={{ padding: "28px" }}>
          <p
            style={{
              minHeight: 128,
              margin: 0,
              color: "rgba(255,255,255,0.86)",
              fontSize: "clamp(18px, 4vw, 24px)",
              lineHeight: 1.55,
              fontFamily: "var(--font-display)",
            }}
          >
            {STORY_SLIDES[slideIndex]}
          </p>

          <div
            aria-hidden="true"
            style={{
              display: "flex",
              gap: 8,
              marginTop: 28,
            }}
          >
            {STORY_SLIDES.map((_, index) => (
              <span
                key={index}
                style={{
                  width: index === slideIndex ? 26 : 8,
                  height: 8,
                  borderRadius: 999,
                  background:
                    index === slideIndex
                      ? "var(--green-bright, #2ECC71)"
                      : "rgba(255,255,255,0.16)",
                  transition: "all 0.24s ease",
                }}
              />
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              marginTop: 28,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              onClick={() => setSlideIndex(Math.max(0, slideIndex - 1))}
              disabled={slideIndex === 0}
              style={{
                padding: "10px 16px",
                borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.04)",
                color:
                  slideIndex === 0
                    ? "rgba(255,255,255,0.28)"
                    : "rgba(255,255,255,0.74)",
                cursor: slideIndex === 0 ? "default" : "pointer",
                fontSize: 13,
                fontFamily: "var(--font-body)",
              }}
            >
              Back
            </button>

            <button
              type="button"
              onClick={() => {
                if (isFinalSlide) {
                  handleDismiss();
                } else {
                  setSlideIndex(slideIndex + 1);
                }
              }}
              style={{
                padding: "12px 22px",
                borderRadius: 999,
                border: "1px solid rgba(46,204,113,0.34)",
                background:
                  "linear-gradient(135deg, rgba(46,204,113,0.94), rgba(126,217,154,0.88))",
                color: "#05100b",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                fontFamily: "var(--font-body)",
                boxShadow: "0 14px 30px rgba(46,204,113,0.18)",
              }}
            >
              {isFinalSlide ? "Begin Today's Loop" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
