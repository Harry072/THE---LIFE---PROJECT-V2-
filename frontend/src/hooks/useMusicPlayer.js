import {
  useRef, useState, useEffect, useCallback,
} from "react";
import { MUSIC_LIBRARY, getTrackById }
  from "../data/musicLibrary";
 
export function useMusicPlayer() {
  // FIX #3: Audio element created ONCE, ref-stable.
  const audioRef = useRef(null);
  if (!audioRef.current && typeof window !== "undefined") {
    audioRef.current = new Audio();
    audioRef.current.preload = "auto";
  }
 
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying]       = useState(false);
  const [progress, setProgress]         = useState(0);
  const [duration, setDuration]         = useState(0);
  const [volume, setVolumeState]        = useState(0.7);
  const [error, setError]               = useState(null);
 
  // Guard against overlapping play() calls (FIX #5)
  const playPromiseRef = useRef(null);
 
  // ─── Attach permanent event listeners ───
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
 
    const onTime   = () => setProgress(audio.currentTime);
    const onMeta   = () => setDuration(audio.duration || 0);
    const onEnded  = () => { setIsPlaying(false); playNext(); };
    const onError  = (e) => {
      console.error("Audio error:", e, audio.error);
      setError(audio.error?.message || "Playback failed");
      setIsPlaying(false);
      // Auto-skip broken track after 1.2s
      setTimeout(() => playNext(), 1200);
    };
    const onPlay   = () => setIsPlaying(true);
    const onPause  = () => setIsPlaying(false);
 
    audio.addEventListener("timeupdate",      onTime);
    audio.addEventListener("loadedmetadata",  onMeta);
    audio.addEventListener("ended",           onEnded);
    audio.addEventListener("error",           onError);
    audio.addEventListener("play",            onPlay);
    audio.addEventListener("pause",           onPause);
 
    return () => {
      audio.removeEventListener("timeupdate",     onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended",          onEnded);
      audio.removeEventListener("error",          onError);
      audio.removeEventListener("play",           onPlay);
      audio.removeEventListener("pause",          onPause);
      audio.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
 
  // ─── CORE: play a track ───
  // Handles FIX #1, #2, #5
  const play = useCallback(async (trackOrId) => {
    const track = typeof trackOrId === "string"
      ? getTrackById(trackOrId)
      : trackOrId;
    if (!track) {
      setError("Track not found");
      return;
    }
 
    const audio = audioRef.current;
    if (!audio) return;
 
    // Toggle if same track
    if (currentTrack?.id === track.id) {
      if (audio.paused) {
        try {
          playPromiseRef.current = audio.play();
          await playPromiseRef.current;
        } catch (e) { handlePlayError(e); }
      } else {
        audio.pause();
      }
      return;
    }
 
    // FIX #5: wait for any previous play() to settle
    if (playPromiseRef.current) {
      try { await playPromiseRef.current; } catch {
        // A previous play attempt may be interrupted by fast switching.
      }
    }
 
    // Reset UI immediately
    setError(null);
    setProgress(0);
    setDuration(0);
    setCurrentTrack(track);
 
    // FIX #1: swap src AND call load()
    audio.pause();
    audio.src = track.src;
    audio.load();           // <-- critical line
    audio.volume = volume;
 
    // FIX #5: capture new play() promise
    try {
      playPromiseRef.current = audio.play();
      await playPromiseRef.current;
    } catch (e) {
      handlePlayError(e);
    }
  }, [currentTrack, volume]);
 
  const handlePlayError = (e) => {
    // AbortError is expected when switching fast — ignore
    if (e?.name === "AbortError") return;
    console.error("play() rejected:", e);
    setError(e?.message || "Could not play track");
    setIsPlaying(false);
  };
 
  // ─── Pause ───
  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);
 
  // ─── Resume / toggle ───
  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (audio.paused) {
      try {
        playPromiseRef.current = audio.play();
        await playPromiseRef.current;
      } catch (e) { handlePlayError(e); }
    } else {
      audio.pause();
    }
  }, [currentTrack]);
 
  // ─── Next / Previous (within full library or queue) ───
  const queueRef = useRef(MUSIC_LIBRARY);
  const setQueue = useCallback((tracks) => {
    queueRef.current = tracks.length ? tracks : MUSIC_LIBRARY;
  }, []);
 
  const playNext = useCallback(() => {
    if (!currentTrack) return;
    const q = queueRef.current;
    const i = q.findIndex(t => t.id === currentTrack.id);
    const next = q[(i + 1) % q.length];
    if (next) play(next);
  }, [currentTrack, play]);
 
  const playPrev = useCallback(() => {
    if (!currentTrack) return;
    const q = queueRef.current;
    const i = q.findIndex(t => t.id === currentTrack.id);
    const prev = q[(i - 1 + q.length) % q.length];
    if (prev) play(prev);
  }, [currentTrack, play]);
 
  // ─── Seek ───
  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  }, []);
 
  // ─── Volume ───
  const setVolume = useCallback((v) => {
    const clamped = Math.max(0, Math.min(1, v));
    if (audioRef.current) audioRef.current.volume = clamped;
    setVolumeState(clamped);
  }, []);
 
  return {
    // State
    currentTrack, isPlaying, progress, duration,
    volume, error,
    // Actions
    play, pause, toggle, playNext, playPrev,
    seek, setVolume, setQueue,
    // Provide a togglePlay alias for compatibility with existing components
    togglePlay: toggle,
  };
}
