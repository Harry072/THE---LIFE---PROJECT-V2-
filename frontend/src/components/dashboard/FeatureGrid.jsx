import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Icon from "../Icon";
import { getBookById } from "../../features/curator/curatorData";

// Zone 3 — discovery. Cards 2-6 from the orchestrator's ordering. Equal
// sizes, whole card tappable, no chevrons: the primary action above is the
// hierarchy, not anything in here.

const FEATURE_LABELS = {
  loop: "The Loop",
  companion: "Companion",
  reflection: "Reflection",
  tree: "Growth Tree",
  curator: "Curator",
  reset: "Reset Space",
};

// frontend/public/media/dashboard/ (confirmed on disk) covers 5 of the 6
// features. It has no dedicated "loop" asset, so loop keeps the existing
// pre-dashboard-folder image rather than deliberately showing the
// missing-image fallback for a feature that renders in most scenarios.
const FEATURE_IMAGES = {
  companion: "/media/dashboard/companion_forest_leaves.png",
  reflection: "/media/dashboard/reflection_journal_desk.png",
  tree: "/media/dashboard/growth_tree_morning_mist.png",
  curator: "/media/dashboard/curator_library_corner.png",
  reset: "/media/dashboard/reset_space_zen_garden.png",
  loop: "/media/loop/focus-forest.jpg",
};

function cardHeadline(card) {
  if (card.feature === "curator" && card.book_id) {
    const book = getBookById(card.book_id);
    if (book?.title) return `${book.title} is waiting.`;
  }
  return card.headline;
}

export default function FeatureGrid({ payload }) {
  const navigate = useNavigate();
  const [failedImages, setFailedImages] = useState({});
  const primaryFeature = payload?.primary_action?.feature;
  const cards = (payload?.feature_cards || [])
    .filter((card) => card.feature !== primaryFeature);

  if (cards.length === 0) return null;

  return (
    <section className="dashboard-feature-grid-section" aria-label="Your space">
      <p className="dashboard-grid-label">Your Space</p>

      <div className="dashboard-feature-grid">
        {cards.map((card) => {
          const headline = cardHeadline(card);
          const label = FEATURE_LABELS[card.feature] || card.feature;
          const imageFailed = failedImages[card.feature];

          return (
            <div
              key={card.feature}
              role="button"
              tabIndex={0}
              aria-label={`${label}: ${headline}`}
              className="dashboard-feature-card"
              onClick={() => navigate(card.route)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  navigate(card.route);
                }
              }}
            >
              {!imageFailed ? (
                <img
                  src={FEATURE_IMAGES[card.feature]}
                  alt=""
                  aria-hidden="true"
                  loading="lazy"
                  className="dashboard-feature-image"
                  onError={() => {
                    console.warn(`FeatureGrid: image failed to load for feature "${card.feature}"`);
                    setFailedImages((prev) => ({ ...prev, [card.feature]: true }));
                  }}
                />
              ) : null}
              <div className="dashboard-feature-overlay" aria-hidden="true" />
              <div className="dashboard-feature-content">
                <Icon name={card.icon_key} size={16} color="var(--green-bright)" />
                <p className="dashboard-feature-name">{label}</p>
                <span className="dashboard-feature-separator" aria-hidden="true" />
                <p className="dashboard-feature-headline">{headline}</p>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .dashboard-feature-grid-section {
          margin-top: 32px;
        }

        .dashboard-grid-label {
          margin: 0 0 14px;
          color: var(--text-faint);
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 2.5px;
          text-transform: uppercase;
        }

        .dashboard-feature-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }

        @media (min-width: 768px) {
          .dashboard-feature-grid {
            grid-template-columns: repeat(3, 1fr);
          }
        }

        .dashboard-feature-card {
          position: relative;
          height: 120px;
          overflow: hidden;
          isolation: isolate;
          border-radius: 10px;
          background: var(--bg-card);
          cursor: pointer;
          transition: transform 0.25s ease-in-out, box-shadow 0.25s ease-in-out;
        }

        @media (min-width: 768px) {
          .dashboard-feature-card {
            height: 140px;
          }
        }

        .dashboard-feature-card:hover,
        .dashboard-feature-card:focus-visible {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.40);
          outline: none;
        }

        .dashboard-feature-image {
          position: absolute;
          inset: 0;
          z-index: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .dashboard-feature-overlay {
          position: absolute;
          inset: 0;
          z-index: 1;
          background: linear-gradient(to top,
            rgba(0, 0, 0, 0.82) 0%,
            rgba(0, 0, 0, 0.35) 55%,
            rgba(0, 0, 0, 0.05) 100%);
          pointer-events: none;
        }

        .dashboard-feature-content {
          position: absolute;
          bottom: 0;
          left: 0;
          z-index: 2;
          padding: 10px 12px;
        }

        .dashboard-feature-name {
          margin: 0;
          color: var(--green-bright);
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.10em;
          text-transform: uppercase;
        }

        .dashboard-feature-separator {
          display: block;
          width: 20px;
          height: 0;
          margin: 4px 0;
          border-top: 1px solid rgba(255, 255, 255, 0.20);
        }

        .dashboard-feature-headline {
          margin: 0;
          color: #FFFFFF;
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 400;
          line-height: 1.3;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }

        @media (prefers-reduced-motion: reduce) {
          .dashboard-feature-card {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
