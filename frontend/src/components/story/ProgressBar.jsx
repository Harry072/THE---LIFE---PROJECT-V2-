import React from "react";

export default function ProgressBar({ progress }) {
  return (
    <div className="story-progress-bar">
      <div 
        className="story-progress-fill"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
