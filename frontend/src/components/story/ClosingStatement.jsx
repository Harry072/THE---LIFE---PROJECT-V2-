import React from "react";
import { Link } from "react-router-dom";

export default function ClosingStatement({ quote, tagline }) {
  return (
    <div className="story-closing">
      <h3 className="closing-quote">"{quote}"</h3>
      <div className="closing-divider" />
      <p className="closing-tagline">{tagline}</p>
      
      <Link to="/dashboard" className="closing-cta">
        Return to The Loop
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M12 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}
