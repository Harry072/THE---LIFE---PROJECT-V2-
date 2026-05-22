import "../styles/tokens.css";
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useUserStore } from "../store/userStore";
import Sidebar from "../components/dashboard/Sidebar";
import TopBar from "../components/dashboard/TopBar";
import HeroSection from "../components/dashboard/HeroSection";
import TodaysPath from "../components/dashboard/TodaysPath";
import TodaysPlan from "../components/dashboard/TodaysPlan";
import FocusTimer from "../components/dashboard/FocusTimer";
import StatCards from "../components/dashboard/StatCards";
import WeeklyMirrorCard from "../components/dashboard/WeeklyMirrorCard";
import LifeCompanionCard from "../components/dashboard/LifeCompanionCard";
import MeditationSection from "../components/dashboard/MeditationSection";
import BooksGrid from "../components/dashboard/BooksGrid";
import NightReflection
  from "../components/dashboard/NightReflection";
import GrowthTree
  from "../components/GrowthTree";
import QuoteFooter
  from "../components/dashboard/QuoteFooter";
 
export default function Dashboard() {
  const location = useLocation();
  const user = useUserStore(state => state.user);
  const profile = useUserStore(state => state.profile);

  useEffect(() => {
    if (!location.hash) return;

    const targetId = location.hash.slice(1);
    if (!targetId) return;

    window.requestAnimationFrame(() => {
      const target = document.getElementById(targetId);
      if (!target) return;

      target.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [location.hash]);

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
 
      <main className="sidebar-main">
        <TopBar />
 
        <div className="dashboard-content" style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "8px 32px 48px",
        }}>
          <HeroSection user={user} profile={profile} />
          <TodaysPath />
 
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
            <StatCards />
          </div>

          <div id="weekly-mirror" style={{ scrollMarginTop: 24 }}>
            <WeeklyMirrorCard />
          </div>
          <LifeCompanionCard />
 
          {/* Row 4: Meditation */}
          <MeditationSection />
 
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
          <div className="dashboard-quote-footer-wrap" style={{
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
          main > div {
            padding-bottom: 96px !important;
          }
          .dashboard-content {
            padding-left: 16px !important;
            padding-right: 16px !important;
          }
          .dashboard-quote-footer-wrap > section {
            margin-left: -16px !important;
            margin-right: -16px !important;
          }
          section[style*="grid-template-columns"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}
