import { useState } from "react";

export default function SafeImage({ src, alt, style, className }) {
  const [error, setError] = useState(false);

  if (error || !src) {
    return (
      <div
        className={`safe-image-fallback ${className || ""}`}
        style={{
          ...style,
          background: "linear-gradient(135deg, var(--green) 0%, #0a110a 100%)",
        }}
        title={alt || "Image fallback"}
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt || ""}
      style={style}
      className={className}
      onError={() => setError(true)}
    />
  );
}
