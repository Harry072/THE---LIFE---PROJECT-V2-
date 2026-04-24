import Icon from "../../components/Icon";

const STEPS = [
  "Keep your phone away.",
  "Sit somewhere quiet.",
  "Read only two pages.",
  "Notice one line that stays with you.",
];

export default function FirstPageRitualModal({
  book,
  message,
  onClose,
  onConfirm,
}) {
  if (!book) return null;

  return (
    <div className="curator-modal-backdrop" role="presentation">
      <section
        className="curator-ritual-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="curator-ritual-title"
      >
        <button
          type="button"
          className="curator-modal-close"
          onClick={onClose}
          aria-label="Close ritual"
        >
          <Icon name="plus" size={16} style={{ transform: "rotate(45deg)" }} />
        </button>
        <p className="curator-section-label">First Page Ritual</p>
        <h2 id="curator-ritual-title">Before you begin</h2>
        <p className="curator-ritual-book">
          You are taking <span>{book.title}</span> with you.
        </p>
        <ol className="curator-ritual-steps">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {message && <p className="curator-ritual-message">{message}</p>}
        <div className="curator-modal-actions">
          <button
            type="button"
            className="curator-primary-btn"
            onClick={onConfirm}
          >
            I'll begin offline
          </button>
          <button
            type="button"
            className="curator-secondary-btn"
            onClick={onClose}
          >
            Not yet
          </button>
        </div>
      </section>
    </div>
  );
}
