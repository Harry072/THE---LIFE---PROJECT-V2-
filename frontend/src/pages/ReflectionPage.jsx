import { useEffect, useRef, useState } from "react";
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

const HELPER_GROUPS = [
  {
    title: "Look for one moment:",
    items: ["a conversation", "a silence", "a mistake", "a relief"],
  },
  {
    title: "Name one feeling:",
    items: ["not perfectly, just closely"],
  },
  {
    title: "Notice the story:",
    items: ["what happened", "what you told yourself it meant"],
  },
  {
    title: "End small:",
    items: ["one sentence about tomorrow is enough"],
  },
];

const STARTER_CHIPS = [
  "I keep returning to...",
  "The moment I can’t shake is...",
  "I felt most myself when...",
  "I felt pulled away from myself when...",
  "Tomorrow I want to...",
];

const formatDate = (dateStr) => {
  if (!dateStr) return "";
  return new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
};

const getMoodLabel = (mood) => {
  return INNER_WEATHER.find((weather) => weather.id === mood)?.label || "Unmarked";
};

const getReflectionItems = (reflection) => {
  return Array.isArray(reflection?.questions)
    ? reflection.questions.filter((item) => item && typeof item === "object")
    : [];
};

const getPrompt = (item) => item?.prompt ?? item?.q ?? "Reflection prompt";
const getAnswer = (item) => item?.answer ?? item?.a ?? "";

const getPreview = (reflection) => {
  const firstAnswer = getReflectionItems(reflection)
    .map(getAnswer)
    .find((answer) => answer?.trim());

  if (!firstAnswer) return "A quiet entry.";

  const trimmed = firstAnswer.trim();
  return trimmed.length > 120 ? `${trimmed.slice(0, 120)}...` : trimmed;
};

