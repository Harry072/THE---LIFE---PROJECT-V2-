import React from 'react';
import { motion } from 'framer-motion';

const GrowthTree = ({ branchLevel = 1, leafDensity = 1 }) => {
  const trunkPath = "M50,100 Q50,70 50,40";
  
  const branches = [
    { level: 2, path: "M50,70 Q40,50 20,40", delay: 0.2 },
    { level: 2, path: "M50,60 Q60,40 80,30", delay: 0.4 },
    { level: 3, path: "M30,48 Q20,30 35,20", delay: 0.6 },
    { level: 3, path: "M70,40 Q85,25 65,15", delay: 0.8 },
    { level: 4, path: "M50,40 Q40,20 50,10", delay: 1.0 },
  ];

  const visibleBranches = branches.filter(b => b.level <= branchLevel);

  const generateLeaves = () => {
    let leaves = [];
    const maxLeaves = Math.min(leafDensity * 12, 60);
    
    // Root/Trunk cluster
    for (let i = 0; i < maxLeaves; i++) {
        const cx = 35 + Math.random() * 30;
        const cy = 10 + Math.random() * 45;
        const r = 1 + Math.random() * 2;
        leaves.push(
            <motion.circle 
                key={`l-${i}`} 
                cx={cx} cy={cy} r={r} 
                fill="var(--emerald)" 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.6 + Math.random()*0.4 }}
                transition={{ delay: 1 + Math.random() * 1, duration: 0.8 }}
            />
        );
    }

    // Branch leaves
    visibleBranches.forEach((branch, idx) => {
      const coords = branch.path.split(' ');
      const endPt = coords[coords.length-1].split(',');
      const ex = parseFloat(endPt[0]);
      const ey = parseFloat(endPt[1]);

      for (let i = 0; i < leafDensity * 4; i++) {
        const cx = ex - 8 + Math.random() * 16;
        const cy = ey - 8 + Math.random() * 16;
        const r = 1 + Math.random() * 1.5;
        leaves.push(
            <motion.circle 
                key={`bl-${idx}-${i}`} 
                cx={cx} cy={cy} r={r} 
                fill="var(--emerald)" 
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 0.5 + Math.random()*0.5 }}
                transition={{ delay: branch.delay + 0.5 + Math.random() * 0.5, duration: 0.6 }}
            />
        );
      }
    });

    return leaves;
  };

  return (
    <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '350px', position: 'relative', overflow: 'hidden' }}>
      
      {/* Background glow */}
      <div style={{ position: 'absolute', width: '150px', height: '150px', background: 'var(--emerald-glow)', filter: 'blur(50px)', borderRadius: '50%', zIndex: 0 }} />

      <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-secondary)', position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span>Project: Growth</span>
      </h3>

      <svg width="240" height="240" viewBox="0 0 100 100" style={{ position: 'relative', zIndex: 1, filter: 'drop-shadow(0px 0px 8px var(--emerald-glow))' }}>
        {/* Trunk */}
        <motion.path 
            d={trunkPath} 
            stroke="#5E4F3C" 
            strokeWidth="4" 
            fill="none" 
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
        />
        
        {/* Branches */}
        {visibleBranches.map((branch, i) => (
          <motion.path 
            key={`b-${i}`} 
            d={branch.path} 
            stroke="#5E4F3C" 
            strokeWidth="2.5" 
            fill="none" 
            strokeLinecap="round" 
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, delay: branch.delay, ease: "easeOut" }}
          />
        ))}

        {/* Leaves */}
        {leafDensity > 0 && generateLeaves()}
      </svg>

      <div style={{ marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
        LEVEL {branchLevel} VITALITY {leafDensity * 10}%
      </div>
    </div>
  );
};

export default GrowthTree;
