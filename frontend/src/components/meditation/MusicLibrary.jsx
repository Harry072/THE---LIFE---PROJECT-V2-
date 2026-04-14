import React, { useState } from "react";
import { MUSIC_TRACKS, CATEGORIES } from "../../data/musicLibrary";
import TrackCard from "./TrackCard";
import NowPlayingBar from "./NowPlayingBar";
import { useMusicPlayer } from "../../hooks/useMusicPlayer";

export default function MusicLibrary() {
  const [activeCategory, setActiveCategory] = useState("all");
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    play,
    togglePlay,
    seek,
    setVolume,
  } = useMusicPlayer();

  const filteredTracks =
    activeCategory === "all"
      ? MUSIC_TRACKS
      : MUSIC_TRACKS.filter((t) => t.category === activeCategory);

  return (
    <div className="music-library">
      {/* Category filter tabs */}
      <div className="category-tabs">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            className={`category-pill ${activeCategory === cat.id ? "active" : ""}`}
            onClick={() => setActiveCategory(cat.id)}
            aria-label={`Filter by ${cat.label}`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Track grid */}
      {filteredTracks.length > 0 ? (
        <div className="track-grid">
          {filteredTracks.map((track) => (
            <TrackCard
              key={track.id}
              track={track}
              isActive={currentTrack?.id === track.id && isPlaying}
              onClick={play}
            />
          ))}
        </div>
      ) : (
        <div className="music-empty">
          <div className="music-empty-icon">🎵</div>
          <p>More tracks coming soon</p>
        </div>
      )}

      {/* Now Playing Bar */}
      <NowPlayingBar
        track={currentTrack}
        isPlaying={isPlaying}
        progress={progress}
        duration={duration}
        volume={volume}
        onPlayPause={togglePlay}
        onSeek={seek}
        onVolumeChange={setVolume}
      />
    </div>
  );
}
