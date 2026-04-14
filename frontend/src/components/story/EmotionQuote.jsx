import React from "react";

export default function EmotionQuote({ text }) {
  return (
    <blockquote className="emotion-quote">
      <p>"{text}"</p>
    </blockquote>
  );
}
