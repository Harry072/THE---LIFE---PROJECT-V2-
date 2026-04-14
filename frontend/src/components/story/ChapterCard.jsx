import React, { useRef, useEffect, useState } from "react";
import EmotionQuote from "./EmotionQuote";

export default function ChapterCard({ chapter, index, onVisible }) {
  const cardRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          onVisible(index);
        }
      },
      { threshold: 0.6 } // trigger when 60% of card is visible
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) {
        observer.unobserve(cardRef.current);
      }
    };
  }, [index, onVisible]);

  return (
    <div 
      ref={cardRef} 
      className={`chapter-block ${isVisible ? "visible" : ""}`}
      id={`chapter-${index}`}
    >
      <div className="story-timeline">
        {/* The dot is handled in FounderStoryPage to control active state globally,
            but we can place an anchor dot here if needed. We'll handle it via the page wrapper. */}
        
        <h4 className="chapter-phase">{chapter.phase}</h4>
        <h2 className="chapter-period">{chapter.period}</h2>
        
        <div className="chapter-card">
          <div className="chapter-narrative">
            <p>{chapter.content}</p>
          </div>
          <EmotionQuote text={chapter.emotion} />
        </div>
      </div>
    </div>
  );
}
