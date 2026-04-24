import BookPrescriptionCard from "./BookPrescriptionCard";

export default function MysteryPathSection({
  path,
  books,
  expandedBookId,
  isBookActive,
  onToggleBook,
  onBeginRitual,
}) {
  const startHereBook = books.find((book) => book.id === path.startHereBookId);
  const otherBooks = books.filter((book) => book.id !== path.startHereBookId);

  return (
    <section
      id={`curator-path-${path.slug}`}
      className="curator-path-section"
    >
      <div className="curator-section-header">
        <div>
          <p className="curator-section-label">Mystery Path</p>
          <h2>{path.name}</h2>
          <p>{path.mentorIntro}</p>
        </div>
      </div>

      {startHereBook && (
        <div className="curator-start-here">
          <div className="curator-start-copy">
            <span>Start Here</span>
            <p>
              If you are unsure where to begin, let this be the first quiet
              doorway into the path.
            </p>
          </div>
          <BookPrescriptionCard
            book={startHereBook}
            featured
            expanded={expandedBookId === startHereBook.id}
            active={isBookActive(startHereBook.id)}
            onToggle={() => onToggleBook(startHereBook.id)}
            onBeginRitual={() => onBeginRitual(startHereBook.id)}
          />
        </div>
      )}

      <div className="curator-book-grid">
        {otherBooks.map((book) => (
          <BookPrescriptionCard
            key={book.id}
            book={book}
            expanded={expandedBookId === book.id}
            active={isBookActive(book.id)}
            onToggle={() => onToggleBook(book.id)}
            onBeginRitual={() => onBeginRitual(book.id)}
          />
        ))}
      </div>
    </section>
  );
}
