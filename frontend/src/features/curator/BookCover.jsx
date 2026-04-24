import { useState } from "react";

function mysteryLabel(mystery) {
  if (!mystery) return "Curator";
  return String(mystery).replace(/^mystery of /i, "").replace(/-/g, " ");
}

function shortenText(value, maxLength) {
  const text = String(value || "").trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}...`;
}

export function GeneratedBookCover({
  title,
  author,
  mystery,
  className = "",
}) {
  const label = mysteryLabel(mystery);
  const safeTitle = String(title || "Untitled").trim();
  const safeAuthor = String(author || "The Life Project").trim();
  const visibleTitle = shortenText(safeTitle, 34);
  const visibleAuthor = shortenText(safeAuthor, 30);

  return (
    <div className={`generated-book-cover ${className}`.trim()}>
      <div className="generated-book-cover__frame">
        <div className="generated-book-cover__top">
          <p className="generated-book-cover__library">
            The Life Project Library
          </p>
          <div className="generated-book-cover__seal" title={label}>
            {label.slice(0, 2)}
          </div>
        </div>
        <div className="generated-book-cover__title-block">
          <h3 title={safeTitle}>{visibleTitle}</h3>
        </div>
        <div className="generated-book-cover__footer">
          <p title={safeAuthor}>{visibleAuthor}</p>
          <span className="generated-book-cover__mystery" title={label}>
            {label}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function BookCover({
  src,
  title,
  author,
  mystery,
  className = "",
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <GeneratedBookCover
        title={title}
        author={author}
        mystery={mystery}
        className={className}
      />
    );
  }

  return (
    <img
      src={src}
      alt={`${title} cover`}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
