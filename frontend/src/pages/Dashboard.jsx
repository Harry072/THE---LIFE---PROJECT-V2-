import "../styles/tokens.css";
import { useNavigate } from "react-router-dom";
import { useUserStore } from "../store/userStore";
import Sidebar from "../components/dashboard/Sidebar";
import TopBar from "../components/dashboard/TopBar";
import HeroSection from "../components/dashboard/HeroSection";
import TodaysPlan from "../components/dashboard/TodaysPlan";
import FocusTimer from "../components/dashboard/FocusTimer";
import StatCards from "../components/dashboard/StatCards";
import { MeditationCard, QuickPlaylist }
  from "../components/dashboard/MeditationSection";
import BooksGrid from "../components/dashboard/BooksGrid";
import NightReflection
  from "../components/dashboard/NightReflection";
import GrowthTree
  from "../components/GrowthTree";
import QuoteFooter
  from "../components/dashboard/QuoteFooter";
 
export default function Dashboard() {
  const navigate = useNavigate();
  const user = useUserStore(state => state.user);
  const profile = useUserStore(state => state.profile);
  const lifeScore = user?.user_tree?.cumulative_score;
  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      position: "relative",
    }}>
      {/* Atmospheric background gradient */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 0,
        background: `
          radial-gradient(ellipse 70% 40% at 80% 20%,
            rgba(46,204,113,0.06) 0%, transparent 60%),
          radial-gradient(ellipse 50% 40% at 10% 80%,
            rgba(46,204,113,0.03) 0%, transparent 60%)
        `,
        pointerEvents: "none",
      }} />
 
      <Sidebar />
 
      <main style={{
        marginLeft: 240,
        position: "relative", zIndex: 1,
      }}>
        <TopBar />
 
        <div style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "8px 32px 48px",
        }}>
          <HeroSection user={user} profile={profile} />
 
          {/* Row 2: Plan + Focus */}
          <section style={{
            display: "grid",
            gridTemplateColumns: "1.3fr 1fr",
            gap: 24,
            marginBottom: 24,
            animation: "fadeUp 0.6s ease 0.25s both",
          }}>
            <TodaysPlan />
            <FocusTimer />
          </section>
 
          {/* Row 3: Stats */}
          <div style={{
            animation: "fadeUp 0.6s ease 0.35s both",
          }}>
            <StatCards lifeScore={lifeScore} />
          </div>
 
          {/* Row 4: Meditation */}
          <section style={{
            marginBottom: 32,
            animation: "fadeUp 0.6s ease 0.45s both",
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 14,
            }}>
              <h3 style={{
                margin: 0, fontSize: 11, fontWeight: 500,
                letterSpacing: 2.5,
                textTransform: "uppercase",
                color: "var(--text-faint)",
              }}>
                Meditation &amp; Music
              </h3>
              <button
                onClick={() => navigate("/meditation")}
                style={{
                  background: "none", border: "none",
                  color: "var(--green-bright)",
                  fontSize: 12, cursor: "pointer",
                }}
              >
                Explore More &rarr;
              </button>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr",
              gap: 24,
            }}>
              <MeditationCard />
              <QuickPlaylist />
            </div>
          </section>
 
          {/* Row 5: Books */}
          <div style={{
            animation: "fadeUp 0.6s ease 0.55s both",
          }}>
            <BooksGrid />
          </div>
 
          {/* Row 6: Reflection + Growth */}
          <section style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 24,
            marginBottom: 32,
            animation: "fadeUp 0.6s ease 0.65s both",
          }}>
            <NightReflection />
            <GrowthTree />
          </section>
 
          {/* Row 7: Quote */}
          <div style={{
            animation: "fadeIn 0.8s ease 0.75s both",
          }}>
            <QuoteFooter />
          </div>
        </div>
      </main>
 
      {/* Responsive CSS (add to tokens.css) */}
      <style>{`
        @media (max-width: 1023px) {
          aside { width: 64px !important; }
          aside nav span,
          aside [data-widget],
          aside [data-profile-text] {
            display: none !important;
          }
          main { margin-left: 64px !important; }
        }
        @media (max-width: 767px) {
          aside { display: none; }
          main { margin-left: 0 !important; }
          section[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
