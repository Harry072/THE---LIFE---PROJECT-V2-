import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  CircleDot,
  Clock,
  Cloud,
  Feather,
  Leaf,
  Lock,
  Moon,
  ShieldCheck,
  Sprout,
  Sun,
  TreePine,
  Wind,
  X,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useReflection } from "../hooks/useReflection";

const INNER_WEATHER = [
  { id: "clear", label: "Clear", note: "Steady", Icon: Sun },
  { id: "heavy", label: "Heavy", note: "Carrying weight", Icon: Cloud },
  { id: "restless", label: "Restless", note: "Unsettled", Icon: Wind },
  { id: "grateful", label: "Grateful", note: "Softly thankful", Icon: Leaf },
  { id: "hopeful", label: "Hopeful", note: "Looking forward", Icon: Feather },
  { id: "quiet", label: "Quiet", note: "Low and still", Icon: Moon },
  { id: "numb", label: "Numb", note: "Hard to name", Icon: CircleDot },
];

const TREE_STAGE_ICONS = [TreePine, Sprout, Leaf];
const JOURNAL_PROMPT = "The quieter you become, the more you can hear what is true.";

const formatDate = (dateStr, options = {}) => {
  if (!dateStr) return "";
  const source = /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? `${dateStr}T12:00:00` : dateStr;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return "";

  const formatOptions = {
    month: "long",
    day: "numeric",
    ...(options.year ? { year: "numeric" } : {}),
  };

  if (options.weekday !== false) {
    formatOptions.weekday = options.weekday ?? "long";
  }

  return date.toLocaleDateString("en-US", formatOptions);
};

const formatWeekday = (dateStr) => {
  const date = getDateValue(dateStr);
  return date ? date.toLocaleDateString("en-US", { weekday: "long" }) : "";
};

const FALLBACK_ENTRY_TITLE = "A quiet truth surfaced tonight.";
const EMPTY_ENTRY_COPY = "No words saved for this entry.";
const DIRECT_ENTRY_KEYS = [
  "content",
  "main_entry",
  "mainEntry",
  "entry",
  "journal",
  "journal_entry",
  "body",
  "text",
];
const TITLE_KEYS = ["title", "entry_title", "entryTitle"];
const WHY_KEYS = ["why_i_wrote", "whyIWrote", "why", "intention", "reason"];
const LEARNING_KEYS = ["what_im_learning", "whatImLearning", "learning", "lesson"];
const GRATITUDE_KEYS = ["gratitude", "grateful_for", "gratefulFor"];
const SIGNAL_KEYS = ["signal", "inner_signal", "innerSignal"];
const PROMPT_LABEL_KEYS = ["prompt_label", "promptLabel", "reflection_prompt"];
const ANSWER_KEYS = ["answer", "a", "response", "value", "text", "content"];

const toSafeText = (value) => {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" || typeof item === "number" ? String(item).trim() : ""))
      .filter(Boolean)
      .join(", ");
  }
  return "";
};

const getFirstTextField = (source, keys) => (
  keys.map((key) => toSafeText(source?.[key])).find(Boolean) || ""
);

const toTitleCase = (value) => (
  value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
);

