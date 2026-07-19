import { useEffect, useState } from "react";

// Top-right of the hero — analog face (SVG) + digital readout, both driven
// by the device's own clock only. Deliberately reads `new Date()` with no
// arguments and touches nothing else: no server timestamp, no
// season-engine date, so this cannot reintroduce the UTC-vs-local-day
// mismatch class of bug (that one came from comparing a server UTC
// timestamp against a local calendar day — this component never reads a
// server timestamp at all). Hands and ticks are re-rendered to a new
// discrete angle each second via state, never animated, so there is
// nothing for prefers-reduced-motion to strip.

const WEEKDAY_FORMAT = new Intl.DateTimeFormat(undefined, { weekday: "long" });
const MONTH_DAY_FORMAT = new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" });
const TICKS = Array.from({ length: 12 }, (_, i) => i * 30);

function digitalTime(date) {
  let hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")} ${period}`;
}

export default function LiveClock() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const minutes = now.getMinutes();
  const hours = now.getHours();
  const hourAngle = (hours % 12 + minutes / 60) * 30;
  const minuteAngle = minutes * 6;

  return (
    <div className="dashboard-clock" aria-hidden="true">
      <svg width="110" height="110" viewBox="0 0 110 110" className="dashboard-clock-face">
        <circle cx="55" cy="55" r="52" stroke="var(--amber)" strokeWidth="1.5" fill="none" />
        {TICKS.map((angle) => (
          <line
            key={angle}
            x1="55" y1="3" x2="55" y2="9"
            stroke="rgba(240, 165, 0, 0.4)" strokeWidth="1"
            transform={`rotate(${angle} 55 55)`}
          />
        ))}
        <text x="55" y="12" textAnchor="middle" className="dashboard-clock-numeral">XII</text>
        <text x="98" y="58" textAnchor="middle" className="dashboard-clock-numeral">III</text>
        <text x="55" y="100" textAnchor="middle" className="dashboard-clock-numeral">VI</text>
        <text x="12" y="58" textAnchor="middle" className="dashboard-clock-numeral">IX</text>
        <line
          x1="55" y1="55" x2="55" y2="27"
          stroke="var(--amber)" strokeWidth="2.5" strokeLinecap="round"
          transform={`rotate(${hourAngle} 55 55)`}
        />
        <line
          x1="55" y1="55" x2="55" y2="17"
          stroke="var(--amber)" strokeWidth="1.5" strokeLinecap="round"
          transform={`rotate(${minuteAngle} 55 55)`}
        />
        <circle cx="55" cy="55" r="3" fill="var(--amber)" />
      </svg>
      <p className="dashboard-clock-digital">{digitalTime(now)}</p>
      <p className="dashboard-clock-date">
        {WEEKDAY_FORMAT.format(now)}, {MONTH_DAY_FORMAT.format(now)}
      </p>

      <style>{`
        .dashboard-clock {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .dashboard-clock-face {
          filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.4));
        }

        .dashboard-clock-numeral {
          fill: var(--amber);
          font-family: var(--font-display);
          font-size: 8px;
        }

        .dashboard-clock-digital {
          margin: 2px 0 0;
          color: var(--amber);
          font-family: var(--font-body);
          font-size: 18px;
          font-weight: 500;
        }

        .dashboard-clock-date {
          margin: 0;
          color: rgba(255, 255, 255, 0.70);
          font-family: var(--font-body);
          font-size: 12px;
          white-space: nowrap;
        }

        @media (max-width: 767px) {
          .dashboard-clock-face {
            width: 80px;
            height: 80px;
          }

          .dashboard-clock-digital {
            font-size: 14px;
          }

          .dashboard-clock-date {
            font-size: 10px;
          }
        }
      `}</style>
    </div>
  );
}
