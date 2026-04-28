import React from 'react';
import { motion as Motion } from 'framer-motion';

export const GlassCard = ({ children, className = '', ...props }) => (
  <Motion.div 
    className={`glass-card ${className}`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    {...props}
  >
    {children}
  </Motion.div>
);

export const PremiumButton = ({ children, variant = 'primary', className = '', ...props }) => (
  <Motion.button
    className={`btn-premium ${variant === 'secondary' ? 'btn-secondary' : ''} ${className}`}
    whileHover={{ scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    {...props}
  >
    {children}
  </Motion.button>
);

export const InputGroup = ({ label, icon: Icon, ...props }) => (
  <div style={{ marginBottom: '1.5rem', width: '100%' }}>
    {label && <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</label>}
    <div style={{ position: 'relative' }}>
      {Icon && (
        <div style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
          <Icon size={18} />
        </div>
      )}
      <input 
        className="premium-input" 
        style={{ paddingLeft: Icon ? '3rem' : '1.25rem' }}
        {...props} 
      />
    </div>
  </div>
);

export const PageTransition = ({ children }) => (
  <Motion.div
    initial={{ opacity: 0, x: 20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: -20 }}
    transition={{ duration: 0.5, ease: 'easeOut' }}
    style={{ width: '100%', height: '100%' }}
  >
    {children}
  </Motion.div>
);
