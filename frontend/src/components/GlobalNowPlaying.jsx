import { useAppState } from "../contexts/AppStateContext";
import Icon from "./Icon";

export default function GlobalNowPlaying() {
  const { 
    currentTrack, 
    isPlaying, 
    progress, 
    duration, 
    seek, 
    togglePlay 
  } = useAppState();

  if (!currentTrack) return null;

  const formatTime = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 0, 
      left: 240, 
      right: 0,
      height: 72,
      background: "rgba(13, 19, 16, 0.95)",
      backdropFilter: "blur(24px)",
      borderTop: "1px solid rgba(255,255,255,0.08)",
      display: "flex", 
      alignItems: "center",
      padding: "0 32px", 
      gap: 24,
      zIndex: 100,
      transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    }}>
      {/* Track Info */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, width: 280, minWidth: 280 }}>
        {currentTrack.coverImage && (
          <img src={currentTrack.coverImage} alt=""
            style={{ 
              width: 48, 
              height: 48, 
              borderRadius: 12,
              objectFit: "cover",
              boxShadow: "0 8px 16px rgba(0,0,0,0.4)" 
            }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ 
            margin: 0, 
            fontSize: 14,
            color: "#FFFFFF",
            fontWeight: 600,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis" 
          }}>
            {currentTrack.title}
          </p>
          <p style={{ 
            margin: 0, 
            fontSize: 12,
            color: "rgba(255,255,255,0.5)",
            marginTop: 2
          }}>
            {currentTrack.artist || "The Life Project"}
          </p>
        </div>
      </div>

      {/* Play/Pause Control */}
      <button
        onClick={() => togglePlay()}
        style={{
          width: 44, 
          height: 44, 
          borderRadius: "50%",
          background: "#22c55e",
          border: "none", 
          cursor: "pointer",
          color: "white",
          display: "flex", 
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 4px 12px rgba(34, 197, 94, 0.3)",
          transition: "transform 0.2s ease",
          flexShrink: 0
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
      >
        <Icon name={isPlaying ? "pause" : "play"} size={18} filled color="white" />
      </button>

      {/* Progress Section (Timer + Bar) */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        alignItems: "center", 
        gap: 16,
        maxWidth: 600 
      }}>
        <span style={{ 
          fontSize: 11, 
          color: "rgba(255,255,255,0.4)", 
          fontFamily: "monospace",
          width: 35
        }}>
          {formatTime(progress)}
        </span>
        
        <div style={{ position: "relative", flex: 1, height: 20, display: "flex", alignItems: "center" }}>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={progress}
            onChange={(e) => seek(Number(e.target.value))}
            style={{
              width: "100%",
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.1)",
              outline: "none",
              cursor: "pointer",
              appearance: "none",
              WebkitAppearance: "none",
            }}
            className="player-range"
          />
          {/* Active progress bar highlight */}
          <div style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            height: 4,
            borderRadius: 2,
            background: "#22c55e",
            width: `${(progress / (duration || 1)) * 100}%`,
            pointerEvents: "none"
          }} />
        </div>

        <span style={{ 
          fontSize: 11, 
          color: "rgba(255,255,255,0.4)", 
          fontFamily: "monospace",
          width: 35
        }}>
          {formatTime(duration)}
        </span>
      </div>
      
      {/* Spacer for right side balance */}
      <div style={{ width: 80 }} />

      <style>{`
        .player-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          height: 12,
          width: 12,
          border-radius: 50%;
          background: #FFFFFF;
          cursor: pointer;
          border: none;
          opacity: 0;
          transition: opacity 0.2s ease;
        }
        .player-range:hover::-webkit-slider-thumb {
          opacity: 1;
        }
      `}</style>
    </div>
  );
}
