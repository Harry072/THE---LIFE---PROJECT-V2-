import React from "react";

export default function TrackCard({ track, isActive, onClick }) {
  const fmt = (s) => `${Math.floor(s / 60)} min`;

  return (
    <div
      className={`track-card ${isActive ? "active" : ""}`}
      onClick={() => onClick(track)}
      role="button"
      tabIndex={0}
      aria-label={`Play ${track.title} by ${track.artist}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(track);
        }
      }}
    >
      {/* Cover image */}
      <img
        src={track.coverImage}
        alt={track.title}
        className="track-card-img"
        loading="lazy"
        onError={(e) => {
          // Fallback gradient if image fails to load
          e.target.style.display = "none";
          e.target.parentElement.style.background = `linear-gradient(135deg, 
            ${track.mood === "calm" ? "#1a3525" : 
              track.mood === "deep" ? "#1A2535" : 
              track.mood === "uplifting" ? "#2A3520" : "#2A2045"}, 
            #0A0F0D)`;
        }}
      />

      {/* Gradient overlay */}
      <div className="track-card-overlay" />

      {/* Duration badge */}
      <span className="track-card-badge">{fmt(track.duration)}</span>

      {/* Track info */}
      <div className="track-card-info">
        <h4 className="track-card-title">{track.title}</h4>
        <p className="track-card-subtitle">
          {track.category} · {track.artist}
        </p>
      </div>

      {/* Playing indicator (equalizer bars) */}
      {isActive && (
        <div className="eq-bars">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="eq-bar"
              style={{
                animation: `eqBar 0.8s ease-in-out ${i * 0.15}s infinite alternate`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
