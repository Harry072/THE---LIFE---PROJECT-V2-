// Loading state — skeletons that match the exact three-zone layout, so
// the page tells the user what's coming. No spinner. No "Loading..." text.
// Pure CSS animation: works without JS once painted.

export default function DashboardSkeleton() {
  return (
    <div className="dash-skeleton" aria-hidden="true">
      <div className="dash-skeleton-hero dash-skeleton-pulse" />

      <div className="dashboard-content" style={{
        maxWidth: 1200,
        margin: "0 auto",
        padding: "0 20px 48px",
      }}>
        <div className="dash-skeleton-primary dash-skeleton-pulse" />

        <div className="dash-skeleton-grid">
          {[0, 1, 2, 3, 4].map((index) => (
            <div key={index} className="dash-skeleton-card dash-skeleton-pulse" />
          ))}
        </div>
      </div>

      <style>{`
        .dash-skeleton-pulse {
          background: var(--bg-card-solid);
          animation: dashSkeletonPulse 1.5s ease-in-out infinite;
        }

        @keyframes dashSkeletonPulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 0.8; }
        }

        .dash-skeleton-hero {
          height: 40vh;
          min-height: 260px;
        }

        @media (min-width: 768px) {
          .dash-skeleton-hero {
            height: 45vh;
          }
        }

        .dash-skeleton-primary {
          height: 148px;
          margin-top: 24px;
          border-radius: var(--r-md);
        }

        .dash-skeleton-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
          margin-top: 32px;
        }

        @media (min-width: 768px) {
          .dash-skeleton-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        .dash-skeleton-card {
          height: 128px;
          border-radius: var(--r-md);
        }

        @media (prefers-reduced-motion: reduce) {
          .dash-skeleton-pulse {
            animation: none;
            opacity: 0.6;
          }
        }
      `}</style>
    </div>
  );
}
