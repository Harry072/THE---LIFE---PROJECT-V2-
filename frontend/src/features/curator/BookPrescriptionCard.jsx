import Icon from "../../components/Icon";
import BookCover from "./BookCover";

export default function BookPrescriptionCard({
  book,
  featured = false,
  expanded = false,
  active = false,
  onToggle,
  onBeginRitual,
}) {
  const openFindUrl = (event) => {
    event.stopPropagation();
    window.open(book.findUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <article
      className={`curator-book-card ${featured ? "is-featured" : ""} ${
        expanded ? "is-expanded" : ""
      }`}
    >
      <button
        type="button"
        className="curator-book-summary"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <div className="curator-cover-wrap">
          <BookCover
            src={book.cover}
            title={book.title}
            author={book.author}
            mystery={book.pathSlug}
            className={`curator-cover-image ${featured ? "is-large" : ""}`}
          />
        </div>
        <div className="curator-book-copy">
          <div className="curator-book-meta-row">
            <span>{book.difficulty}</span>
            <span>{book.tone}</span>
          </div>
          <h3>{book.title}</h3>
          <p className="curator-book-author">{book.author}</p>
          <p className="curator-book-hook">{book.hook}</p>
        </div>
        <div className="curator-book-status" aria-hidden="true">
          {active ? <Icon name="check" size={15} /> : <Icon name="arrow" size={15} />}
        </div>
      </button>

      {expanded && (
        <div className="curator-book-detail">
          <div className="curator-detail-block">
            <h4>Why this book belongs here</h4>
            <p>{book.whyPath}</p>
          </div>
          <div className="curator-detail-block">
            <h4>What mystery it helps you understand</h4>
            <p>{book.mystery}</p>
          </div>
          <div className="curator-detail-block">
            <h4>What this book will teach you</h4>
            <ul>
              {book.learnings.map((learning) => (
                <li key={learning}>{learning}</li>
              ))}
            </ul>
          </div>
          <div className="curator-detail-grid">
            <div className="curator-detail-block">
              <h4>What it may change in you</h4>
              <p>{book.change}</p>
            </div>
            <div className="curator-detail-block">
              <h4>How to read this book</h4>
              <p>{book.readingGuidance}</p>
            </div>
          </div>
          <div className="curator-action-bridge">
            <span>Real-life action</span>
            <p>{book.actionBridge}</p>
          </div>
          <div className="curator-card-actions">
            <button
              type="button"
              className="curator-primary-btn"
              onClick={(event) => {
                event.stopPropagation();
                onBeginRitual();
              }}
            >
              {active ? "Stay with this book" : "Take this book with me"}
            </button>
            <button
              type="button"
              className="curator-secondary-btn"
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
            >
              Not for me right now
            </button>
            <button
              type="button"
              className="curator-link-btn"
              onClick={openFindUrl}
            >
              Find this book
              <Icon name="arrow" size={13} />
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
