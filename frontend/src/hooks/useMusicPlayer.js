import { useState, useRef, useEffect, useCallback } from "react";

export function useMusicPlayer() {
  const audioRef = useRef(null);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);

  // Create audio element on mount
  useEffect(() => {
    audioRef.current = new Audio();
    audioRef.current.volume = 0.7;

    const audio = audioRef.current;
    const onTime = () => setProgress(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => {
      setIsPlaying(false);
      setProgress(0);
    };

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
      audio.pause();
      audio.src = "";
    };
  }, []);

  const play = useCallback(
    (track) => {
      const audio = audioRef.current;
      if (!audio) return;

      // Toggle play/pause if same track
      if (currentTrack?.id === track.id) {
        if (isPlaying) {
          audio.pause();
          setIsPlaying(false);
        } else {
          audio.play().catch(() => {});
          setIsPlaying(true);
        }
        return;
      }

      // New track
      audio.src = track.audioSrc;
      audio.volume = volume;
      audio.play().catch(() => {});
      setCurrentTrack(track);
      setIsPlaying(true);
      setProgress(0);
    },
    [currentTrack, isPlaying, volume]
  );

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [currentTrack, isPlaying]);

  const seek = useCallback((time) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = time;
    setProgress(time);
  }, []);

  const setVol = useCallback((v) => {
    if (!audioRef.current) return;
    audioRef.current.volume = v;
    setVolume(v);
  }, []);

  return {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    play,
    togglePlay,
    seek,
    setVolume: setVol,
  };
}
