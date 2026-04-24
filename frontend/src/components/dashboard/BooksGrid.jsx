import Icon from "../Icon";
import { useNavigate } from "react-router-dom";
import { getDashboardCuratorBooks } from "../../features/curator/curatorData";

const BOOKS = getDashboardCuratorBooks();

function BookCard({ book }) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/curator?book=${book.id}`)}
      style={{
        background: "var(--bg-card)",
        backdropFilter: "blur(24px)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        padding: 16,
        cursor: "pointer",
        transition: "all 0.3s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-4px)";
        e.currentTarget.style.boxShadow = "var(--shadow-lift)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      <div style={{
        aspectRatio: "3/4",
        borderRadius: 8,
        overflow: "hidden",
        marginBottom: 14,
        background: "#222",
      }}>
        <img
          src={book.cover}
          alt={book.title}
          style={{
            width: "100%", height: "100%",
            objectFit: "cover", display: "block",
          }}
        />
      </div>
      <div style={{ display: "flex",
        justifyContent: "space-between", gap: 8,
        alignItems: "flex-start" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 style={{
            margin: 0, fontSize: 14, fontWeight: 500,
            color: "var(--text)",
            fontFamily: "var(--font-body)",
            whiteSpace: "nowrap", overflow: "hidden",
            textOverflow: "ellipsis",
          }}>
            {book.title}
          </h4>
          <p style={{ margin: "3px 0 0", fontSize: 11,
            color: "var(--text-dim)" }}>
            {book.hook}
          </p>
          <p style={{ margin: "6px 0 0", fontSize: 11,
            color: "var(--text-faint)" }}>
            {book.author}
          </p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/curator?book=${book.id}`);
          }}
          style={{
            width: 26, height: 26, borderRadius: 6,
            background: "rgba(255,255,255,0.05)",
            border: "1px solid var(--border)",
            color: "var(--text-dim)",
            cursor: "pointer",
            display: "flex", alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            transition: "all 0.3s",
          }}
        >
          <Icon name="arrow" size={14} />
        </button>
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

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        gap: 16,
      }}>
        {BOOKS.map(b => <BookCard key={b.id} book={b} />)}
      </div>
    </section>
  );
}
