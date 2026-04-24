import Icon from "../../components/Icon";
import BookCover from "./BookCover";

export default function ActiveReadingShelf({
  books,
  maxBooks,
  onRemoveBook,
  onOpenBook,
}) {
  return (
    <section className="curator-active-shelf" aria-label="Currently with you">
      <div className="curator-shelf-heading">
        <div>
          <p className="curator-section-label">Active Reading Shelf</p>
          <h2>Currently With You</h2>
        </div>
        <span>{books.length}/{maxBooks} books</span>
      </div>

      {books.length === 0 ? (
        <div className="curator-empty-shelf">
          <p>No book is with you yet.</p>
          <span>
            Choose one book that meets this season. One is enough.
          </span>
        </div>
      ) : (
        <div className="curator-shelf-list">
          {books.map((book) => (
            <article key={book.id} className="curator-shelf-item">
              <button
                type="button"
                className="curator-shelf-main"
                onClick={() => onOpenBook(book.id)}
              >
                <BookCover
                  src={book.cover}
                  title={book.title}
                  author={book.author}
                  mystery={book.pathSlug}
                  className="curator-shelf-cover"
                />
                <div>
                  <h3>{book.title}</h3>
                  <p>{book.whyPath}</p>
                  <span>Stay with this. No rush.</span>
                </div>
              </button>
              <button
                type="button"
                className="curator-remove-btn"
                onClick={() => onRemoveBook(book.id)}
                aria-label={`Remove ${book.title} from shelf`}
              >
                <Icon name="plus" size={15} style={{ transform: "rotate(45deg)" }} />
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
