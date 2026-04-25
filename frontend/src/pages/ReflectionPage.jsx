import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useReflection } from "../hooks/useReflection";

const INNER_WEATHER = [
  { id: "clear", label: "Clear", note: "Steady" },
  { id: "heavy", label: "Heavy", note: "Carrying weight" },
  { id: "restless", label: "Restless", note: "Unsettled" },
  { id: "grateful", label: "Grateful", note: "Softly thankful" },
  { id: "hopeful", label: "Hopeful", note: "Looking forward" },
  { id: "quiet", label: "Quiet", note: "Low and still" },
  { id: "numb", label: "Numb", note: "Hard to name" },
];

const THINKING_POINTS = [
  "one moment that stayed with you",
  "one feeling you ignored",
  "one thing you postponed",
  "one person or situation that affected you",
];

const STARTERS = [
  "Today I noticed...",
  "I kept thinking about...",
  "I felt heavy when...",
  "I avoided...",
  "Tomorrow I want to...",
];

export default function ReflectionPage() {
  const navigate = useNavigate();
  const {
    questions,
    answers,
    setAnswer,
    selectedMood,
    setSelectedMood,
    savedToday,
    saving,
    save,
    saveError,
    pastReflections,
    loading,
    hasContent,
    today,
  } = useReflection();

  const [showSuccess, setShowSuccess] = useState(false);
  const [openHelpers, setOpenHelpers] = useState({});
  const [openArchiveId, setOpenArchiveId] = useState(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const handleMediaChange = () => setIsCompact(mediaQuery.matches);

    handleMediaChange();
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  const handleSave = async () => {
    const result = await save();
    if (result?.success) {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 5000);
    }
  };

  const toggleHelper = (index) => {
    setOpenHelpers((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  };

  const getWeatherLabel = (mood) => {
    return INNER_WEATHER.find((item) => item.id === mood)?.label || "Unmarked";
  };

  const getAnswerItems = (reflection) => {
    return Array.isArray(reflection?.questions)
      ? reflection.questions.filter((item) => item && typeof item !== "string")
      : [];
  };

  const getPreview = (reflection) => {
    const firstAnswer = getAnswerItems(reflection).find((item) => item.a?.trim());
    if (!firstAnswer) return "A quiet entry.";
    const preview = firstAnswer.a.trim();
    return preview.length > 120 ? `${preview.slice(0, 120)}...` : preview;
  };

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.bgImage} />
        <div style={styles.ambientOverlay} />
        <div style={styles.container}>
          <p style={styles.loadingText}>Preparing a quiet page...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.bgImage} />
      <div style={styles.ambientOverlay} />

      <main style={styles.container}>
        <div style={styles.topActions}>
          <button
            onClick={() => navigate("/dashboard")}
            style={styles.backBtn}
          >
            Return to Dashboard
          </button>
          <button
            type="button"
            onClick={() => setArchiveOpen(true)}
            style={styles.archiveOpenBtn}
          >
            Inner Archive
            <span style={styles.archiveOpenCount}>{pastReflections.length}</span>
          </button>
        </div>

        {archiveOpen && (
          <div style={styles.drawerBackdrop} onClick={() => setArchiveOpen(false)}>
            <aside
              style={styles.archiveDrawer}
              onClick={(event) => event.stopPropagation()}
              aria-label="Inner Archive"
            >
              <div style={styles.archiveHeader}>
                <div>
                  <p style={styles.cardEyebrow}>Private memory journal</p>
                  <h2 style={styles.archiveTitle}>Inner Archive</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setArchiveOpen(false)}
                  style={styles.drawerCloseBtn}
                  aria-label="Close Inner Archive"
                >
                  Close
                </button>
              </div>

              {pastReflections.length === 0 ? (
                <div style={styles.emptyArchive}>
                  Your archive is quiet for now. Save your first reflection.
                </div>
              ) : (
                <div style={styles.archiveList}>
                  {pastReflections.map((reflection) => {
                    const isOpen = openArchiveId === reflection.id;
                    const answerItems = getAnswerItems(reflection);

                    return (
                      <article key={reflection.id} style={styles.archiveCard}>
                        <button
                          type="button"
                          onClick={() => setOpenArchiveId(isOpen ? null : reflection.id)}
                          style={styles.archiveButton}
                          aria-expanded={isOpen}
                        >
                          <span style={styles.archiveDate}>
                            {formatDate(reflection.for_date)}
                          </span>
                          <span style={styles.archiveMood}>
                            {getWeatherLabel(reflection.mood)}
                          </span>
                          <span style={styles.archivePreview}>
                            {getPreview(reflection)}
                          </span>
                        </button>

                        {isOpen && (
                          <div style={styles.archiveDetail}>
                            {answerItems.length === 0 ? (
                              <p style={styles.archiveAnswer}>This entry was saved quietly.</p>
                            ) : (
                              answerItems.map((item) => (
                                <div key={item.q} style={styles.archiveAnswerBlock}>
                                  <p style={styles.archiveQuestion}>{item.q}</p>
                                  <p style={styles.archiveAnswer}>
                                    {item.a?.trim() || "No words saved for this question."}
                                  </p>
                                </div>
                              ))
                            )}
                            {reflection.insight_text && (
                              <p style={styles.archiveInsight}>{reflection.insight_text}</p>
                            )}
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>
        )}

        <header style={styles.header}>
          <p style={styles.dateLabel}>{formatDate(today)}</p>
          <h1 style={styles.title}>Night Reflection</h1>
          <p style={styles.subtitle}>
            You do not need perfect words. Begin with what stayed.
          </p>
        </header>

        <section
          style={{
            ...styles.marcusCard,
            ...(isCompact ? styles.marcusCardCompact : {}),
          }}
        >
          <div
            style={{
              ...styles.marcusImageWrap,
              ...(isCompact ? styles.marcusImageWrapCompact : {}),
            }}
          >
            <img
              src="/media/marcus-statue-portrait.png"
              alt="Marcus Aurelius inspired statue portrait"
              style={styles.marcusImage}
            />
            <div style={styles.marcusImageOverlay} />
          </div>
          <div style={styles.marcusText}>
            <p style={styles.cardEyebrow}>Evening practice</p>
            <h2 style={styles.cardTitle}>Marcus&apos; Private Journal</h2>
            <p style={styles.cardCopy}>
              Before ruling an empire, Marcus tried to rule himself. Marcus Aurelius,
              a Roman emperor, used private writing to steady himself through
              responsibility, pressure, ego, hardship, and duty. His reflections were
              not written to impress anyone. They were a way to return to humility and
              govern himself first. This space is inspired by that same idea: before
              improving life outside, you learn to sit honestly with the life inside.
            </p>
          </div>
        </section>

        {showSuccess && (
          <div style={styles.successBanner}>
            <span style={styles.successMark}>Saved</span>
            <div>
              <p style={styles.successTitle}>Reflection saved</p>
              <p style={styles.successCopy}>
                Your words stay in your private archive.
              </p>
            </div>
          </div>
        )}

        {saveError && (
          <div style={styles.errorBanner}>
            {saveError}
          </div>
        )}

        <section style={styles.section}>
          <p style={styles.sectionLabel}>What is your inner weather tonight?</p>
          <div style={styles.weatherGrid}>
            {INNER_WEATHER.map((weather) => {
              const active = selectedMood === weather.id;
              return (
                <button
                  key={weather.id}
                  onClick={() => setSelectedMood(weather.id)}
                  style={{
                    ...styles.weatherBtn,
                    ...(active ? styles.weatherBtnActive : {}),
                  }}
                >
                  <span style={styles.weatherLabel}>{weather.label}</span>
                  <span style={styles.weatherNote}>{weather.note}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section style={styles.questionsList} aria-label="Reflection questions">
          {questions.map((question, index) => {
            const helperOpen = Boolean(openHelpers[index]);
            return (
              <article key={question} style={styles.questionCard}>
                <div style={styles.questionNumber}>{index + 1}</div>
                <label htmlFor={`reflection-${index}`} style={styles.questionText}>
                  {question}
                </label>
                <textarea
                  id={`reflection-${index}`}
                  value={answers[index] || ""}
                  onChange={(event) => setAnswer(index, event.target.value)}
                  placeholder="Write the first honest sentence that comes."
                  rows={5}
                  style={styles.textarea}
                />

                <button
                  type="button"
                  onClick={() => toggleHelper(index)}
                  style={styles.helperToggle}
                  aria-expanded={helperOpen}
                >
                  A gentle place to begin
                  <span style={styles.helperChevron}>{helperOpen ? "-" : "+"}</span>
                </button>

                {helperOpen && (
                  <div style={styles.helperPanel}>
                    <div style={styles.helperColumn}>
                      <p style={styles.helperHeading}>Think about</p>
                      <ul style={styles.helperList}>
                        {THINKING_POINTS.map((point) => (
                          <li key={point} style={styles.helperItem}>{point}</li>
                        ))}
                      </ul>
                    </div>
                    <div style={styles.helperColumn}>
                      <p style={styles.helperHeading}>Start with</p>
                      <ul style={styles.helperList}>
                        {STARTERS.map((starter) => (
                          <li key={starter} style={styles.helperItem}>{starter}</li>
                        ))}
                      </ul>
                    </div>
                    <p style={styles.helperExample}>
                      Example: "I felt restless after scrolling for too long. I think
                      I was avoiding my work."
                    </p>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section style={styles.saveSection}>
          <button
            onClick={handleSave}
            disabled={saving || !hasContent}
            style={{
              ...styles.saveBtn,
              ...((saving || !hasContent) ? styles.saveBtnDisabled : {}),
            }}
          >
            {saving
              ? "Saving..."
              : savedToday
                ? "Update Reflection"
                : "Save This Reflection"}
          </button>
          <p style={styles.privacyNote}>
            Your words stay in your private archive.
          </p>
        </section>
      </main>
    </div>
  );
}

const sharedCard = {
  background: "linear-gradient(145deg, rgba(7, 19, 16, 0.78), rgba(6, 12, 11, 0.7))",
  border: "1px solid rgba(180, 244, 210, 0.12)",
  boxShadow: "0 24px 70px rgba(0, 0, 0, 0.36)",
  backdropFilter: "blur(18px)",
};

const styles = {
  page: {
    minHeight: "100vh",
    background: "#040706",
    color: "#fffaf0",
    position: "relative",
    overflowX: "hidden",
  },
  bgImage: {
    position: "fixed",
    inset: 0,
    backgroundImage: "url('/media/reflection_bg.png')",
    backgroundSize: "cover",
    backgroundPosition: "center",
    opacity: 0.64,
    zIndex: 0,
    filter: "brightness(0.72) contrast(1.12) saturate(0.9)",
  },
  ambientOverlay: {
    position: "fixed",
    inset: 0,
    background:
      "radial-gradient(circle at 50% 18%, rgba(218, 174, 93, 0.2), transparent 32%), " +
      "linear-gradient(to bottom, rgba(3, 8, 7, 0.42), rgba(3, 8, 7, 0.95) 72%, #030807)",
    zIndex: 1,
    pointerEvents: "none",
  },
  container: {
    position: "relative",
    zIndex: 2,
    width: "min(100% - 32px, 820px)",
    margin: "0 auto",
    padding: "48px 0 96px",
  },
  topActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 46,
  },
  backBtn: {
    background: "rgba(255, 255, 255, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "rgba(255, 250, 240, 0.72)",
    padding: "10px 18px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 13,
    transition: "all 0.2s ease",
    backdropFilter: "blur(10px)",
  },
  archiveOpenBtn: {
    display: "inline-flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(13, 46, 34, 0.56)",
    border: "1px solid rgba(130, 231, 173, 0.22)",
    color: "rgba(255, 250, 240, 0.82)",
    padding: "10px 14px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    transition: "all 0.2s ease",
    backdropFilter: "blur(10px)",
  },
  archiveOpenCount: {
    minWidth: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 999,
    background: "rgba(130, 231, 173, 0.13)",
    color: "#9ff0bf",
    fontSize: 12,
  },
  drawerBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 10,
    background: "rgba(0, 0, 0, 0.48)",
    backdropFilter: "blur(8px)",
  },
  archiveDrawer: {
    width: "min(92vw, 460px)",
    height: "100vh",
    overflowY: "auto",
    padding: "28px 22px",
    background:
      "linear-gradient(145deg, rgba(5, 14, 12, 0.98), rgba(8, 22, 17, 0.96))",
    borderRight: "1px solid rgba(130, 231, 173, 0.2)",
    boxShadow: "30px 0 80px rgba(0, 0, 0, 0.42)",
    boxSizing: "border-box",
  },
  drawerCloseBtn: {
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    color: "rgba(255, 250, 240, 0.72)",
    padding: "9px 13px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },
  header: {
    textAlign: "center",
    marginBottom: 34,
  },
  dateLabel: {
    fontSize: 11,
    letterSpacing: 3.5,
    textTransform: "uppercase",
    color: "rgba(130, 231, 173, 0.72)",
    margin: "0 0 14px",
    fontWeight: 700,
  },
  title: {
    fontSize: "clamp(40px, 8vw, 64px)",
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    margin: "0 0 16px",
    lineHeight: 1.02,
    overflowWrap: "anywhere",
  },
  subtitle: {
    fontSize: "clamp(16px, 3vw, 20px)",
    lineHeight: 1.7,
    color: "rgba(255, 250, 240, 0.72)",
    maxWidth: 560,
    margin: "0 auto",
  },
  loadingText: {
    textAlign: "center",
    marginTop: 160,
    fontSize: 19,
    fontStyle: "italic",
    color: "rgba(255, 250, 240, 0.56)",
  },
  marcusCard: {
    ...sharedCard,
    display: "grid",
    gridTemplateColumns: "minmax(300px, 38%) minmax(0, 1fr)",
    gap: 32,
    alignItems: "center",
    borderRadius: 28,
    padding: 22,
    marginBottom: 28,
  },
  marcusCardCompact: {
    gridTemplateColumns: "1fr",
    gap: 22,
  },
  marcusImageWrap: {
    position: "relative",
    width: "100%",
    maxWidth: 360,
    height: 340,
    justifySelf: "start",
    overflow: "hidden",
    borderRadius: 28,
    border: "1px solid rgba(130, 231, 173, 0.34)",
    boxShadow: "0 22px 52px rgba(0, 0, 0, 0.34)",
    background: "rgba(0, 0, 0, 0.28)",
  },
  marcusImageWrapCompact: {
    maxWidth: "100%",
    height: 240,
    justifySelf: "stretch",
  },
  marcusImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    objectPosition: "center top",
    display: "block",
    filter: "saturate(0.94) contrast(1.04)",
  },
  marcusImageOverlay: {
    position: "absolute",
    inset: 0,
    background:
      "linear-gradient(to bottom, rgba(0, 0, 0, 0.08), rgba(2, 8, 6, 0.42)), " +
      "radial-gradient(circle at 50% 28%, rgba(130, 231, 173, 0.1), transparent 38%)",
    pointerEvents: "none",
  },
  marcusText: {
    minWidth: 0,
    padding: "4px 4px 4px 0",
  },
  cardEyebrow: {
    margin: "0 0 10px",
    fontSize: 11,
    letterSpacing: 2.6,
    textTransform: "uppercase",
    color: "rgba(130, 231, 173, 0.64)",
    fontWeight: 700,
  },
  cardTitle: {
    margin: "0 0 14px",
    fontFamily: "var(--font-display)",
    fontSize: "clamp(25px, 5vw, 34px)",
    fontWeight: 500,
    color: "#fffaf0",
    overflowWrap: "anywhere",
  },
  cardCopy: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.8,
    color: "rgba(255, 250, 240, 0.72)",
    overflowWrap: "break-word",
  },
  successBanner: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "16px 20px",
    background: "rgba(28, 142, 88, 0.18)",
    border: "1px solid rgba(88, 224, 152, 0.3)",
    borderRadius: 20,
    marginBottom: 24,
    color: "#9ff0bf",
    backdropFilter: "blur(12px)",
  },
  successMark: {
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(88, 224, 152, 0.12)",
  },
  successTitle: {
    margin: 0,
    fontWeight: 700,
  },
  successCopy: {
    margin: "3px 0 0",
    fontSize: 13,
    color: "rgba(255, 250, 240, 0.68)",
  },
  errorBanner: {
    padding: "16px 18px",
    background: "rgba(160, 69, 42, 0.18)",
    border: "1px solid rgba(255, 170, 128, 0.28)",
    borderRadius: 18,
    marginBottom: 24,
    color: "#ffd2bd",
    fontSize: 14,
  },
  section: {
    marginBottom: 34,
  },
  sectionLabel: {
    textAlign: "center",
    fontSize: 15,
    color: "rgba(255, 250, 240, 0.72)",
    margin: "0 0 18px",
  },
  weatherGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
  },
  weatherBtn: {
    minHeight: 86,
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 7,
    padding: "16px",
    borderRadius: 18,
    background: "rgba(8, 15, 13, 0.62)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "rgba(255, 250, 240, 0.82)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textAlign: "left",
    backdropFilter: "blur(10px)",
  },
  weatherBtnActive: {
    background: "linear-gradient(145deg, rgba(31, 119, 77, 0.42), rgba(212, 165, 83, 0.16))",
    border: "1px solid rgba(130, 231, 173, 0.42)",
    boxShadow: "0 16px 36px rgba(24, 130, 80, 0.18)",
  },
  weatherLabel: {
    fontSize: 16,
    fontWeight: 700,
    color: "#fffaf0",
  },
  weatherNote: {
    fontSize: 12,
    lineHeight: 1.35,
    color: "rgba(255, 250, 240, 0.52)",
  },
  questionsList: {
    display: "flex",
    flexDirection: "column",
    gap: 28,
    marginBottom: 34,
  },
  questionCard: {
    ...sharedCard,
    position: "relative",
    borderRadius: 28,
    padding: "36px 28px 28px",
  },
  questionNumber: {
    position: "absolute",
    top: -14,
    left: 28,
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "linear-gradient(135deg, #0f8f5a, #d8a657)",
    color: "#06100c",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 900,
    boxShadow: "0 10px 24px rgba(12, 110, 68, 0.35)",
  },
  questionText: {
    display: "block",
    fontSize: "clamp(20px, 4vw, 27px)",
    fontFamily: "var(--font-display)",
    marginBottom: 20,
    lineHeight: 1.28,
    color: "#fffaf0",
    overflowWrap: "break-word",
  },
  textarea: {
    width: "100%",
    minHeight: 160,
    background: "rgba(0, 0, 0, 0.28)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: 18,
    padding: 18,
    color: "#fffaf0",
    fontSize: 16,
    lineHeight: 1.7,
    fontFamily: "var(--font-body)",
    outline: "none",
    resize: "vertical",
    boxSizing: "border-box",
    overflowWrap: "break-word",
  },
  helperToggle: {
    width: "100%",
    marginTop: 16,
    padding: "13px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    background: "transparent",
    border: "none",
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    color: "rgba(255, 250, 240, 0.74)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    textAlign: "left",
  },
  helperChevron: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
    height: 24,
    borderRadius: "50%",
    background: "rgba(255, 255, 255, 0.07)",
    flex: "0 0 auto",
  },
  helperPanel: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: 18,
    padding: "18px",
    borderRadius: 18,
    background: "rgba(255, 250, 240, 0.05)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
  },
  helperColumn: {
    minWidth: 0,
  },
  helperHeading: {
    margin: "0 0 10px",
    fontSize: 12,
    letterSpacing: 1.8,
    textTransform: "uppercase",
    color: "rgba(130, 231, 173, 0.68)",
    fontWeight: 800,
  },
  helperList: {
    margin: 0,
    paddingLeft: 18,
    color: "rgba(255, 250, 240, 0.7)",
  },
  helperItem: {
    marginBottom: 7,
    lineHeight: 1.5,
    overflowWrap: "break-word",
  },
  helperExample: {
    gridColumn: "1 / -1",
    margin: 0,
    paddingTop: 14,
    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
    color: "rgba(255, 250, 240, 0.62)",
    fontSize: 14,
    lineHeight: 1.6,
    fontStyle: "italic",
    overflowWrap: "break-word",
  },
  saveSection: {
    textAlign: "center",
    marginBottom: 54,
  },
  saveBtn: {
    background: "linear-gradient(135deg, #0f7c50 0%, #2bb673 58%, #d1a352 100%)",
    border: "none",
    padding: "17px 34px",
    borderRadius: 999,
    color: "#03110b",
    fontSize: 16,
    fontWeight: 900,
    boxShadow: "0 18px 38px rgba(22, 163, 96, 0.22)",
    transition: "all 0.2s ease",
    cursor: "pointer",
    maxWidth: "100%",
  },
  saveBtnDisabled: {
    opacity: 0.48,
    cursor: "default",
    boxShadow: "none",
  },
  privacyNote: {
    fontSize: 13,
    color: "rgba(255, 250, 240, 0.46)",
    margin: "16px 0 0",
  },
  archiveSection: {
    ...sharedCard,
    borderRadius: 28,
    padding: "26px",
  },
  archiveHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  archiveTitle: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "clamp(26px, 5vw, 36px)",
    fontWeight: 500,
    color: "#fffaf0",
  },
  archiveCount: {
    margin: 0,
    padding: "8px 12px",
    borderRadius: 999,
    background: "rgba(255, 255, 255, 0.06)",
    color: "rgba(255, 250, 240, 0.58)",
    fontSize: 12,
    fontWeight: 700,
  },
  emptyArchive: {
    padding: "22px",
    borderRadius: 18,
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    color: "rgba(255, 250, 240, 0.62)",
    lineHeight: 1.6,
  },
  archiveList: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  archiveCard: {
    borderRadius: 18,
    background: "rgba(0, 0, 0, 0.22)",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    overflow: "hidden",
  },
  archiveButton: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 12,
    alignItems: "center",
    padding: "16px",
    background: "transparent",
    border: "none",
    color: "#fffaf0",
    cursor: "pointer",
    textAlign: "left",
  },
  archiveDate: {
    color: "rgba(255, 250, 240, 0.78)",
    fontSize: 13,
    fontWeight: 800,
    overflowWrap: "break-word",
  },
  archiveMood: {
    color: "rgba(130, 231, 173, 0.72)",
    fontSize: 13,
    fontWeight: 800,
    textTransform: "capitalize",
    overflowWrap: "break-word",
  },
  archivePreview: {
    color: "rgba(255, 250, 240, 0.58)",
    fontSize: 13,
    lineHeight: 1.5,
    overflowWrap: "break-word",
  },
  archiveDetail: {
    padding: "0 16px 16px",
  },
  archiveAnswerBlock: {
    paddingTop: 16,
    borderTop: "1px solid rgba(255, 255, 255, 0.07)",
  },
  archiveQuestion: {
    margin: "0 0 7px",
    color: "rgba(255, 250, 240, 0.48)",
    fontSize: 13,
    fontWeight: 800,
    overflowWrap: "break-word",
  },
  archiveAnswer: {
    margin: "0 0 14px",
    color: "rgba(255, 250, 240, 0.78)",
    fontSize: 14,
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
  },
  archiveInsight: {
    margin: "4px 0 0",
    padding: "14px",
    borderRadius: 14,
    background: "rgba(130, 231, 173, 0.08)",
    color: "rgba(255, 250, 240, 0.74)",
    fontSize: 14,
    lineHeight: 1.6,
  },
};
