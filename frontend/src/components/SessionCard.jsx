import { Headphones, Play, Volume2, Wind } from "lucide-react";

const TYPE_LABELS = {
  guided: "Guided Reset",
  sound: "Sound Sanctuary",
  breathing: "Breath Practice",
};

const TYPE_ICONS = {
  guided: Headphones,
  sound: Volume2,
  breathing: Wind,
};

export default function SessionCard({
  session,
  isHighlighted = false,
  onBegin,
  actionLabel = "Begin Session",
}) {
  const Icon = TYPE_ICONS[session.type] || Play;

  return (
    <article className={`reset-session-card ${isHighlighted ? "is-highlighted" : ""}`}>
      <div className="reset-session-image-wrap">
        <img
          src={session.imageSrc}
          alt=""
          className="reset-session-image"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div className="reset-session-image-shade" />
        <span className="reset-session-chip">{TYPE_LABELS[session.type]}</span>
      </div>

      <div className="reset-session-body">
        <div className="reset-session-meta">
          <span><Icon size={15} aria-hidden="true" /> {session.category}</span>
          <span>{session.duration} min</span>
        </div>
        <h3>{session.title}</h3>
        <p>{session.description}</p>
        <p className="reset-session-why">{session.whyThisHelps}</p>
      </div>

      <button
        type="button"
        className="reset-card-action"
        onClick={() => onBegin(session)}
      >
        <Play size={16} aria-hidden="true" />
        {actionLabel}
      </button>
    </article>
  );
}
