import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./MeditationPage.css";

import { useAmbientAudio } from "../hooks/useAmbientAudio";
import { SOUNDSCAPES } from "../data/soundscapes";

import BreathingCircle from "../components/meditation/BreathingCircle";
import SoundscapePicker from "../components/meditation/SoundscapePicker";
import DurationPicker from "../components/meditation/DurationPicker";
import PhilosophySection from "../components/meditation/PhilosophySection";
import MusicLibrary from "../components/meditation/MusicLibrary";

export default function MeditationPage() {
  const [activeTab, setActiveTab] = useState("breathe");
  
  // Breathe Mode State
  const [sessionActive, setSessionActive] = useState(false);
  const [sessionDuration, setSessionDuration] = useState(3); // minutes
  const [timeLeft, setTimeLeft] = useState(0); // seconds
  
  const { 
    playing: ambientPlaying, 
    soundscape, 
    start: startAmbient, 
    stop: stopAmbient,
    setSoundscape
  } = useAmbientAudio();

  // Handle Breathe timer
  useEffect(() => {
    let timer;
    if (sessionActive && timeLeft > 0) {
      timer = setInterval(() => setTimeLeft((t) => t - 1), 1000);
    } else if (sessionActive && timeLeft === 0) {
      endSession();
    }
    return () => clearInterval(timer);
  }, [sessionActive, timeLeft]);

  // Clean up audio when switching tabs or unmounting
  useEffect(() => {
    if (activeTab !== "breathe") {
      stopAmbient();
      setSessionActive(false);
    }
    return () => stopAmbient();
  }, [activeTab, stopAmbient]);

  const handleStartSession = () => {
    setTimeLeft(sessionDuration * 60);
    setSessionActive(true);
    startAmbient(soundscape, SOUNDSCAPES);
  };

  const endSession = () => {
    setSessionActive(false);
    setTimeLeft(0);
    stopAmbient();
  };

  const formatTimer = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  // Generate particles
  const particles = Array.from({ length: 30 }).map((_, i) => ({
    left: `${Math.random() * 100}vw`,
    animationDelay: `${Math.random() * 12}s`,
    animationDuration: `${10 + Math.random() * 10}s`,
    opacity: 0.1 + Math.random() * 0.3,
  }));

  return (
    <div className="meditation-page">
      <div className="med-bg-base" />
      
      {/* Ambient Particles */}
      <div className="med-particles">
        {particles.map((p, i) => (
          <div 
            key={i} 
            className="med-particle"
            style={{
              left: p.left,
              animationDelay: p.animationDelay,
              animationDuration: p.animationDuration,
              opacity: p.opacity,
            }}
          />
        ))}
      </div>

      <Link to="/dashboard" className="med-back-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Dashboard
      </Link>

      <div className="med-content">
        {/* Tab Bar */}
        <div className="med-tab-bar">
          <button 
            className={`med-tab ${activeTab === "breathe" ? "active" : ""}`}
            onClick={() => setActiveTab("breathe")}
          >
            Breathe
          </button>
          <button 
            className={`med-tab ${activeTab === "listen" ? "active" : ""}`}
            onClick={() => setActiveTab("listen")}
          >
            Listen
          </button>
        </div>

        {activeTab === "breathe" ? (
          <>
            <h1 className="med-title">Still the Mind, Align the Life</h1>
            <p className="med-subtitle">Guided 4-7-8 breathing with procedural soundscapes</p>

            <BreathingCircle isActive={sessionActive} />

            {sessionActive ? (
              <div className="med-timer">{formatTimer(timeLeft)}</div>
            ) : null}

            <SoundscapePicker 
              soundscapes={SOUNDSCAPES} 
              selected={soundscape} 
              onChange={(id) => {
                setSoundscape(id);
                if (sessionActive) {
                  startAmbient(id, SOUNDSCAPES);
                }
              }} 
            />

            {!sessionActive && (
              <DurationPicker 
                selected={sessionDuration} 
                onChange={setSessionDuration} 
              />
            )}

            {!sessionActive ? (
              <button className="med-cta begin" onClick={handleStartSession}>
                Begin Meditation
              </button>
            ) : (
              <button className="med-cta end" onClick={endSession}>
                End Session
              </button>
            )}

            {!sessionActive && <PhilosophySection />}
          </>
        ) : (
          <>
            <h1 className="med-title" style={{ marginBottom: "2rem" }}>Curated Soundscapes</h1>
            <MusicLibrary />
          </>
        )}
      </div>
    </div>
  );
}
