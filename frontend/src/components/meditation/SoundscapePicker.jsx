import React from "react";

export default function SoundscapePicker({ soundscapes, selected, onChange }) {
  return (
    <div className="soundscape-picker">
      {soundscapes.map((sc) => (
        <button
          key={sc.id}
          className={`soundscape-pill ${selected === sc.id ? "active" : ""}`}
          onClick={() => onChange(sc.id)}
          aria-label={`Select ${sc.label} soundscape`}
        >
          <span>{sc.icon}</span>
          <span>{sc.label}</span>
        </button>
      ))}
    </div>
  );
}
