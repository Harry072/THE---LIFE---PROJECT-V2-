import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../Icon";
import { readChain } from "../../hooks/useContinuationChain";
import {
  FEATURE_LABELS,
  JOURNEY_ORDER,
  RESPONSIVE_ORDER,
} from "../../data/features";

// Zone 3 — the Journey Path. Two fixed-order rows: four sequential features
// (Row 1, numbered, a real path that doesn't reorder per user state) and two
// responsive features (Row 2, always-available, never sequenced). All six
// always render — nothing locked, nothing hidden, regardless of completion
// or which feature the orchestrator currently has primary. That fixed-order
// guarantee is what makes the old primary-feature exclusion unnecessary:
// a step in a path can't disappear just because it's the current focus.

// Observations, not praise: no exclamation marks, no "great job," no emoji.
const COMPLETION_LINES = {
  loop: "Done today.",
  reflection: "You wrote today.",
  tree: "You looked today.",
  companion: "You talked today.",
  curator: "You read today.",
  reset: "You rested today.",
};

// Fixed, static descriptions — this row describes the shape of the journey
// itself, not a per-user dynamic headline, so it reads the same for
// everyone and never reorders.
const JOURNEY_DESCRIPTIONS = {
  loop: "Take action today.",
  tree: "See the impact of your actions.",
  reflection: "Understand your thoughts and patterns.",
  companion: "Talk it through. Find clarity and guidance.",
};

const RESPONSIVE_DESCRIPTIONS = {
  reset: "When you feel overwhelmed, reset and find calm.",
  curator: "Explore wisdom and knowledge that helps you grow.",
};

// Static local paths only — every file confirmed present in
// public/media/dashboard/ before wiring this map in.
const FEATURE_IMAGES = {
  loop: "/media/dashboard/focus_mountain_landscape.png",
  tree: "/media/dashboard/growth_tree_morning_mist.png",
  reflection: "/media/dashboard/reflection_journal_desk.png",
  companion: "/media/dashboard/companion_forest_leaves.png",
  reset: "/media/dashboard/reset_space_zen_garden.png",
  curator: "/media/dashboard/curator_library_corner.png",
};

function findCard(featureCards, feature) {
  return featureCards.find((c) => c.feature === feature) || null;
}

// Missing/broken image -> hide the <img> so the card's own solid
// var(--bg-card) background shows through, never a broken-image icon.
function handleBgImageError(feature) {
  return (event) => {
    console.warn(`FeatureGrid: background image failed to load for feature "${feature}"`);
    event.currentTarget.style.display = "none";
  };
}

// variant picks the gradient direction: journey cards protect a bottom text
// band (fade to top), responsive cards protect a left text column (fade to
// right) — same image treatment, different shape of card.
function CardBackground({ feature, variant }) {
  const src = FEATURE_IMAGES[feature];
  if (!src) return null;
  return (
    <>
      <img
        className="feature-card-bg"
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={handleBgImageError(feature)}
      />
      <span className={`feature-card-bg-gradient feature-card-bg-gradient--${variant}`} aria-hidden="true" />
    </>
  );
}

function JourneyCard({ feature, index, card, isDone, onOpen }) {
  const label = FEATURE_LABELS[feature] || feature;
  const description = isDone ? COMPLETION_LINES[feature] : JOURNEY_DESCRIPTIONS[feature];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${description}`}
      className={`journey-card${isDone ? " is-done" : ""}`}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <CardBackground feature={feature} variant="journey" />
      <span className="journey-card-numeral" aria-hidden="true">{index + 1}</span>
      {isDone && (
        <span className="journey-card-checkmark" aria-hidden="true">
          <Icon name="check" size={11} color="var(--bg)" strokeWidth={2.5} />
        </span>
      )}
      <div className="journey-card-illustration" aria-hidden="true">
        <Icon name={card?.icon_key || feature} size={40} color="var(--green-bright)" strokeWidth={1.3} />
      </div>
      <p className="journey-card-title">{label}</p>
      <p className="journey-card-description">{description}</p>
    </div>
  );
}

function ResponsiveCard({ feature, card, onOpen }) {
  const label = FEATURE_LABELS[feature] || feature;
  const description = RESPONSIVE_DESCRIPTIONS[feature];

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${label}: ${description}`}
      className="responsive-card"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
    >
      <CardBackground feature={feature} variant="responsive" />
      <div className="responsive-card-icon" aria-hidden="true">
        <Icon name={card?.icon_key || feature} size={24} color="var(--green-bright)" strokeWidth={1.5} />
      </div>
      <div className="responsive-card-text">
        <p className="responsive-card-title">{label}</p>
        <p className="responsive-card-description">{description}</p>
      </div>
      <Icon name="arrow" size={18} color="var(--text-faint)" aria-hidden="true" style={{ position: "relative", zIndex: 2 }} />
    </div>
  );
}

