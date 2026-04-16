const ICONS = {
  dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  loop:      "M17 2l4 4-4 4M3 12a9 9 0 0114.85-6.85L21 8M7 22l-4-4 4-4M21 12a9 9 0 01-14.85 6.85L3 16",
  meditate:  "M12 3a3 3 0 100 6 3 3 0 000-6zM12 9v4M8 18c0-2.2 1.8-4 4-4s4 1.8 4 4M4 22h16",
  music:     "M9 17V5l12-2v12M9 13a4 4 0 11-4-4 4 4 0 014 4zM21 11a4 4 0 11-4-4 4 4 0 014 4z",
  books:     "M4 19.5A2.5 2.5 0 016.5 17H20V4.5A2.5 2.5 0 0017.5 2H6.5A2.5 2.5 0 004 4.5zM4 19.5V22h16",
  progress:  "M3 20h18M7 20V10M12 20V4M17 20v-7",
  story:     "M4 19.5A2.5 2.5 0 016.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z",
  search:    "M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5.2-5.2",
  bell:      "M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9M13.73 21a2 2 0 01-3.46 0",
  user:      "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8z",
  sparkle:   "M12 2l2 7 7 2-7 2-2 7-2-7-7-2 7-2z",
  settings:  "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51h0a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
  leaf:      "M11 20A7 7 0 014 13V8a5 5 0 015-5 6 6 0 016 6v0a7 7 0 01-7 7M4 13s0-7 13-7",
  flame:     "M12 2s4 5 4 9a4 4 0 01-8 0c0-1.5 1-3 1-3s2 2 2 4M12 22a6 6 0 006-6c0-3-2-6-2-6s-2 3-2 5",
  pulse:     "M22 12h-4l-3 9L9 3l-3 9H2",
  play:      "M6 4l14 8-14 8z",
  check:     "M4 12l5 5L20 6",
  plus:      "M12 5v14M5 12h14",
  arrow:     "M5 12h14M13 6l6 6-6 6",
  sprout:    "M7 20h10M10 20v-8M14 20v-5M12 12a5 5 0 00-5-5H4v3a5 5 0 005 5h3M12 15a5 5 0 015-5h3v3a5 5 0 01-5 5h-3",
  command:   "M18 3a3 3 0 00-3 3v12a3 3 0 003 3 3 3 0 003-3 3 3 0 00-3-3H6a3 3 0 00-3 3 3 3 0 003 3 3 3 0 003-3V6a3 3 0 00-3-3 3 3 0 00-3 3 3 3 0 003 3h12a3 3 0 003-3 3 3 0 00-3-3z",
};
 
export default function Icon({
  name, size = 20, color = "currentColor",
  strokeWidth = 1.5, filled = false, style = {},
}) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : "none"}
      stroke={filled ? "none" : color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}