export default function ReflectionPage() {
  const navigate = useNavigate();
  const {
    questions,
    answers,
    setAnswer,
    selectedMood,
    setSelectedMood,
    savedToday,
    loading,
    saving,
    save,
    statusMessage,
    statusTone,
    hasContent,
    recentReflections,
    archiveLoading,
    archiveError,
    loadRecentReflections,
    today,
  } = useReflection();

  const [isCompact, setIsCompact] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [openReflectionId, setOpenReflectionId] = useState(null);
  const [openHelpers, setOpenHelpers] = useState({});
  const [focusedChipId, setFocusedChipId] = useState(null);
  const textareaRefs = useRef({});

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 760px)");
    const handleMediaChange = () => setIsCompact(mediaQuery.matches);

    handleMediaChange();
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  const handleSave = async () => {
    await save();
  };

  const openArchive = async () => {
    setArchiveOpen(true);
    await loadRecentReflections();
  };

  const closeArchive = () => {
    setArchiveOpen(false);
  };

  const editToday = () => {
    setArchiveOpen(false);
    window.setTimeout(() => {
      textareaRefs.current[0]?.focus();
      textareaRefs.current[0]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  };

  const toggleHelper = (index) => {
    setOpenHelpers((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const insertStarter = (index, starter) => {
    const current = answers[index] || "";
    const next = current.trim()
      ? `${current.replace(/\s+$/, "")}\n${starter}`
      : starter;

    setAnswer(index, next);
    window.setTimeout(() => textareaRefs.current[index]?.focus(), 0);
  };

  const buttonLabel = savedToday ? "Update Reflection" : "Save This Reflection";
  const activeStatus = loading ? "Preparing a quiet page..." : statusMessage;

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.bgImage} />
        <div style={styles.ambientOverlay} />
        <main style={styles.container}>
          <p role="status" aria-live="polite" style={styles.loadingText}>
            {activeStatus}
          </p>
        </main>
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
            type="button"
            onClick={() => navigate("/dashboard")}
            style={styles.backBtn}
          >
            ← Return to Dashboard
          </button>
          <button
            type="button"
            onClick={openArchive}
            style={styles.archiveBtn}
          >
            Inner Archive
          </button>
        </div>

        {archiveOpen && (
          <div style={styles.drawerBackdrop} onClick={closeArchive}>
            <aside
              style={{
                ...styles.archiveDrawer,
                ...(isCompact ? styles.archiveDrawerMobile : {}),
              }}
              aria-label="Inner Archive"
              onClick={(event) => event.stopPropagation()}
            >
              <div style={styles.archiveHeader}>
                <div style={styles.archiveTitleBlock}>
                  <h2 style={styles.archiveTitle}>Inner Archive</h2>
                  <p style={styles.archiveSubtitle}>
                    Your saved reflections, kept by date.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeArchive}
                  style={styles.drawerCloseBtn}
                  aria-label="Close Inner Archive"
                >
                  Close
                </button>
              </div>

              {archiveLoading && (
                <p style={styles.archiveMessage}>Loading your recent reflections...</p>
              )}

              {archiveError && (
                <p role="status" style={styles.archiveError}>
                  {archiveError}
                </p>
              )}

              {!archiveLoading && !archiveError && recentReflections.length === 0 && (
                <p style={styles.archiveMessage}>
                  Your archive is quiet for now. Save your first reflection.
                </p>
              )}

              <div style={styles.archiveList}>
                {recentReflections.map((reflection) => {
                  const isToday = reflection.for_date === today;
                  const expanded = openReflectionId === reflection.id;
                  const items = getReflectionItems(reflection);

                  return (
                    <article key={reflection.id} style={styles.archiveCard}>
                      <button
                        type="button"
                        onClick={() => {
                          setOpenReflectionId(expanded ? null : reflection.id);
                        }}
                        style={styles.archiveSummary}
                        aria-expanded={expanded}
                      >
                        <span style={styles.archiveEntryTopline}>
                          <span style={styles.archiveDate}>
                            {formatDate(reflection.for_date)}
                          </span>
                          {isToday && (
                            <span style={styles.todayPill}>Today</span>
                          )}
                        </span>
                        <span style={styles.archiveMood}>
                          {getMoodLabel(reflection.mood)}
                        </span>
                        <span style={styles.archivePreview}>
                          {getPreview(reflection)}
                        </span>
                      </button>

                      {expanded && (
                        <div style={styles.archiveDetail}>
                          {items.length === 0 ? (
                            <p style={styles.archiveAnswer}>No answers saved for this entry.</p>
                          ) : (
                            items.map((item, index) => (
                              <div
                                key={`${getPrompt(item)}-${index}`}
                                style={styles.archiveAnswerBlock}
                              >
                                <p style={styles.archiveQuestion}>{getPrompt(item)}</p>
                                <p style={styles.archiveAnswer}>
                                  {getAnswer(item).trim() || "No answer saved."}
                                </p>
                              </div>
                            ))
                          )}

                          {isToday ? (
                            <button
                              type="button"
                              onClick={editToday}
                              style={styles.editTodayBtn}
                            >
                              Edit today
                            </button>
                          ) : (
                            <p style={styles.readOnlyNote}>Read-only entry</p>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
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
          aria-labelledby="marcus-title"
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
            <h2 id="marcus-title" style={styles.cardTitle}>
              Marcus&apos; Private Journal
            </h2>
            <p style={styles.cardCopy}>
              Before ruling an empire, Marcus tried to rule himself. This space is
              inspired by the same private discipline: a few honest lines, written
              without performance, to return to humility and inner steadiness.
            </p>
          </div>
        </section>

        <p style={styles.reassurance}>
          No need to explain your whole day. One honest sentence is enough.
        </p>

        <fieldset style={styles.weatherFieldset}>
          <legend style={styles.weatherLegend}>
            What is your inner weather tonight?
          </legend>
          <div style={styles.weatherGrid}>
            {INNER_WEATHER.map((weather) => {
              const active = selectedMood === weather.id;
              return (
                <label
                  key={weather.id}
                  style={{
                    ...styles.weatherOption,
                    ...(active ? styles.weatherOptionActive : {}),
                  }}
                >
                  <input
                    type="radio"
                    name="inner-weather"
                    value={weather.id}
                    checked={active}
                    onChange={() => setSelectedMood(weather.id)}
                    style={styles.weatherInput}
                  />
                  <span style={styles.weatherText}>
                    <span style={styles.weatherLabel}>{weather.label}</span>
                    <span style={styles.weatherNote}>{weather.note}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <section style={styles.questionsList} aria-label="Reflection questions">
          {questions.map((question, index) => {
            const helperOpen = Boolean(openHelpers[index]);
            const helperId = `reflection-helper-${index}`;
            const toggleId = `reflection-helper-toggle-${index}`;

            return (
              <article key={question} style={styles.questionCard}>
                <div style={styles.questionNumber}>{index + 1}</div>
                <label htmlFor={`reflection-${index}`} style={styles.questionText}>
                  {question}
                </label>
                <textarea
                  id={`reflection-${index}`}
                  ref={(node) => {
                    if (node) textareaRefs.current[index] = node;
                  }}
                  value={answers[index] || ""}
                  onChange={(event) => setAnswer(index, event.target.value)}
                  placeholder="Write the first honest sentence that comes."
                  rows={5}
                  maxLength={2500}
                  aria-describedby={helperOpen ? helperId : undefined}
                  style={styles.textarea}
                />

                <button
                  id={toggleId}
                  type="button"
                  onClick={() => toggleHelper(index)}
                  style={styles.helperToggle}
                  aria-expanded={helperOpen}
                  aria-controls={helperId}
                >
                  I don’t know what to write
                  <span style={styles.helperToggleMark}>{helperOpen ? "-" : "+"}</span>
                </button>

                {helperOpen && (
                  <div
                    id={helperId}
                    role="region"
                    aria-labelledby={toggleId}
                    style={styles.helperPanel}
                  >
                    <p style={styles.helperHeading}>A gentle place to begin</p>

                    <div style={styles.helperGrid}>
                      {HELPER_GROUPS.map((group) => (
                        <div key={group.title} style={styles.helperGroup}>
                          <p style={styles.helperGroupTitle}>{group.title}</p>
                          <ul style={styles.helperList}>
                            {group.items.map((item) => (
                              <li key={item} style={styles.helperItem}>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>

                    <div style={styles.chipRow} aria-label="Sentence starters">
                      {STARTER_CHIPS.map((starter) => {
                        const chipId = `${index}-${starter}`;
                        const focused = focusedChipId === chipId;

                        return (
                          <button
                            key={starter}
                            type="button"
                            onClick={() => insertStarter(index, starter)}
                            onFocus={() => setFocusedChipId(chipId)}
                            onBlur={() => setFocusedChipId(null)}
                            style={{
                              ...styles.starterChip,
                              ...(focused ? styles.starterChipFocus : {}),
                            }}
                            aria-label={`Insert starter: ${starter}`}
                          >
                            {starter}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </section>

        <section style={styles.saveSection}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasContent}
            style={{
              ...styles.saveBtn,
              ...((saving || !hasContent) ? styles.saveBtnDisabled : {}),
            }}
          >
            {buttonLabel}
          </button>

          <p
            role="status"
            aria-live="polite"
            style={{
              ...styles.statusText,
              ...(statusTone === "success" ? styles.statusSuccess : {}),
              ...(statusTone === "error" ? styles.statusError : {}),
            }}
          >
            {activeStatus || "\u00a0"}
          </p>

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
    width: "min(100% - 32px, 860px)",
    margin: "0 auto",
    padding: "44px 0 88px",
  },
  topActions: {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-start",
    gap: 12,
    flexWrap: "wrap",
    marginBottom: 42,
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
  archiveBtn: {
    background: "rgba(13, 46, 34, 0.56)",
    border: "1px solid rgba(130, 231, 173, 0.22)",
    color: "rgba(255, 250, 240, 0.82)",
    padding: "10px 18px",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    transition: "all 0.2s ease",
    backdropFilter: "blur(10px)",
  },
  drawerBackdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 10,
    background: "rgba(0, 0, 0, 0.48)",
    backdropFilter: "blur(8px)",
  },
  archiveDrawer: {
    width: "min(92vw, 410px)",
    height: "100vh",
    overflowY: "auto",
    padding: "28px 22px",
    background:
      "linear-gradient(145deg, rgba(5, 14, 12, 0.98), rgba(8, 22, 17, 0.96))",
    borderRight: "1px solid rgba(130, 231, 173, 0.2)",
    boxShadow: "30px 0 80px rgba(0, 0, 0, 0.42)",
    boxSizing: "border-box",
  },
  archiveDrawerMobile: {
    width: "100vw",
    maxWidth: "100vw",
    borderRight: "none",
  },
  archiveHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 18,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  archiveTitleBlock: {
    minWidth: 0,
  },
  archiveTitle: {
    margin: 0,
    fontFamily: "var(--font-display)",
    fontSize: "clamp(26px, 5vw, 36px)",
    fontWeight: 500,
    color: "#fffaf0",
  },
  archiveSubtitle: {
    margin: "6px 0 0",
    color: "rgba(255, 250, 240, 0.54)",
    fontSize: 13,
    lineHeight: 1.45,
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
  archiveMessage: {
    margin: 0,
    padding: "18px",
    borderRadius: 18,
    background: "rgba(255, 255, 255, 0.04)",
    border: "1px solid rgba(255, 255, 255, 0.07)",
    color: "rgba(255, 250, 240, 0.62)",
    lineHeight: 1.6,
  },
  archiveError: {
    margin: 0,
    padding: "18px",
    borderRadius: 18,
    background: "rgba(160, 69, 42, 0.18)",
    border: "1px solid rgba(255, 170, 128, 0.28)",
    color: "#ffd2bd",
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
  archiveSummary: {
    width: "100%",
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: "8px 12px",
    alignItems: "center",
    padding: "16px",
    background: "transparent",
    border: "none",
    color: "#fffaf0",
    cursor: "pointer",
    textAlign: "left",
  },
  archiveEntryTopline: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    minWidth: 0,
  },
  archiveDate: {
    color: "rgba(255, 250, 240, 0.78)",
    fontSize: 13,
    fontWeight: 800,
    overflowWrap: "break-word",
  },
  todayPill: {
    borderRadius: 999,
    border: "1px solid rgba(130, 231, 173, 0.24)",
    background: "rgba(130, 231, 173, 0.1)",
    color: "#9ff0bf",
    flex: "0 0 auto",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: 1.1,
    padding: "4px 8px",
    textTransform: "uppercase",
  },
  archiveMood: {
    alignSelf: "start",
    borderRadius: 999,
    border: "1px solid rgba(130, 231, 173, 0.18)",
    background: "rgba(13, 46, 34, 0.42)",
    color: "rgba(130, 231, 173, 0.82)",
    fontSize: 12,
    fontWeight: 900,
    justifySelf: "start",
    padding: "5px 9px",
    textTransform: "capitalize",
    overflowWrap: "break-word",
  },
  archivePreview: {
    color: "rgba(255, 250, 240, 0.58)",
    fontSize: 13,
    lineHeight: 1.5,
    overflowWrap: "break-word",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
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
  editTodayBtn: {
    background: "linear-gradient(135deg, #0f7c50 0%, #2bb673 100%)",
    border: "none",
    borderRadius: 999,
    color: "#03110b",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 900,
    padding: "10px 16px",
  },
  readOnlyNote: {
    margin: "4px 0 0",
    color: "rgba(255, 250, 240, 0.42)",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.4,
    textTransform: "uppercase",
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
    gridTemplateColumns: "minmax(320px, 40%) minmax(0, 1fr)",
    gap: 32,
    alignItems: "center",
    borderRadius: 28,
    padding: 22,
    marginBottom: 24,
  },
  marcusCardCompact: {
    gridTemplateColumns: "1fr",
    gap: 22,
  },
  marcusImageWrap: {
    position: "relative",
    width: "100%",
    maxWidth: 350,
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
    objectPosition: "center 18%",
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
  reassurance: {
    margin: "0 0 30px",
    textAlign: "center",
    color: "rgba(255, 250, 240, 0.64)",
    fontSize: 14,
    lineHeight: 1.6,
  },
  weatherFieldset: {
    border: "none",
    padding: 0,
    margin: "0 0 34px",
    minWidth: 0,
  },
  weatherLegend: {
    width: "100%",
    textAlign: "center",
    fontSize: 15,
    color: "rgba(255, 250, 240, 0.72)",
    margin: "0 0 18px",
    padding: 0,
  },
  weatherGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
  },
  weatherOption: {
    minHeight: 86,
    display: "flex",
    alignItems: "center",
    gap: 11,
    padding: "15px 14px",
    borderRadius: 18,
    background: "rgba(8, 15, 13, 0.62)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "rgba(255, 250, 240, 0.82)",
    cursor: "pointer",
    transition: "all 0.2s ease",
    backdropFilter: "blur(10px)",
  },
  weatherOptionActive: {
    background: "linear-gradient(145deg, rgba(31, 119, 77, 0.42), rgba(212, 165, 83, 0.16))",
    border: "1px solid rgba(130, 231, 173, 0.42)",
    boxShadow: "0 16px 36px rgba(24, 130, 80, 0.18)",
  },
  weatherInput: {
    width: 18,
    height: 18,
    accentColor: "#2bb673",
    flex: "0 0 auto",
  },
  weatherText: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    minWidth: 0,
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
    marginTop: 14,
    padding: "12px 0",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    background: "transparent",
    border: "none",
    borderTop: "1px solid rgba(130, 231, 173, 0.11)",
    color: "rgba(255, 250, 240, 0.72)",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 800,
    textAlign: "left",
  },
  helperToggleMark: {
    width: 24,
    height: 24,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    background: "rgba(130, 231, 173, 0.1)",
    color: "#9ff0bf",
    flex: "0 0 auto",
  },
  helperPanel: {
    marginTop: 2,
    padding: 16,
    borderRadius: 18,
    background: "rgba(2, 10, 8, 0.42)",
    border: "1px solid rgba(130, 231, 173, 0.16)",
    boxShadow: "0 14px 34px rgba(0, 0, 0, 0.2)",
  },
  helperHeading: {
    margin: "0 0 13px",
    color: "rgba(255, 250, 240, 0.84)",
    fontSize: 14,
    fontWeight: 900,
  },
  helperGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  helperGroup: {
    minWidth: 0,
  },
  helperGroupTitle: {
    margin: "0 0 7px",
    color: "rgba(130, 231, 173, 0.74)",
    fontSize: 12,
    fontWeight: 900,
  },
  helperList: {
    margin: 0,
    paddingLeft: 18,
    color: "rgba(255, 250, 240, 0.64)",
    fontSize: 13,
    lineHeight: 1.55,
  },
  helperItem: {
    marginBottom: 4,
    overflowWrap: "break-word",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 9,
    marginTop: 15,
    paddingTop: 14,
    borderTop: "1px solid rgba(255, 255, 255, 0.07)",
  },
  starterChip: {
    border: "1px solid rgba(130, 231, 173, 0.18)",
    background: "rgba(13, 46, 34, 0.46)",
    color: "rgba(255, 250, 240, 0.78)",
    borderRadius: 999,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 800,
    lineHeight: 1.35,
    padding: "9px 12px",
    maxWidth: "100%",
    overflowWrap: "break-word",
    transition: "all 0.2s ease",
  },
  starterChipFocus: {
    border: "1px solid rgba(130, 231, 173, 0.72)",
    boxShadow: "0 0 0 3px rgba(46, 204, 113, 0.18)",
    color: "#fffaf0",
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
  statusText: {
    minHeight: 22,
    margin: "15px 0 0",
    color: "rgba(255, 250, 240, 0.58)",
    fontSize: 14,
    lineHeight: 1.5,
  },
  statusSuccess: {
    color: "#9ff0bf",
  },
  statusError: {
    color: "#ffd2bd",
  },
  privacyNote: {
    fontSize: 13,
    color: "rgba(255, 250, 240, 0.46)",
    margin: "12px 0 0",
  },
};
