import BookPrescriptionCard from "./BookPrescriptionCard";

const READING_PATH_STEPS = [
  "Start with one book.",
  "Read one small section.",
  "Write one idea.",
  "Turn one idea into action.",
];

export default function CuratorIntelligencePanel({
  lanes,
  readingPathBook,
  topRecommendation,
  hasPersonalSignals,
  loading,
  expandedBookId,
  isBookActive,
  onToggleBook,
  onBeginRitual,
  onFindBook,
}) {
  const visibleLanes = lanes.filter((lane) => lane.recommendations.length > 0);

  return (
    <section className="curator-intelligence" aria-labelledby="curator-compass-title">
      <div className="curator-compass-header">
        <div>
          <p className="curator-section-label">Reading Compass</p>
          <h2 id="curator-compass-title">A quieter way to choose what to learn next.</h2>
          <p>
            Curator uses safe signals from your recent rhythm to suggest books and ideas.
            The static shelves stay below when you want to browse by mystery.
          </p>
        </div>
        <div className="curator-compass-signal" aria-live="polite">
          <span>{loading ? "Reading signals" : hasPersonalSignals ? "Personalized" : "Starter guidance"}</span>
          <p>
            {hasPersonalSignals
              ? "Based on safe patterns only, never private journal text."
              : "No strong personal signal yet. Start with one steady book."}
          </p>
        </div>
      </div>

      {readingPathBook ? (
        <div className="curator-reading-path">
          <div className="curator-reading-path-copy">
            <p className="curator-section-label">One Book Reading Path</p>
            <h3>{readingPathBook.title}</h3>
            <p>
              {topRecommendation?.reason
                || "Recommended as a steady first book while your reading pattern forms."}
            </p>
          </div>
          <ol className="curator-reading-path-steps">
            {READING_PATH_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <div className="curator-reading-path-actions">
            <button
              type="button"
              className="curator-primary-btn"
              onClick={() => onBeginRitual(readingPathBook.id)}
            >
              Begin with this book
            </button>
            <button
              type="button"
              className="curator-secondary-btn"
              onClick={() => onToggleBook(readingPathBook.id)}
            >
              View guidance
            </button>
          </div>
        </div>
      ) : null}

      <div className="curator-lane-stack">
        {visibleLanes.map((lane) => (
          <section key={lane.key} className="curator-recommendation-lane">
            <div className="curator-lane-heading">
              <h3>{lane.title}</h3>
              <span>{lane.recommendations.length} suggestions</span>
            </div>
            <div className="curator-lane-books">
              {lane.recommendations.map((recommendation) => (
                <BookPrescriptionCard
                  key={`${lane.key}-${recommendation.book.id}`}
                  book={recommendation.book}
                  recommendationReason={recommendation.reason}
                  expanded={expandedBookId === recommendation.book.id}
                  active={isBookActive(recommendation.book.id)}
                  onToggle={() => onToggleBook(recommendation.book.id)}
                  onBeginRitual={() => onBeginRitual(recommendation.book.id)}
                  onFindBook={() => onFindBook(recommendation.book.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}
