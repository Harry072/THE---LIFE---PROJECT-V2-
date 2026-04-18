import React from 'react';
import Icon from '../Icon';

export default function LoopHeader({ streak = 0, onRefresh, generating }) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header style={{
      marginBottom: 40,
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      flexWrap: 'wrap',
      gap: 20
    }}>
      <div>
        <p style={{
          margin: 0,
          fontSize: 14,
          color: 'var(--text-faint)',
          textTransform: 'uppercase',
          letterSpacing: '2px',
          marginBottom: 4
        }}>
          {today}
        </p>
        <h1 style={{
          margin: 0,
          fontSize: 32,
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          color: 'var(--text)'
        }}>
          The Loop
        </h1>
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24
      }}>
        {/* Streak */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(255,154,77,0.1)',
          padding: '8px 16px',
          borderRadius: 12,
          border: '1px solid rgba(255,154,77,0.2)'
        }}>
          <Icon name="flame" size={18} color="#FF9A4D" />
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#FF9A4D'
          }}>
            {streak} Day Streak
          </span>
        </div>

        {/* Refresh Action */}
        <button
          onClick={onRefresh}
          disabled={generating}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-faint)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            padding: '8px 0',
            transition: 'color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.color = 'var(--text-dim)'}
          onMouseLeave={(e) => e.target.style.color = 'var(--text-faint)'}
        >
          <Icon name="loop" size={14} />
          {generating ? "Generating..." : "Refresh Tasks"}
        </button>
      </div>
    </header>
  );
}