const getDateValue = (value) => {
  if (!value) return null;
  const source = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value;
  const date = new Date(source);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getReflectionDateKey = (reflection) => (
  toSafeText(reflection?.for_date || reflection?.reflection_date).slice(0, 10)
);

const getReflectionDateValue = (reflection) => (
  getReflectionDateKey(reflection) || reflection?.created_at || ""
);

const formatEntryTime = (reflection) => {
  const explicitTime = getFirstTextField(reflection, ["time", "entry_time", "entryTime"]);
  if (explicitTime) return explicitTime;

  const date = getDateValue(reflection?.created_at || reflection?.updated_at);
  if (!date) return "";

  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
};

const getWeatherMeta = (reflection) => {
  const rawWeather = getFirstTextField(reflection, [
    "inner_weather",
    "innerWeather",
    "weather",
    "mood",
  ]);

  if (!rawWeather) return null;

  const normalized = rawWeather.toLowerCase().trim();
  const match = INNER_WEATHER.find((weather) => (
    weather.id === normalized || weather.label.toLowerCase() === normalized
  ));

  return {
    label: match?.label || toTitleCase(rawWeather),
    note: getFirstTextField(reflection, ["inner_weather_note", "weather_note", "mood_note"]) || match?.note || "",
    Icon: match?.Icon || Moon,
  };
};

const getIndexedAnswer = (answers, index) => {
  if (Array.isArray(answers)) {
    const answer = answers[index];
    if (answer && typeof answer === "object" && !Array.isArray(answer)) {
      return getFirstTextField(answer, ANSWER_KEYS);
    }

    return toSafeText(answer);
  }

  if (!answers || typeof answers !== "object") return "";

  return toSafeText(
    answers[index]
    ?? answers[String(index)]
    ?? answers[`answer_${index + 1}`]
    ?? answers[`answer${index + 1}`]
    ?? answers[`q${index + 1}`]
  );
};

const normalizeQuestionItem = (item, index, fallbackAnswer = "", treatStringAsPrompt = false) => {
  if (typeof item === "string") {
    const answer = toSafeText(fallbackAnswer);

    if (answer || treatStringAsPrompt) {
      return { prompt: item, answer };
    }

    return { prompt: `Reflection ${index + 1}`, answer: item };
  }

  if (!item || typeof item !== "object" || Array.isArray(item)) return null;

  const prompt = toSafeText(item.prompt ?? item.q ?? item.question ?? item.label);
  const answer = getFirstTextField(item, ANSWER_KEYS) || toSafeText(fallbackAnswer);

  if (!prompt && !answer) return null;

  return {
    prompt: prompt || `Reflection ${index + 1}`,
    answer,
  };
};

const getReflectionItems = (reflection) => {
  const questionItems = Array.isArray(reflection?.questions) ? reflection.questions : [];
  const answers = reflection?.answers;

  if (questionItems.length > 0) {
    const hasSeparateAnswers = answers != null;

    return questionItems
      .map((item, index) => (
        normalizeQuestionItem(item, index, getIndexedAnswer(answers, index), hasSeparateAnswers)
      ))
      .filter(Boolean);
  }

  if (Array.isArray(answers)) {
    return answers
      .map((item, index) => normalizeQuestionItem(item, index))
      .filter(Boolean);
  }

  if (answers && typeof answers === "object") {
    return Object.entries(answers)
      .map(([key, value], index) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          return normalizeQuestionItem(value, index);
        }

        const prompt = /^\d+$/.test(key) ? `Reflection ${Number(key) + 1}` : toTitleCase(key);
        return normalizeQuestionItem({ prompt, answer: value }, index);
      })
      .filter(Boolean);
  }

  return [];
};

const getPrompt = (item) => item?.prompt ?? "Reflection prompt";
const getAnswer = (item) => item?.answer ?? "";

const getAnsweredItems = (reflection) => (
  getReflectionItems(reflection).filter((item) => getAnswer(item).trim())
);

const getDirectEntryText = (reflection) => getFirstTextField(reflection, DIRECT_ENTRY_KEYS);

const getDiarySections = (reflection) => {
  const directEntry = getDirectEntryText(reflection);
  if (directEntry) return [{ prompt: "", answer: directEntry }];

  return getAnsweredItems(reflection);
};

const getMainEntryText = (reflection) => (
  getDiarySections(reflection)
    .map(getAnswer)
    .filter(Boolean)
    .join("\n\n")
);

const truncateText = (value, length = 92) => {
  const text = toSafeText(value).replace(/\s+/g, " ");
  if (!text) return "";
  return text.length > length ? `${text.slice(0, length).trim()}...` : text;
};

const getFirstMeaningfulLine = (text) => (
  text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) || ""
);

const getEntryTitle = (reflection) => {
  const savedTitle = getFirstTextField(reflection, TITLE_KEYS);
  if (savedTitle) return truncateText(savedTitle, 82);

  const firstLine = getFirstMeaningfulLine(getMainEntryText(reflection));
  if (!firstLine) return FALLBACK_ENTRY_TITLE;

  const firstSentence = firstLine.match(/^(.+?[.!?])(\s|$)/)?.[1] || firstLine;
  return truncateText(firstSentence, 82) || FALLBACK_ENTRY_TITLE;
};

const getReadMinutes = (reflection) => {
  const words = getMainEntryText(reflection).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 180));
};