export default function FeatureGrid({ payload }) {
  const navigate = useNavigate();
  const { completed } = readChain();
  const featureCards = Array.isArray(payload?.feature_cards) ? payload.feature_cards : [];

  if (featureCards.length === 0) return null;

  const openFeature = (feature) => {
    const card = findCard(featureCards, feature);
    if (card?.route) navigate(card.route);
  };

  return (
    <>
      <section className="dashboard-journey-section" aria-label="Your journey">
        <p className="dashboard-grid-label">Your Journey</p>
        <div className="journey-row">
          {JOURNEY_ORDER.map((feature, index) => {
            const card = findCard(featureCards, feature);
            const isDone = completed.includes(feature);
            return (
              <Fragment key={feature}>
                <JourneyCard
                  feature={feature}
                  index={index}
                  card={card}
                  isDone={isDone}
                  onOpen={() => openFeature(feature)}
                />
                {index < JOURNEY_ORDER.length - 1 && (
                  <span className="journey-connector-dot" aria-hidden="true" />
                )}
              </Fragment>
            );
          })}
        </div>
      </section>

      <section className="dashboard-responsive-section" aria-label="Always here for you">
        <p className="dashboard-grid-label">Always Here For You</p>
        <div className="responsive-row">
          {RESPONSIVE_ORDER.map((feature) => (
            <ResponsiveCard
              key={feature}
              feature={feature}
              card={findCard(featureCards, feature)}
              onOpen={() => openFeature(feature)}
            />
          ))}
        </div>
      </section>

      <style>{`
        .dashboard-journey-section,
        .dashboard-responsive-section {
          margin-top: 32px;
        }

        .dashboard-grid-label {
          margin: 0 0 14px;
          /* Hardcoded per this fix — existing tokens aren't white enough to
             hold against a now-visible background image. */
          color: rgba(255, 255, 255, 0.45);
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .journey-row {
          display: grid;
          grid-template-columns: 1fr 12px 1fr 12px 1fr 12px 1fr;
          align-items: stretch;
        }

        @media (max-width: 767px) {
          .journey-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }
          .journey-connector-dot {
            display: none;
          }
        }

        .journey-connector-dot {
          align-self: center;
          justify-self: center;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--green-bright);
        }

        .journey-card {
          position: relative;
          overflow: hidden;
          min-height: 44px;
          padding: 18px 14px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          cursor: pointer;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 6px;
          transition: border-color 0.2s ease-in-out;
        }

        .feature-card-bg {
          position: absolute;
          inset: 0;
          z-index: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.35;
          pointer-events: none;
        }

        .feature-card-bg-gradient {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
        }

        /* Journey cards: text sits at the bottom, image should read clearly
           through the top two-thirds where the icon and image meet. */
        .feature-card-bg-gradient--journey {
          background: linear-gradient(to top, rgba(0, 0, 0, 0.90) 0%, rgba(0, 0, 0, 0.70) 40%, rgba(0, 0, 0, 0.30) 100%);
        }

        /* Responsive cards: text sits on the left, image should read
           clearly as it fades in from the right. */
        .feature-card-bg-gradient--responsive {
          background: linear-gradient(to right, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.70) 40%, rgba(0, 0, 0, 0.20) 100%);
        }

        .journey-card:hover,
        .journey-card:focus-visible {
          border-color: var(--border-strong);
          outline: none;
        }

        .journey-card.is-done {
          border-color: var(--green-dim);
        }

        /* A finished thing recedes — dim the content, keep the border and
           badges as the only signal, never the brightest thing on screen. */
        .journey-card.is-done .journey-card-illustration,
        .journey-card.is-done .journey-card-title,
        .journey-card.is-done .journey-card-description {
          opacity: 0.85;
        }

        .journey-card-numeral {
          position: absolute;
          top: 10px;
          left: 12px;
          z-index: 2;
          /* Hardcoded per this fix — see .dashboard-grid-label. */
          color: rgba(255, 255, 255, 0.40);
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
        }

        .journey-card-checkmark {
          position: absolute;
          top: 8px;
          right: 8px;
          z-index: 2;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--green-bright);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .journey-card-illustration {
          position: relative;
          z-index: 2;
          margin-top: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 48px;
        }

        .journey-card-title {
          position: relative;
          z-index: 2;
          margin: 4px 0 0;
          /* Hardcoded per this fix — see .dashboard-grid-label. */
          color: #FFFFFF;
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
          line-height: 1.2;
        }

        .journey-card-description {
          position: relative;
          z-index: 2;
          margin: 0;
          /* Hardcoded per this fix — see .dashboard-grid-label. */
          color: rgba(255, 255, 255, 0.80);
          font-family: var(--font-body);
          font-size: 12.5px;
          line-height: 1.45;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        .responsive-row {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }

        @media (max-width: 767px) {
          .responsive-row {
            grid-template-columns: 1fr;
          }
        }

        .responsive-card {
          position: relative;
          overflow: hidden;
          min-height: 44px;
          padding: 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 14px;
          transition: border-color 0.2s ease-in-out;
        }

        .responsive-card:hover,
        .responsive-card:focus-visible {
          border-color: var(--border-strong);
          outline: none;
        }

        .responsive-card-icon {
          position: relative;
          z-index: 2;
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          background: rgba(46, 204, 113, 0.10);
        }

        .responsive-card-text {
          position: relative;
          z-index: 2;
          flex: 1;
          min-width: 0;
        }

        .responsive-card-title {
          margin: 0;
          /* Hardcoded per this fix — see .dashboard-grid-label. */
          color: #FFFFFF;
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 600;
        }

        .responsive-card-description {
          margin: 4px 0 0;
          /* Hardcoded per this fix — see .dashboard-grid-label. */
          color: rgba(255, 255, 255, 0.80);
          font-family: var(--font-body);
          font-size: 12.5px;
          line-height: 1.45;
        }

        @media (prefers-reduced-motion: reduce) {
          .journey-card,
          .responsive-card {
            transition: none;
          }
        }
      `}</style>
    </>
  );
}

// Re-exported so existing importers of FEATURE_LABELS from this module keep
// working; the definition now lives in data/features.js.
export { FEATURE_LABELS };
