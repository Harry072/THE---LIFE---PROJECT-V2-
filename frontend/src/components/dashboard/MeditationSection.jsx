import Icon from "../Icon";
import { useNavigate } from "react-router-dom";
import { useAppState } from "../../contexts/AppStateContext";

const CALM_FOREST_TRACK = {
  id: "calm-forest",
  title: "Calm Forest",
  artist: "The Life Project",
  duration: 720,
  audioSrc: "/media/audio/calm-forest.mp3",
  coverImage: "/media/calm-forest-stream.jpg",
};

const PLAYLIST = [
  { id: "deep-focus", title: "Deep Focus",
    audioSrc: "/media/audio/deep-focus.mp3", duration: 2700,
    icon: "pulse" },
  { id: "peaceful-piano", title: "Peaceful Piano",
    audioSrc: "/media/audio/peaceful-piano.mp3", duration: 1800,
    icon: "music" },
  { id: "healing-freq", title: "Healing Frequencies",
    audioSrc: "/media/audio/healing.mp3", duration: 1200,
    icon: "sparkle" },
  { id: "rain-thunder", title: "Rain & Thunder",
    audioSrc: "/media/audio/rain.mp3", duration: 3600,
    icon: "meditate" },
];

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MeditationCard() {
  const navigate = useNavigate();
  const { currentTrack, isPlaying, playTrack } = useAppState();

  const isActive = currentTrack?.id === CALM_FOREST_TRACK.id
    && isPlaying;

  return (
    <div
      onClick={() => navigate("/meditation?session=calm-forest")}
      style={{
        position: "relative",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        minHeight: 220,
        boxShadow: "var(--shadow-lift)",
        cursor: "pointer",
      }}
    >
      <img
        src="/media/calm-forest-stream.jpg"
        alt=""
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
          transition: "transform 0.6s ease",
        }}
      />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to top, "
          + "rgba(10,15,13,0.85) 0%, "
          + "rgba(10,15,13,0.15) 60%, transparent 100%)",
      }} />

      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        padding: 24,
        display: "flex", alignItems: "center", gap: 16,
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            playTrack(CALM_FOREST_TRACK);
          }}
          style={{
            width: 48, height: 48, borderRadius: "50%",
            background: "rgba(255,255,255,0.18)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.3)",
            color: "white", cursor: "pointer",
            display: "flex", alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon name={isActive ? "pause" : "play"} size={18}
            filled color="white"
            style={{ marginLeft: isActive ? 0 : 2 }} />
        </button>
        <div style={{ flex: 1 }}>
          <h4 style={{
            margin: 0, fontSize: 20, fontWeight: 500,
            fontFamily: "var(--font-display)",
            color: "white",
          }}>
            Calm Forest
          </h4>
          <p style={{
            margin: "2px 0 0", fontSize: 13,
            color: "rgba(255,255,255,0.7)",
          }}>
            Reduce Stress &amp; Find Clarity
          </p>
        </div>
      </div>

      <span style={{
        position: "absolute", top: 16, left: 16,
        padding: "4px 10px",
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(4px)",
        borderRadius: 12,
        fontSize: 11, color: "white",
      }}>
        12 Min
      </span>
    </div>
  );
}

export function QuickPlaylist() {
  const { currentTrack, isPlaying, playTrack } = useAppState();

  return (
    <div style={{
      background: "var(--bg-card)",
      backdropFilter: "blur(24px)",
      border: "1px solid var(--border)",
      borderRadius: "var(--r-md)",
      padding: "20px 22px",
    }}>
      <h3 style={{
        margin: "0 0 14px",
        fontSize: 11, fontWeight: 500,
        letterSpacing: 2.5, textTransform: "uppercase",
        color: "var(--text-faint)",
      }}>
        Quick Playlist
      </h3>
      <div style={{ display: "flex", flexDirection: "column",
        gap: 4 }}>
        {PLAYLIST.map(t => {
          const active = currentTrack?.id === t.id && isPlaying;
          return (
            <div
              key={t.id}
              onClick={() => playTrack(t)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 8px",
                borderRadius: 8,
                cursor: "pointer",
                transition: "background 0.2s",
                background: active
                  ? "rgba(46,204,113,0.08)" : "transparent",
              }}
              onMouseEnter={e => {
                if (!active) e.currentTarget.style.background
                  = "var(--bg-row-hover)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = active
                  ? "rgba(46,204,113,0.08)" : "transparent";
              }}
            >
              <Icon
                name={active ? "pause" : (t.icon || "music")}
                size={16}
                color={active
                  ? "var(--green-bright)" : "var(--text-dim)"}
              />
              <span style={{
                flex: 1, fontSize: 13,
                color: active
                  ? "var(--green-bright)" : "var(--text)",
                fontWeight: active ? 500 : 400,
              }}>
                {t.title}
              </span>
              <span style={{ fontSize: 12,
                color: "var(--text-faint)",
                fontVariantNumeric: "tabular-nums" }}>
                {formatTime(t.duration)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
