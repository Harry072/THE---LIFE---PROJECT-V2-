import React, { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import "./FounderStoryPage.css";

import { CHAPTERS, CLOSING } from "../data/founderStory";
import StoryBackground from "../components/story/StoryBackground";
import ProgressBar from "../components/story/ProgressBar";
import ChapterCard from "../components/story/ChapterCard";
import ClosingStatement from "../components/story/ClosingStatement";

export default function FounderStoryPage() {
  const [activeChapter, setActiveChapter] = useState(0);

  const handleChapterVisible = useCallback((index) => {
    setActiveChapter(index);
  }, []);

  const scrollToChapter = (index) => {
    const el = document.getElementById(`chapter-${index}`);
    if (el) {
      const y = el.getBoundingClientRect().top + window.pageYOffset - 100;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const progress = ((activeChapter + 1) / CHAPTERS.length) * 100;
  const currentChapter = CHAPTERS[activeChapter];

  return (
    <div className="story-page">
      <StoryBackground 
        imageUrl={currentChapter.bgImage} 
        gradientColor={currentChapter.gradientColor} 
      />
      
      <ProgressBar progress={progress} />

      <Link to="/dashboard" className="story-back-btn">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        Dashboard
      </Link>

      <div className="story-content">
        <div className="story-title-section">
          <h1 className="story-main-title">From Darkness to Purpose</h1>
          <p className="story-main-subtitle">
            This isn't just an app. This is the timeline of how someone built the tools they needed to survive.
          </p>
        </div>

        <div style={{ position: "relative" }}>
          {/* Vertical Timeline Dots */}
          {CHAPTERS.map((chapter, i) => (
            <div
              key={`dot-${i}`}
              className={`story-dot ${activeChapter === i ? "active" : ""}`}
              style={{
                // We space the dots down relative to chapters. We can use absolute positioning 
                // in the chapter components but easier to let each chapter handle its own dot visually.
                // For simplicity, we just put dots directly inside the ChapterCard render.
                display: "none" // Hiding global list - handled via ChapterCard or offset calculations.
              }}
              onClick={() => scrollToChapter(i)}
            />
          ))}

          {CHAPTERS.map((chapter, i) => (
            <div key={i} style={{ position: "relative" }}>
              <div 
                className={`story-dot ${activeChapter === i ? "active" : ""}`}
                style={{ top: "0.5rem" }} // Positioned relative to chapter start
                onClick={() => scrollToChapter(i)}
              />
              <ChapterCard 
                chapter={chapter} 
                index={i} 
                onVisible={handleChapterVisible} 
              />
            </div>
          ))}
        </div>

        <ClosingStatement quote={CLOSING.quote} tagline={CLOSING.tagline} />
      </div>
    </div>
  );
}
