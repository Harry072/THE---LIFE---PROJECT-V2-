import SessionCard from "./SessionCard";

export default function SoundSanctuarySection({ sessions, activeNeed, onBegin }) {
  return (
    <section className="reset-section" aria-labelledby="sound-sanctuary-title">
      <div className="reset-section-heading">
        <span>Ambient audio</span>
        <h2 id="sound-sanctuary-title">Sound Sanctuary</h2>
        <p>Real sound files from the app library for calm, focus, sleep, nature, and instrumental resets.</p>
      </div>
      <div className="reset-card-grid sound-grid">
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
