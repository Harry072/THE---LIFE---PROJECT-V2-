import { BookOpen } from "lucide-react";

export default function KnowledgeCard({ card }) {
  return (
    <article className="reset-knowledge-card">
      <BookOpen size={18} aria-hidden="true" />
      <div>
        <h3>{card.title}</h3>
        <p>{card.body}</p>
      </div>
    </article>
  );
}
