import React from 'react';
import { useUserStore } from '../store/userStore';
import Sidebar from '../components/dashboard/Sidebar';
import TopBar from '../components/dashboard/TopBar';
import Icon from '../components/Icon';
import { handleSignOut } from '../lib/auth';
import { getPreferredInitial, getPreferredUsername } from '../utils/userDisplayName';

export default function ProfilePage() {
  const { user, profile } = useUserStore();
  const displayName = getPreferredUsername(user, profile);
  const initial = getPreferredInitial(user, profile);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      color: "var(--text)",
      position: "relative",
    }}>
      <Sidebar />

      <main style={{
        marginLeft: 240,
        position: "relative", zIndex: 1,
      }}>
        <TopBar />

        <div style={{
          maxWidth: 800,
          margin: "0 auto",
          padding: "40px 32px",
        }}>
          {/* Header */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            marginBottom: 40,
            animation: "fadeUp 0.6s ease both",
          }}>
            <div style={{
              width: 100,
              height: 100,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--green), #1a2a1a)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontFamily: "var(--font-display)",
              fontWeight: 600,
              color: "white",
              boxShadow: "0 10px 30px rgba(46,204,113,0.2)",
            }}>
              {initial}
            </div>
            <div>
              <h1 style={{
                margin: 0,
                fontSize: 32,
                fontFamily: "var(--font-display)",
                letterSpacing: "-0.02em",
              }}>
                {displayName}
              </h1>
              <p style={{
                margin: "4px 0 0",
                fontSize: 16,
                color: "var(--text-faint)",
              }}>
                {user?.email}
              </p>
            </div>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 24,
            animation: "fadeUp 0.6s ease 0.2s both",
          }}>
            {/* Account Info */}
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: 24,
            }}>
              <h3 style={{
                margin: "0 0 16px",
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: "var(--text-faint)",
              }}>
                Account Details
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-faint)" }}>Member Since</label>
                  <p style={{ margin: "2px 0 0", fontSize: 15 }}>April 2026</p>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-faint)" }}>Identity Status</label>
                  <p style={{ 
                    margin: "2px 0 0", 
                    fontSize: 14, 
                    color: "var(--green-bright)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6
                  }}>
                    <Icon name="check" size={14} /> 
                    {profile?.onboarding_completed ? "Journey Started" : "Onboarding Pending"}
                  </p>
                </div>
              </div>
            </div>

            {/* Growth Stats */}
            <div style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: 24,
            }}>
              <h3 style={{
                margin: "0 0 16px",
                fontSize: 14,
                textTransform: "uppercase",
                letterSpacing: 1.5,
                color: "var(--text-faint)",
              }}>
                Growth Statistics
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-faint)" }}>Current Streak</label>
                  <p style={{ margin: "2px 0 0", fontSize: 15 }}>{profile?.streak_count || 0} Days</p>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: "var(--text-faint)" }}>Focus Areas</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
                    {(profile?.struggle_tags || []).map((tag, i) => (
                      <span key={i} style={{
                        fontSize: 11,
                        padding: "4px 10px",
                        borderRadius: 20,
                        background: "rgba(255,255,255,0.05)",
                        border: "1px solid var(--border)",
                        color: "var(--text-dim)",
                      }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            {/* SIGN OUT BUTTON */}
            <div style={{ marginTop: 40, textAlign: 'center' }}>
              <button
                onClick={handleSignOut}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: 'var(--text)',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-card)')}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
