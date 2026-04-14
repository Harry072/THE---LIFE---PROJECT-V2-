import React from "react";

export default function StoryBackground({ imageUrl, gradientColor }) {
  return (
    <>
      {/* Background image with crossfade */}
      <div 
        className="story-bg-image"
        style={{ backgroundImage: `url(${imageUrl})` }} 
      />

      {/* Dark overlay for readability */}
      <div className="story-bg-overlay" />

      {/* Chapter-specific color tint */}
      <div 
        className="story-bg-tint"
        style={{
          background: `radial-gradient(
            ellipse 80% 60% at 50% 30%,
            ${gradientColor}50, transparent 70%
          )`,
        }} 
      />
    </>
  );
}
