import { useState, useRef, useEffect } from "react";
import Icon from "../Icon";
import { useNavigate } from "react-router-dom";
import SafeImage from "../common/SafeImage";

const CALM_FOREST_TRACK = {
  id: "sound-calm-ambient",
  title: "Calm Forest",
  duration: 720,
  audioSrc: "/audio/calm/calm-forest.mp3",
  coverImage: "/media/calm-forest-stream.jpg",
};

const PLAYLIST = [
  { id: "sound-focus-deep", title: "Deep Focus", audioSrc: "/audio/focus/deep-focus.mp3", duration: 240, icon: "pulse" },
  { id: "sound-calm-piano", title: "Peaceful Piano", audioSrc: "/audio/calm/peaceful-piano.mp3", duration: 240, icon: "music" },
  { id: "sound-instrumental-guitar", title: "Healing Frequencies", audioSrc: "/audio/instrumental/healing-frequencies.mp3", duration: 300, icon: "sparkle" },
  { id: "sound-sleep-thunder", title: "Rain & Thunder", audioSrc: "/audio/sleep/rain-thunder.mp3", duration: 480, icon: "meditate" },
];

function formatTime(secs) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function MeditationSection() {
  const navigate = useNavigate();
  const audioRef = useRef(null);

  const [activeTrack, setActiveTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new window.Audio();
    }

    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => setIsPlaying(false);
    const handleError = () => {
      console.warn("[MeditationSection] Audio error for:", audio.src);
      setIsPlaying(false);
      setAudioError(true);
    };

    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.src = "";
    };
  }, []);

  const togglePlay = (track) => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset error state on new action
    setAudioError(false);

    if (activeTrack?.id === track.id) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        audio.play().then(() => {
          setIsPlaying(true);
        }).catch(() => {
          setAudioError(true);
        });
      }
    } else {
      // Switch tracks safely
      audio.pause();
      audio.src = track.audioSrc;
      setActiveTrack(track);
      
      // Load and play new track
      audio.load();
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        setAudioError(true);
      });
    }
  };

  const isForestActive = activeTrack?.id === CALM_FOREST_TRACK.id && isPlaying;

  return (
    <section style={{
      marginBottom: 32,
      animation: "fadeUp 0.6s ease 0.45s both",
    }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginBottom: 14,
      }}>
        <h3 style={{
          margin: 0, fontSize: 11, fontWeight: 500,
          letterSpacing: 2.5,
          textTransform: "uppercase",
          color: "var(--text-faint)",
        }}>
          Meditation &amp; Music
        </h3>
        <button
          onClick={() => navigate("/meditation")}
          style={{
            background: "none", border: "none",
            color: "var(--green-bright)",
            fontSize: 12, cursor: "pointer",
          }}
        >
          Explore More &rarr;
        </button>
      </div>

      {audioError && (
        <div style={{
          marginBottom: 12,
          padding: "8px 12px",
          background: "rgba(255, 50, 50, 0.1)",
          border: "1px solid rgba(255, 50, 50, 0.2)",
          borderRadius: 8,
          color: "var(--text-faint)",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 8
        }}>
          <Icon name="alert-circle" size={16} color="var(--text-faint)" />
          Audio is unavailable right now. Open Reset Space to continue.
        </div>
      )}

      <div style={{
        display: "grid",
        gridTemplateColumns: "1.4fr 1fr",
        gap: 24,
      }}>
        
        {/* Meditation Card */}
        <div
          onClick={() => navigate("/meditation?session=calm-forest")}
          style={{
            position: "relative",
            borderRadius: "var(--r-md)",
            overflow: "hidden",
            minHeight: 220,
            boxShadow: isForestActive ? "0 0 0 1px var(--green-bright), var(--shadow-lift)" : "var(--shadow-lift)",
            cursor: "pointer",
            transition: "box-shadow 0.3s ease",
          }}
        >
          <SafeImage
            src={CALM_FOREST_TRACK.coverImage}
            alt=""
            style={{
              position: "absolute", inset: 0,
              width: "100%", height: "100%",
              objectFit: "cover",
              transition: "transform 0.6s ease",
              transform: isForestActive ? "scale(1.03)" : "scale(1)",
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
              aria-label={isForestActive ? `Pause ${CALM_FOREST_TRACK.title}` : `Play ${CALM_FOREST_TRACK.title}`}
              onClick={(e) => {
                e.stopPropagation();
                togglePlay(CALM_FOREST_TRACK);
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
              <Icon name={isForestActive ? "pause" : "play"} size={18}
                filled color="white"
                style={{ marginLeft: isForestActive ? 0 : 2 }} />
            </button>
            <div style={{ flex: 1 }}>
              <h4 style={{
                margin: 0, fontSize: 20, fontWeight: 500,
                fontFamily: "var(--font-display)",
                color: "white",
              }}>
                {CALM_FOREST_TRACK.title}
              </h4>
              <p style={{
                margin: "2px 0 0", fontSize: 13,
                color: "rgba(255,255,255,0.7)",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
                Reduce Stress &amp; Find Clarity
                {isForestActive && (
                  <span style={{
                    display: "inline-block",
                    width: 4, height: 4, borderRadius: "50%",
                    background: "var(--green-bright)",
                    boxShadow: "0 0 4px var(--green-bright)",
                    animation: "pulse 1.5s infinite"
                  }} />
                )}
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
            {formatTime(CALM_FOREST_TRACK.duration)}
          </span>
        </div>

        {/* Quick Playlist */}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {PLAYLIST.map(t => {
              const active = activeTrack?.id === t.id && isPlaying;
              return (
                <button
                  key={t.id}
                  aria-label={active ? `Pause ${t.title}` : `Play ${t.title}`}
                  onClick={() => togglePlay(t)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 8px",
                    borderRadius: 8,
                    cursor: "pointer",
                    transition: "background 0.2s",
                    border: "none",
                    outline: "none",
                    fontFamily: "inherit",
                    textAlign: "left",
                    background: active ? "rgba(46,204,113,0.08)" : "transparent",
                    width: "100%",
                  }}
                  onMouseEnter={e => {
                    if (!active) e.currentTarget.style.background = "var(--bg-row-hover)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = active ? "rgba(46,204,113,0.08)" : "transparent";
                  }}
                >
                  <Icon
                    name={active ? "pause" : (t.icon || "music")}
                    size={16}
                    color={active ? "var(--green-bright)" : "var(--text-dim)"}
                  />
                  <span style={{
                    flex: 1, fontSize: 13,
                    color: active ? "var(--green-bright)" : "var(--text)",
                    fontWeight: active ? 500 : 400,
                  }}>
                    {t.title}
                  </span>
                  {active && (
                    <span style={{ fontSize: 10, color: "var(--green-bright)", textTransform: "uppercase", letterSpacing: 1 }}>
                      Playing
                    </span>
                  )}
                  <span style={{
                    fontSize: 12,
                    color: "var(--text-faint)",
                    fontVariantNumeric: "tabular-nums"
                  }}>
                    {formatTime(t.duration)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        
      </div>
    </section>
  );
}
