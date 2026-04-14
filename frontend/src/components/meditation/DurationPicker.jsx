import React from "react";

const DURATIONS = [
  { value: 3, label: "3m" },
  { value: 5, label: "5m" },
  { value: 10, label: "10m" },
  { value: 15, label: "15m" },
  { value: 20, label: "20m" },
];

export default function DurationPicker({ selected, onChange }) {
  return (
    <div className="duration-picker">
      {DURATIONS.map((d) => (
        <button
          key={d.value}
          className={`duration-btn ${selected === d.value ? "active" : ""}`}
          onClick={() => onChange(d.value)}
          aria-label={`Set duration to ${d.label}`}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}
