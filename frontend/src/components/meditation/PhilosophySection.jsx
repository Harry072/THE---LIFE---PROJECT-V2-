import React, { useState } from "react";
import { PHILOSOPHY_INSIGHTS, CORE_QUOTE } from "../../data/meditationPhilosophy";

export default function PhilosophySection() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ width: "100%", maxWidth: 600, display: "flex", flexDirection: "column", alignItems: "center" }}>
      <button
        className={`philosophy-toggle ${isOpen ? "open" : ""}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Toggle philosophy insights"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 9l6 6 6-6" />
        </svg>
        {isOpen ? "Hide" : "Show"} Philosophy & Insights
      </button>

      {isOpen && (
        <>
          <div className="philosophy-cards">
            {PHILOSOPHY_INSIGHTS.map((insight, i) => (
              <div
                key={i}
                className="philosophy-card"
                style={{
                  animation: `fadeUp 0.4s ease ${i * 0.08}s both`,
                }}
              >
                <h4>{insight.title}</h4>
                <p>{insight.text}</p>
              </div>
            ))}
          </div>

          <p className="philosophy-quote">{CORE_QUOTE.text}</p>
          <p className="philosophy-quote-author">— {CORE_QUOTE.author}</p>
        </>
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