const getArchiveYearLabel = (reflections) => {
  const years = [...new Set(
    reflections
      .map((reflection) => getDateValue(getReflectionDateValue(reflection))?.getFullYear())
      .filter(Boolean)
  )];

  if (years.length === 0) return String(new Date().getFullYear());
  if (years.length === 1) return String(years[0]);

  return `${Math.min(...years)} - ${Math.max(...years)}`;
};

const getPromptLabel = (reflection) => {
  const explicitLabel = getFirstTextField(reflection, PROMPT_LABEL_KEYS);
  if (explicitLabel) return explicitLabel;

  if (getDirectEntryText(reflection)) return "";

  const items = getAnsweredItems(reflection);
  if (items.length !== 1) return "";

  const prompt = getPrompt(items[0]);
  return /^Reflection \d+$/.test(prompt) ? "" : prompt;
};

const shouldShowDiaryQuestion = (item, sections) => (
  sections.length > 1
  && getPrompt(item)
  && getPrompt(item) !== "Reflection prompt"
);

const getStructuredCards = (reflection) => {
  const weather = getWeatherMeta(reflection);
  const why = getFirstTextField(reflection, WHY_KEYS);
  const learning = getFirstTextField(reflection, LEARNING_KEYS);
  const gratitude = getFirstTextField(reflection, GRATITUDE_KEYS);
  const signal = getFirstTextField(reflection, SIGNAL_KEYS);
  const promptLabel = getPromptLabel(reflection);

  return [
    weather && {
      title: "Inner Weather",
      value: weather.label,
      detail: weather.note,
      Icon: weather.Icon,
    },
    why && {
      title: "Why I Wrote",
      value: why,
      Icon: Feather,
    },
    learning && {
      title: "What I'm Learning",
      value: learning,
      Icon: Sun,
    },
    gratitude && {
      title: "Gratitude in This Moment",
      value: gratitude,
      Icon: Leaf,
    },
    !gratitude && signal && {
      title: "Signal",
      value: signal,
      Icon: CircleDot,
    },
    promptLabel && {
      title: "Prompt Label",
      value: promptLabel,
      Icon: BookOpen,
    },
  ].filter(Boolean);
};

function ArchiveEntryDetail({
  reflection,
  onBack,
  onNewReflection,
  onEditEntry,
  isDrawer = false,
}) {
  const isEditable = Boolean(reflection?.content);
  const sections = getDiarySections(reflection);
  const weather = getWeatherMeta(reflection);
  const WeatherIcon = weather?.Icon;
  const cards = getStructuredCards(reflection);
  const entryTime = formatEntryTime(reflection);
  const dateLine = formatDate(getReflectionDateValue(reflection), { year: true }) || "Saved reflection";

  if (!reflection) {
    return (
      <main
        className={[
          "allow-text-select",
          "reflection-archive-detail-panel",
          isDrawer ? "is-drawer-detail" : "",
        ].filter(Boolean).join(" ")}
      >
        <button type="button" className="reflection-archive-back-button" onClick={onBack}>
          <ArrowLeft size={17} strokeWidth={1.7} />
          <span>Back</span>
        </button>
        <p className="reflection-archive-message">Choose an entry from your archive.</p>
      </main>
    );
  }

  return (
    <main
      className={[
        "allow-text-select",
        "reflection-archive-detail-panel",
        isDrawer ? "is-drawer-detail" : "",
      ].filter(Boolean).join(" ")}
    >
      <div className="reflection-archive-detail-actions">
        <button type="button" className="reflection-archive-back-button" onClick={onBack}>
          <ArrowLeft size={17} strokeWidth={1.7} />
          <span>Back</span>
        </button>

        <button type="button" className="reflection-archive-new-button" onClick={onNewReflection}>
          <Feather size={17} strokeWidth={1.7} />
          <span>New Reflection</span>
        </button>
      </div>

      <header className="reflection-archive-detail-header">
        <p>{dateLine.toUpperCase()}</p>
        <h2>{getEntryTitle(reflection)}</h2>
        <div className="reflection-archive-meta-row" aria-label="Entry metadata">
          {weather && WeatherIcon && (
            <span>
              <WeatherIcon size={16} strokeWidth={1.7} />
              {weather.label}
            </span>
          )}
          {entryTime && (
            <span>
              <Clock size={16} strokeWidth={1.7} />
              {entryTime}
            </span>
          )}
          <span>
            <BookOpen size={16} strokeWidth={1.7} />
            {getReadMinutes(reflection)} min read
          </span>
        </div>
      </header>

      <div className="reflection-archive-ornament" aria-hidden="true">
        <span />
      </div>

      <section className="reflection-diary-page" aria-label="Saved journal entry">
        {sections.length === 0 ? (
          <p className="reflection-diary-empty">{EMPTY_ENTRY_COPY}</p>
        ) : (
          sections.map((item, index) => (
            <div key={`${getPrompt(item)}-${index}`} className="reflection-diary-section">
              {shouldShowDiaryQuestion(item, sections) && (
                <p className="reflection-diary-question">{getPrompt(item)}</p>
              )}
              <p>{getAnswer(item).trim() || EMPTY_ENTRY_COPY}</p>
            </div>
          ))
        )}
      </section>

      {cards.length > 0 && (
        <section className="reflection-archive-info-grid" aria-label="Entry details">
          {cards.map(({ title, value, detail, Icon }) => (
            <article key={title} className="reflection-archive-info-card">
              <span className="reflection-archive-info-icon" aria-hidden="true">
                <Icon size={20} strokeWidth={1.6} />
              </span>
              <span>
                <strong>{title}</strong>
                <small>{value}</small>
              </span>
              {detail && <em>{detail}</em>}
            </article>
          ))}
        </section>
      )}

      <p className="reflection-archive-private-note">
        This is your space. No judgment. Just you.
      </p>

      {isEditable && (
        <button
          type="button"
          className="reflection-archive-edit"
          onClick={() => onEditEntry(reflection)}
        >
          Edit this entry
        </button>
      )}
    </main>
  );
}

