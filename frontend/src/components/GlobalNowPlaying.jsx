import { useAppState } from "../contexts/AppStateContext";
import Icon from "./Icon";

export default function GlobalNowPlaying() {
  const { currentTrack, isPlaying, playTrack, pauseTrack }
    = useAppState();

  if (!currentTrack) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 240, right: 0,
      height: 64,
      background: "rgba(13, 19, 16, 0.92)",
      backdropFilter: "blur(24px)",
      borderTop: "1px solid var(--border)",
      display: "flex", alignItems: "center",
      padding: "0 24px", gap: 16,
      zIndex: 100,
    }}>
      {currentTrack.coverImage && (
        <img src={currentTrack.coverImage} alt=""
          style={{ width: 44, height: 44, borderRadius: 8,
            objectFit: "cover" }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 14,
          color: "var(--text)",
          fontWeight: 500 }}>
          {currentTrack.title}
        </p>
        <p style={{ margin: 0, fontSize: 11,
          color: "var(--text-dim)" }}>
          {currentTrack.artist || "The Life Project"}
        </p>
      </div>
      <button
        onClick={() => isPlaying
          ? pauseTrack() : playTrack(currentTrack)}
        style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "var(--green-bright)",
          border: "none", cursor: "pointer",
          color: "white",
          display: "flex", alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name={isPlaying ? "pause" : "play"}
          size={16} filled color="white" />
      </button>
    </div>
  );
}
