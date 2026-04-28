import Icon from "../Icon";
import { useNavigate } from "react-router-dom";
import { getDashboardCuratorBooks } from "../../features/curator/curatorData";

const BOOKS = getDashboardCuratorBooks();

function BookCard({ book }) {
  const navigate = useNavigate();

  return (
    <div
      className="dashboard-book-card"
      onClick={() => navigate(`/curator?book=${book.id}`)}
    >
      <div className="dashboard-book-cover-frame">
        <img
          src={book.cover}
          alt={book.title}
          className="dashboard-book-cover"
        />
      </div>

      <div className="dashboard-book-content">
        <div className="dashboard-book-body">
          <h4 className="dashboard-book-title">
            {book.title}
          </h4>
          <p className="dashboard-book-hook">
            {book.hook}
          </p>
        </div>

        <div className="dashboard-book-footer">
          <p className="dashboard-book-author">
            {book.author}
          </p>
          <button
            className="dashboard-book-arrow"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/curator?book=${book.id}`);
            }}
            aria-label={`Open ${book.title} recommendation`}
          >
            <Icon name="arrow" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BooksGrid() {
  const navigate = useNavigate();
  return (
    <section style={{ marginBottom: 32 }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 14,
      }}>
        <div style={{ display: "flex", alignItems: "center",
          gap: 10 }}>
          <h3 style={{
            margin: 0, fontSize: 11, fontWeight: 500,
            letterSpacing: 2.5, textTransform: "uppercase",
            color: "var(--text-faint)",
          }}>
            Books For You
          </h3>
          <span style={{
            padding: "2px 8px",
            background: "rgba(46,204,113,0.15)",
            color: "var(--green-bright)",
            fontSize: 10, fontWeight: 600,
            letterSpacing: 1,
            borderRadius: 4,
          }}>NEW</span>
        </div>
        <button
          onClick={() => navigate("/curator")}
          style={{
            background: "none", border: "none",
            color: "var(--green-bright)",
            fontFamily: "var(--font-body)", fontSize: 12,
            cursor: "pointer", display: "flex",
            alignItems: "center", gap: 4,
          }}
        >
          See All Recommendations
          <Icon name="arrow" size={12} />
        </button>
      </div>

      <div className="dashboard-books-grid">
        {BOOKS.map(b => <BookCard key={b.id} book={b} />)}
      </div>

      <style>{`
        .dashboard-books-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
          align-items: stretch;
        }

        .dashboard-book-card {
          min-height: 460px;
          height: 100%;
          display: flex;
          flex-direction: column;
          padding: 24px;
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          background: var(--bg-card);
          backdrop-filter: blur(24px);
          cursor: pointer;
          overflow: hidden;
          transition: transform 0.3s ease, box-shadow 0.3s ease,
            border-color 0.3s ease;
        }

        .dashboard-book-card:hover {
          transform: translateY(-4px);
          border-color: var(--border-strong);
          box-shadow: var(--shadow-lift);
        }

        .dashboard-book-cover-frame {
          width: 100%;
          height: 300px;
          max-height: 300px;
          flex: 0 0 300px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 14px;
          overflow: hidden;
          background: rgba(0, 0, 0, 0.25);
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
        }

        .dashboard-book-cover {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          display: block;
        }

        .dashboard-book-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-width: 0;
          margin-top: 20px;
        }

        .dashboard-book-body {
          flex: 1;
          min-width: 0;
        }

        .dashboard-book-title {
          margin: 0;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
          line-height: 1.35;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .dashboard-book-hook {
          margin: 8px 0 0;
          color: var(--text-dim);
          font-size: 11px;
          line-height: 1.5;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .dashboard-book-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 16px;
        }

        .dashboard-book-author {
          min-width: 0;
          margin: 0;
          color: var(--text-faint);
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .dashboard-book-arrow {
          width: 28px;
          height: 28px;
          flex: 0 0 28px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-dim);
          cursor: pointer;
          transition: all 0.25s ease;
        }

        .dashboard-book-card:hover .dashboard-book-arrow,
        .dashboard-book-arrow:hover {
          border-color: rgba(46, 204, 113, 0.34);
          color: var(--green-bright);
          background: rgba(46, 204, 113, 0.08);
        }

        @media (max-width: 1100px) {
          .dashboard-books-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .dashboard-books-grid {
            grid-template-columns: 1fr;
          }

          .dashboard-book-card {
            min-height: 0;
            padding: 20px;
          }

          .dashboard-book-cover-frame {
            height: 250px;
            max-height: 250px;
            flex-basis: 250px;
          }
        }
      `}</style>
    </section>
  );
}