function ArchivePanel({
  reflections,
  selectedId,
  onSelect,
  selectedReflection,
  loading,
  error,
  onEditEntry,
  onBack,
  onNewReflection,
  onClose,
  detailOpen,
  isDrawer = false,
}) {
  const showDrawerDetail = isDrawer && detailOpen && selectedReflection;

  if (showDrawerDetail) {
    return (
      <aside className="reflection-archive-drawer has-detail">
        <ArchiveEntryDetail
          reflection={selectedReflection}
          onBack={onBack}
          onNewReflection={onNewReflection}
          onEditEntry={onEditEntry}
          isDrawer
        />
      </aside>
    );
  }

  return (
    <aside className={isDrawer ? "reflection-archive-drawer" : "reflection-archive-panel"}>
      <div className="reflection-archive-top">
        <div>
          <h2>My Journal</h2>
          <p>
            Your private diary.
            <span>
              Only you can see this.
              <Lock size={13} strokeWidth={1.7} />
            </span>
          </p>
        </div>

        {isDrawer && (
          <button
            type="button"
            className="reflection-icon-button"
            onClick={onClose}
            aria-label="Close Inner Archive"
          >
            <X size={18} strokeWidth={1.7} />
          </button>
        )}
      </div>

      <div className="reflection-archive-year">{getArchiveYearLabel(reflections)}</div>

      {loading && (
        <p className="reflection-archive-message" role="status">
          Loading your recent reflections...
        </p>
      )}

      {error && (
        <p className="reflection-archive-error" role="status">
          {error}
        </p>
      )}

      {!loading && !error && reflections.length === 0 && (
        <p className="reflection-archive-message">
          Your archive is quiet for now. Save your first reflection.
        </p>
      )}

      <nav className="reflection-archive-list" aria-label="Saved reflections">
        {reflections.map((reflection, index) => {
          const active = detailOpen && selectedId === reflection.id;
          const StageIcon = TREE_STAGE_ICONS[index % TREE_STAGE_ICONS.length];
          const weather = getWeatherMeta(reflection);

          return (
            <button
              key={reflection.id}
              type="button"
              className={[
                "reflection-archive-entry",
                active ? "is-active" : "",
              ].filter(Boolean).join(" ")}
              onClick={() => onSelect(reflection.id)}
              aria-current={active ? "date" : undefined}
            >
              <span className="reflection-archive-stage" aria-hidden="true">
                <StageIcon size={27} strokeWidth={1.35} />
              </span>
              <span className="reflection-archive-entry-copy">
                <span>{formatDate(getReflectionDateValue(reflection), { year: true, weekday: false })}</span>
                <small>
                  {formatWeekday(getReflectionDateValue(reflection))}
                  {formatEntryTime(reflection) ? ` · ${formatEntryTime(reflection)}` : ""}
                </small>
                <strong>{getEntryTitle(reflection)}</strong>
                {weather?.label && (
                  <em>{weather.label}</em>
                )}
              </span>
              {active && <span className="reflection-archive-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </nav>

      {!isDrawer && !selectedReflection && reflections.length > 0 && (
        <p className="reflection-archive-message">
          Select an entry to open your diary page.
        </p>
      )}
    </aside>
  );
}

export default function ReflectionPage() {
  const navigate = useNavigate();
  const {
    entries,
    loading,
    archiveError,
    loadEntries,
    activeEntryId,
    draftContent,
    setDraftContent,
    draftMood,
    setDraftMood,
    startNewEntry,
    startEditingEntry,
    saving,
    saveDraft,
    statusMessage,
    statusTone,
    hasContent,
    today,
  } = useReflection();

  const [isCompact, setIsCompact] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [selectedArchiveId, setSelectedArchiveId] = useState(null);
  const [archiveDetailOpen, setArchiveDetailOpen] = useState(false);
  const textareaRef = useRef(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 860px)");
    const handleMediaChange = () => setIsCompact(mediaQuery.matches);

    handleMediaChange();
    mediaQuery.addEventListener("change", handleMediaChange);

    return () => mediaQuery.removeEventListener("change", handleMediaChange);
  }, []);

  useEffect(() => {
    if (!archiveOpen && !archiveDetailOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setArchiveOpen(false);
        setArchiveDetailOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [archiveDetailOpen, archiveOpen]);

  const selectedArchiveReflection = useMemo(() => (
    entries.find((reflection) => reflection.id === selectedArchiveId) || null
  ), [entries, selectedArchiveId]);

  const handleArchiveSelect = (id) => {
    setSelectedArchiveId(id);
    setArchiveDetailOpen(true);
  };

  const closeArchiveDetail = () => {
    setArchiveDetailOpen(false);
  };

  const focusComposer = () => {
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  };

  const handleSave = async () => {
    if (saving || !hasContent) return;
    await saveDraft();
  };

  const openArchive = async () => {
    setArchiveOpen(true);
    setArchiveDetailOpen(false);
    await loadEntries();
  };

  const handleNewEntry = () => {
    startNewEntry();
    setArchiveOpen(false);
    setArchiveDetailOpen(false);
    focusComposer();
  };

  const handleEditEntry = (reflection) => {
    startEditingEntry(reflection);
    setArchiveOpen(false);
    setArchiveDetailOpen(false);
    focusComposer();
  };

  const activeStatus = loading ? "Preparing a quiet page..." : statusMessage;
  const statusCopy = activeStatus || (hasContent ? "Only you can see this." : "Saved privately");

  if (loading) {
    return (
      <div className="reflection-journal-page">
        <div className="reflection-bg-image" />
        <div className="reflection-bg-overlay" />
        <main className="reflection-loading">
          <p role="status" aria-live="polite">{activeStatus}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="reflection-journal-page">
      <div className="reflection-bg-image" />
      <div className="reflection-bg-overlay" />

      <div className="reflection-shell">
        {!isCompact && (
          <ArchivePanel
            reflections={entries}
            selectedId={selectedArchiveId}
            selectedReflection={selectedArchiveReflection}
            onSelect={handleArchiveSelect}
            loading={loading}
            error={archiveError}
            onEditEntry={handleEditEntry}
            onBack={closeArchiveDetail}
            onNewReflection={handleNewEntry}
            detailOpen={archiveDetailOpen}
          />
        )}

        {!isCompact && archiveDetailOpen && selectedArchiveReflection ? (
          <ArchiveEntryDetail
            reflection={selectedArchiveReflection}
            onBack={closeArchiveDetail}
            onNewReflection={handleNewEntry}
            onEditEntry={handleEditEntry}
          />
        ) : (
        <main className="reflection-main-panel">
          <div className="reflection-main-actions">
            <button
              type="button"
              className="reflection-back-button"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft size={17} strokeWidth={1.7} />
              <span>Dashboard</span>
            </button>

            {isCompact && (
              <button
                type="button"
                className="reflection-mobile-archive-button"
                onClick={openArchive}
              >
                <BookOpen size={17} strokeWidth={1.7} />
                <span>Inner Archive</span>
              </button>
            )}

            <button
              type="button"
              className="reflection-mobile-archive-button"
              onClick={handleNewEntry}
            >
              <Feather size={17} strokeWidth={1.7} />
              <span>Add entry</span>
            </button>

            <div className="reflection-save-cluster">
              <button
                type="button"
                className="reflection-save-button"
                onClick={handleSave}
                disabled={saving || !hasContent}
                aria-label="Save Entry"
              >
                {saving ? "Saving..." : "Save Entry"}
              </button>
              <p className="reflection-save-note">
                <Lock size={13} strokeWidth={1.7} />
                Saved privately
              </p>
            </div>
          </div>

          <header className="reflection-header">
            <p>{formatDate(today).toUpperCase()}</p>
            <h1>Night Reflection</h1>
            <span>
              {activeEntryId
                ? "Editing a past entry. Changes save in place."
                : "Name what is happening without turning it into a verdict."}
            </span>
          </header>

          <section className="reflection-marcus-card" aria-labelledby="marcus-title">
            <div className="reflection-marcus-image-wrap">
              <img
                src="/media/marcus-statue-portrait.png"
                alt="Marcus Aurelius inspired statue portrait"
                className="reflection-marcus-image"
              />
            </div>
            <div className="reflection-marcus-copy">
              <p>Evening Practice</p>
              <h2 id="marcus-title">Marcus&apos; Private Journal</h2>
              <span>
                Before ruling an empire, Marcus tried to rule himself. This space is
                inspired by the same private discipline: a few honest lines, written
                without performance, to return to humility and inner steadiness.
              </span>
            </div>
          </section>

          <section className="reflection-weather-section">
            <p>No need to explain your whole day. One honest sentence is enough.</p>
            <h2>What is your inner weather tonight?</h2>

            <div className="reflection-weather-grid" role="radiogroup" aria-label="Inner weather">
              {INNER_WEATHER.map((weather) => {
                const { id, label, note } = weather;
                const WeatherIcon = weather.Icon;
                const active = draftMood === id;

                return (
                  <button
                    key={id}
                    type="button"
                    className={[
                      "reflection-weather-option",
                      active ? "is-active" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => setDraftMood(id)}
                    role="radio"
                    aria-checked={active}
                  >
                    <WeatherIcon size={22} strokeWidth={1.55} />
                    <span>
                      <strong>{label}</strong>
                      <small>{note}</small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="reflection-canvas-section" aria-label="Private journal entry">
            <textarea
              ref={textareaRef}
              className="journal-textarea reflection-single-canvas"
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              placeholder="Write from your truth..."
              maxLength={2500}
              aria-label="Write your private reflection"
            />
            {!draftContent.trim() && (
              <p className="reflection-phantom-prompt">{JOURNAL_PROMPT}</p>
            )}
            <div className="reflection-canvas-footer">
              <span>
                <Feather size={18} strokeWidth={1.55} />
                {draftContent.length}
              </span>
            </div>
          </section>

          <div className="reflection-footer-row">
            <p>
              <Feather size={20} strokeWidth={1.5} />
              This is your space. No judgment. Just you.
            </p>
            <p>
              <ShieldCheck size={21} strokeWidth={1.5} />
              <span>
                <strong>Private &amp; Secure</strong>
                <small>Only you can see this.</small>
              </span>
            </p>
          </div>

          <p
            className={[
              "reflection-status",
              statusTone === "success" ? "is-success" : "",
              statusTone === "error" ? "is-error" : "",
            ].filter(Boolean).join(" ")}
            role="status"
            aria-live="polite"
          >
            {statusCopy}
          </p>
        </main>
        )}
      </div>

      {isCompact && archiveOpen && (
        <div
          className="reflection-archive-backdrop"
          onClick={() => {
            setArchiveOpen(false);
            setArchiveDetailOpen(false);
          }}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <ArchivePanel
              reflections={entries}
              selectedId={selectedArchiveId}
              selectedReflection={selectedArchiveReflection}
              onSelect={handleArchiveSelect}
              loading={loading}
              error={archiveError}
              onEditEntry={handleEditEntry}
              onBack={closeArchiveDetail}
              onNewReflection={handleNewEntry}
              onClose={() => {
                setArchiveOpen(false);
                setArchiveDetailOpen(false);
              }}
              detailOpen={archiveDetailOpen}
              isDrawer
            />
          </div>
        </div>
      )}
    </div>
  );
}
