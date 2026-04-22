/**
 * SvgTree — Procedural SVG tree that scales with stage and vitality.
 * Used as a fallback when cinematic images are not available.
 */
export default function SvgTree({ stage, vitality }) {
  const stageNum = stage?.id || 1;
  const trunkH = 20 + stageNum * 18;     // 38 → 128
  const trunkW = 2 + stageNum * 1.5;     // 3.5 → 11
  const canopyR = stageNum * 12;          // 12 → 72
  const leafCount = stageNum * 3;
  const sat = vitality >= 50 ? 1 : 0.5 + vitality / 100;
  const glowR = vitality >= 50 ? canopyR + 15 : 0;

  // Deterministic leaf positions (using golden angle)
  const leaves = Array.from({ length: leafCount }).map((_, i) => {
    const angle = (i * 137.5) % 360;
    const r = 5 + (i % 4) * (canopyR / 4);
    const cx = 100 + Math.cos(angle * Math.PI / 180) * r;
    const cy = (180 - trunkH - canopyR * 0.3)
      + Math.sin(angle * Math.PI / 180) * (r * 0.6);
    // Use deterministic pseudo-random for size/opacity
    const seed = ((i * 137 + 42) % 100) / 100;
    const leafR = 3 + seed * 2.5;
    const leafOp = 0.3 + seed * 0.5;
    return { cx, cy: Math.max(15, cy), r: leafR, opacity: leafOp };
  });

  return (
    <svg width="200" height="200" viewBox="0 0 200 200"
      style={{ filter: `saturate(${sat})`, transition: "filter 1.5s ease" }}>
      {/* Trunk */}
      <rect
        x={100 - trunkW / 2} y={180 - trunkH}
        width={trunkW} height={trunkH}
        rx={trunkW / 3}
        fill="#8B6914" opacity="0.8"
      />

      {/* Canopy glow */}
      {glowR > 0 && (
        <circle cx="100" cy={180 - trunkH - canopyR * 0.4}
          r={glowR} fill="rgba(46,204,113,0.08)" />
      )}

      {/* Leaves */}
      {leaves.map((leaf, i) => (
        <circle key={i}
          cx={leaf.cx} cy={leaf.cy}
          r={leaf.r}
          fill="#2ECC71"
          opacity={leaf.opacity}
        >
          <animate
            attributeName="opacity"
            values={`${leaf.opacity};${leaf.opacity * 0.6};${leaf.opacity}`}
            dur={`${3 + (i % 3)}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}

      {/* Root lines for stages 4+ */}
      {stageNum >= 4 && [1, 2, 3].map(i => (
        <line key={`root-${i}`}
          x1={100} y1={180}
          x2={100 + (i % 2 ? 1 : -1) * i * 12} y2={195}
          stroke="#8B6914" strokeWidth="1.5"
          opacity="0.4"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
