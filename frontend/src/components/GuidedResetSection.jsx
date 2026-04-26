import SessionCard from "./SessionCard";

export default function GuidedResetSection({ sessions, activeNeed, onBegin }) {
  return (
    <section className="reset-section" aria-labelledby="guided-reset-title">
      <div className="reset-section-heading">
        <span>Voice-led</span>
        <h2 id="guided-reset-title">Guided Reset</h2>
        <p>Short meditations for calming down, releasing loops, focusing, or easing toward sleep.</p>
      </div>
      <div className="reset-card-grid">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isHighlighted={Boolean(activeNeed && session.needs.includes(activeNeed))}
            onBegin={onBegin}
          />
        ))}
      </div>
    </section>
  );
}
