import React from "react";

export default function NowPlayingBar({
  track,
  isPlaying,
  progress,
  duration,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
}) {
  if (!track) return null;

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div className="now-playing-bar">
      {/* Track info */}
      <div className="now-playing-info">
        <p className="now-playing-title">{track.title}</p>
        <p className="now-playing-artist">{track.artist}</p>
      </div>

      {/* Play/Pause */}
      <button
        className="now-playing-play-btn"
        onClick={onPlayPause}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "⏸" : "▶"}
      </button>

      {/* Progress */}
      <div className="now-playing-progress">
        <span className="now-playing-time">{fmt(progress)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          value={progress}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Seek"
        />
        <span className="now-playing-time">{fmt(duration)}</span>
      </div>

      {/* Volume */}
      <div className="now-playing-volume">
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </div>
  );
}
