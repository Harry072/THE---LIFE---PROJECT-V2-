import { useNavigate } from "react-router-dom";
import Icon from "../Icon";

export default function LifeCompanionCard() {
  const navigate = useNavigate();

  return (
    <section className="life-companion-card">
      <div className="life-companion-card-glow" aria-hidden="true" />
      <div className="life-companion-card-content">
        <div>
          <p>Life Companion</p>
          <h3>Speak, understand, then take one useful step.</h3>
          <span>Bounded guidance from your Loop, Mirror, Reflection, and Reset Space.</span>
        </div>
        <button type="button" onClick={() => navigate("/companion")}>
          <Icon name="sparkle" size={16} />
          Open Companion
        </button>
      </div>

      <style>{`
        .life-companion-card {
          position: relative;
          overflow: hidden;
          margin-bottom: 24px;
          padding: 22px 24px;
          border: 1px solid rgba(126, 217, 154, 0.16);
          border-radius: var(--r-md);
          background:
            linear-gradient(135deg, rgba(6, 22, 16, 0.92), rgba(8, 18, 14, 0.7)),
            url("/media/misty-lake.jpg");
          background-size: cover;
          background-position: center;
          box-shadow: var(--shadow-soft);
          backdrop-filter: blur(24px);
          animation: fadeUp 0.6s ease 0.48s both;
        }

        .life-companion-card-glow {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at 88% 14%, rgba(46, 204, 113, 0.16), transparent 34%),
            linear-gradient(90deg, rgba(4, 10, 8, 0.92), rgba(4, 10, 8, 0.56));
        }

        .life-companion-card-content {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 18px;
          align-items: center;
        }

        .life-companion-card p {
          margin: 0 0 8px;
          color: rgba(126, 217, 154, 0.76);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
        }

        .life-companion-card h3 {
          margin: 0;
          color: var(--text);
          font-family: var(--font-display);
          font-size: clamp(24px, 4vw, 32px);
          font-weight: 500;
          line-height: 1.12;
        }

        .life-companion-card span {
          display: block;
          margin-top: 10px;
          color: rgba(232, 232, 227, 0.62);
          font-size: 13px;
          line-height: 1.5;
        }

        .life-companion-card button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: 1px solid rgba(46, 204, 113, 0.34);
          border-radius: 999px;
          background: rgba(46, 204, 113, 0.12);
          color: rgba(178, 255, 209, 0.96);
          cursor: pointer;
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 800;
          line-height: 1;
          padding: 13px 18px;
          white-space: nowrap;
        }

        @media (max-width: 720px) {
          .life-companion-card-content {
            grid-template-columns: 1fr;
          }

          .life-companion-card button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  );
}
