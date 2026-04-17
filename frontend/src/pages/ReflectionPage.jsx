import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReflection } from "../hooks/useReflection";

const MOODS = [
  { id: "grateful",   emoji: "😌", label: "Grateful" },
  { id: "reflective", emoji: "🤔", label: "Reflective" },
  { id: "heavy",      emoji: "😔", label: "Heavy" },
  { id: "hopeful",    emoji: "🌱", label: "Hopeful" },
  { id: "neutral",    emoji: "😶", label: "Neutral" },
];

export default function ReflectionPage() {
  const navigate = useNavigate();
  const {
    questions,
    answers,
    setAnswer,
    savedToday,
    saving,
    save,
    pastReflections,
    loading,
    hasContent,
    today,
  } = useReflection();
  
  const [selectedMood, setSelectedMood] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSave = async () => {
    const result = await save(selectedMood);
    if (result?.success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(dateStr + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.container}>
          <p style={styles.loadingText}>
            Creating a space for your thoughts...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Premium Realistic Nature Background */}
      <div style={styles.bgImage} />
      <div style={styles.ambientOverlay} />

      <div style={styles.container}>
        {/* Back Button */}
        <button 
          onClick={() => navigate("/dashboard")}
          style={styles.backBtn}
        >
          ← Return to Dashboard
        </button>

        {/* Header - Soulful & Genuine Text */}
        <header style={styles.header}>
          <p style={styles.dateLabel}>{formatDate(today)}</p>
          <h1 style={styles.title}>Night Reflection</h1>
          <p style={styles.intro}>
            The world is quiet now. Beyond the noise of the day, there is a version 
            of you that simply *is*. These questions are not a checklist; they are 
            mirrors. Speak your truth, even if it’s only for yourself.
          </p>
        </header>

        {/* Success Banner */}
        {(savedToday || showSuccess) && (
          <div style={styles.successBanner}>
            <span style={{ fontSize: 20 }}>✓</span>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Truth recorded</p>
              <p style={{ margin: "2px 0 0", fontSize: 13, opacity: 0.8 }}>
                Your thoughts have been safely archived in your private history.
              </p>
            </div>
          </div>
        )}

        {/* Mood Selector */}
        <div style={styles.section}>
          <p style={styles.sectionLabel}>How does your spirit feel in this moment?</p>
          <div style={styles.moodRow}>
            {MOODS.map((m) => (
              <button
                key={m.id}
                onClick={() => setSelectedMood(m.id)}
                style={{
                  ...styles.moodBtn,
                  background: selectedMood === m.id ? "rgba(34, 197, 94, 0.15)" : "rgba(10, 15, 13, 0.4)",
                  border: `1px solid ${selectedMood === m.id ? "rgba(34, 197, 94, 0.4)" : "rgba(255,255,255,0.06)"}`,
                }}
              >
                <span style={{ fontSize: 24 }}>{m.emoji}</span>
                <span style={{ 
                  fontSize: 11, 
                  color: selectedMood === m.id ? "#22c55e" : "rgba(255,255,255,0.4)" 
                }}>
                  {m.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Questions */}
        <div style={styles.questionsList}>
          {questions.map((q, i) => (
            <div key={i} style={styles.questionCard}>
              <div style={styles.qNumber}>{i + 1}</div>
              <label style={styles.questionText}>{q}</label>
              <textarea
                value={answers[i] || ""}
                onChange={(e) => setAnswer(i, e.target.value)}
                placeholder="Let the words flow naturally..."
                rows={4}
                style={styles.textarea}
              />
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div style={styles.footer}>
          <button
            onClick={handleSave}
            disabled={saving || !hasContent}
            style={{
              ...styles.saveBtn,
              opacity: (!hasContent || saving) ? 0.5 : 1,
              cursor: (!hasContent || saving) ? "default" : "pointer",
            }}
          >
            {saving ? "Saving..." : savedToday ? "Update Reflection" : "Conserve Today's Truth"}
          </button>
          <p style={styles.privacyNote}>
            Your words are private, rare, and protected.
          </p>
        </div>

        {/* History Section */}
        {pastReflections.length > 1 && (
          <section style={styles.historySection}>
            <h2 style={styles.historyTitle}>Echoes of the Past</h2>
            <div style={styles.historyGrid}>
              {pastReflections
                .filter(r => r.for_date !== today)
                .slice(0, 5)
                .map((r) => (
                  <div key={r.id} style={styles.historyCard}>
                    <p style={styles.historyDate}>{formatDate(r.for_date)}</p>
                    {r.questions.slice(0,1).map((item, idx) => (
                      <div key={idx}>
                        <p style={styles.historyQ}>{item.q}</p>
                        <p style={styles.historyA}>{item.a || "Silence."}</p>
                      </div>
                    ))}
                    {r.mood && (
                      <div style={styles.historyMood}>
                        {MOODS.find(m => m.id === r.mood)?.emoji} {r.mood}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </section>
        )}

        {/* Closing Quote */}
        <footer style={styles.pageFooter}>
          <p style={styles.quote}>
            "Knowledge of the soul is a rare and difficult science." — Ancient Wisdom
          </p>
        </footer>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#050807",
    color: "#FFFFFF",
    position: "relative",
    overflowX: "hidden",
  },
  bgImage: {
    position: "fixed",
    inset: 0,
    backgroundImage: "url('/media/reflection_bg.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: 0.6,
    zIndex: 0,
    filter: "brightness(0.7) contrast(1.1)",
  },
  ambientOverlay: {
    position: "fixed",
    inset: 0,
    background: `linear-gradient(to bottom, rgba(5, 8, 7, 0.4) 0%, rgba(5, 8, 7, 0.9) 80%)`,
    backdropFilter: "blur(12px)",
    zIndex: 1,
    pointerEvents: "none",
  },
  container: {
    position: "relative",
    zIndex: 2,
    maxWidth: 720,
    margin: "0 auto",
    padding: "60px 24px 100px",
  },
  backBtn: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.6)",
    padding: "10px 24px",
    borderRadius: "24px",
    cursor: "pointer",
    fontSize: "13px",
    marginBottom: "56px",
    transition: "all 0.3s ease",
    backdropFilter: "blur(8px)",
  },
  header: {
    textAlign: "center",
    marginBottom: "64px",
  },
  dateLabel: {
    fontSize: "11px",
    letterSpacing: "4px",
    textTransform: "uppercase",
    color: "rgba(34, 197, 94, 0.7)",
    margin: "0 0 16px",
    fontWeight: 700,
  },
  title: {
    fontSize: "clamp(36px, 6vw, 48px)",
    fontFamily: "'Playfair Display', serif",
    fontWeight: 500,
    margin: "0 0 20px",
    fontStyle: "italic",
    letterSpacing: "-0.02em",
  },
  intro: {
    fontSize: "16px",
    lineHeight: "1.8",
    color: "rgba(255,255,255,0.6)",
    maxWidth: "540px",
    margin: "0 auto",
    fontStyle: "italic",
  },
  loadingText: {
    textAlign: "center",
    marginTop: "160px",
    fontSize: "20px",
    fontStyle: "italic",
    color: "rgba(255,255,255,0.3)",
  },
  successBanner: {
    display: "flex",
    alignItems: "center",
    gap: "20px",
    padding: "20px 28px",
    background: "rgba(34, 197, 94, 0.12)",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: "20px",
    marginBottom: "48px",
    color: "#4ade80",
    backdropFilter: "blur(10px)",
  },
  section: {
    marginBottom: "56px",
  },
  sectionLabel: {
    textAlign: "center",
    fontSize: "14px",
    color: "rgba(255,255,255,0.4)",
    marginBottom: "24px",
    fontStyle: "italic",
  },
  moodRow: {
    display: "flex",
    justifyContent: "center",
    gap: "14px",
    flexWrap: "wrap",
  },
  moodBtn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "8px",
    padding: "20px",
    borderRadius: "20px",
    minWidth: "85px",
    cursor: "pointer",
    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
    backdropFilter: "blur(4px)",
  },
  questionsList: {
    display: "flex",
    flexDirection: "column",
    gap: "40px",
    marginBottom: "64px",
  },
  questionCard: {
    position: "relative",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "40px 32px",
    borderRadius: "32px",
    backdropFilter: "blur(16px)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
  },
  qNumber: {
    position: "absolute",
    top: "-14px",
    left: "32px",
    width: "32px",
    height: "32px",
    borderRadius: "50%",
    background: "#16a34a",
    color: "#FFFFFF",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "14px",
    fontWeight: "800",
    boxShadow: "0 4px 15px rgba(22, 163, 74, 0.5)",
  },
  questionText: {
    display: "block",
    fontSize: "21px",
    fontFamily: "'Playfair Display', serif",
    fontStyle: "italic",
    marginBottom: "24px",
    lineHeight: "1.5",
    color: "rgba(255,255,255,0.95)",
  },
  textarea: {
    width: "100%",
    background: "rgba(0,0,0,0.3)",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "16px",
    padding: "20px",
    color: "#FFFFFF",
    fontSize: "16px",
    lineHeight: "1.7",
    fontFamily: "inherit",
    outline: "none",
    resize: "none",
    boxSizing: "border-box",
    transition: "border-color 0.3s ease",
  },
  footer: {
    textAlign: "center",
    marginBottom: "100px",
  },
  saveBtn: {
    background: "linear-gradient(135deg, #065f46 0%, #16a34a 100%)",
    border: "none",
    padding: "18px 56px",
    borderRadius: "40px",
    color: "#FFFFFF",
    fontSize: "17px",
    fontWeight: 600,
    boxShadow: "0 12px 30px rgba(22, 163, 74, 0.2)",
    transition: "all 0.3s ease",
    letterSpacing: "0.5px",
  },
  privacyNote: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.25)",
    marginTop: "20px",
    fontStyle: "italic",
  },
  historySection: {
    borderTop: "1px solid rgba(255,255,255,0.08)",
    paddingTop: "72px",
  },
  historyTitle: {
    fontSize: "24px",
    fontFamily: "'Playfair Display', serif",
    fontStyle: "italic",
    color: "rgba(255,255,255,0.5)",
    marginBottom: "32px",
    textAlign: "center",
  },
  historyGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },
  historyCard: {
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.04)",
    borderRadius: "24px",
    padding: "24px",
    backdropFilter: "blur(4px)",
  },
  historyDate: {
    fontSize: "11px",
    letterSpacing: "2px",
    textTransform: "uppercase",
    color: "rgba(34, 197, 94, 0.4)",
    margin: "0 0 16px",
    fontWeight: 600,
  },
  historyQ: {
    fontSize: "15px",
    fontStyle: "italic",
    color: "rgba(255,255,255,0.3)",
    margin: "0 0 6px",
  },
  historyA: {
    fontSize: "15px",
    lineHeight: "1.6",
    color: "rgba(255,255,255,0.7)",
    margin: 0,
  },
  historyMood: {
    display: "inline-block",
    marginTop: "16px",
    padding: "5px 12px",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "10px",
    fontSize: "12px",
    color: "rgba(255,255,255,0.4)",
    textTransform: "capitalize",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  pageFooter: {
    marginTop: "100px",
    textAlign: "center",
  },
  quote: {
    fontSize: "18px",
    fontFamily: "'Playfair Display', serif",
    fontStyle: "italic",
    color: "rgba(255,255,255,0.15)",
  },
};
