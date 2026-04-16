import { useNavigate } from "react-router-dom";

export default function NightReflection() {
  const navigate = useNavigate();
  const goToReflection = () => navigate("/loop#reflection");

  return (
    <div
      onClick={goToReflection}
      style={{
        position: "relative",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
        minHeight: 180,
        boxShadow: "var(--shadow-lift)",
        cursor: "pointer",
      }}
    >
      <img
        src="/media/lantern-dock.jpg"
        alt=""
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "cover",
        }}
      />
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(to right, "
          + "rgba(10,15,13,0.82) 0%, "
          + "rgba(10,15,13,0.5) 55%, "
          + "transparent 100%)",
      }} />

      <div style={{
        position: "relative", padding: "24px 26px",
        maxWidth: "60%",
      }}>
        <p style={{
          margin: 0, fontSize: 11, fontWeight: 500,
          letterSpacing: 2.5, textTransform: "uppercase",
          color: "var(--text-faint)",
        }}>
          Night Reflection
        </p>
        <h3 style={{
          margin: "14px 0 6px",
          fontFamily: "var(--font-display)",
          fontSize: 26, fontWeight: 500,
          color: "var(--text)",
        }}>
          How was your day?
        </h3>
        <p style={{
          margin: "0 0 18px", fontSize: 13,
          color: "var(--text-dim)",
        }}>
          Take 2 minutes to reflect and grow.
        </p>
        <button
          onClick={(e) => {
            e.stopPropagation();
            goToReflection();
          }}
          style={{
            padding: "9px 22px",
            background: "linear-gradient(135deg, "
              + "var(--green) 0%, var(--green-bright) 100%)",
            border: "none", borderRadius: 20,
            color: "white", fontFamily: "var(--font-body)",
            fontWeight: 500, fontSize: 13,
            cursor: "pointer",
            boxShadow: "0 4px 16px var(--green-glow)",
          }}
        >
          Start Reflection
        </button>
      </div>
    </div>
  );
}
