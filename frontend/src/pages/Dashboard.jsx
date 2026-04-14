import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';
import GrowthTree from '../components/GrowthTree';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard, PremiumButton, PageTransition } from '../components/common/ThemeUI';
import { CheckCircle, Circle, RefreshCw, LogOut, TrendingUp, Calendar, MessageSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const MOCK_TASKS = [
  { id: 't1', domain: 'Cognitive', content: 'Observe one moment of frustration today without reacting. Just notice the physical sensation.', completed_at: null },
  { id: 't2', domain: 'Behavioral', content: 'Go for a 10-minute walk without your phone. Notice three things in nature you usually ignore.', completed_at: null },
  { id: 't3', domain: 'Purpose', content: 'Write down one thing you are genuinely curious about right now.', completed_at: null }
];

function Dashboard() {
  const { user, profile, logout, fetchUser, demoMode } = useUserStore();
  const [tasks, setTasks] = useState([]);
  const [reflectionAnswers, setReflectionAnswers] = useState(["", "", ""]);
  const [reflectionSubmitted, setReflectionSubmitted] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) fetchTasks();
  }, [user, demoMode]);

  const fetchTasks = async () => {
    setIsRefreshing(true);
    try {
      if (demoMode) {
        setTasks(MOCK_TASKS);
        setIsRefreshing(false);
        return;
      }

      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('assigned_date', today)
        .order('domain');
      if (error) throw error;
      setTasks(data || []);
    } catch (e) {
      console.error("Failed to fetch tasks", e);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCompleteTask = async (taskId) => {
    try {
      if (demoMode) {
        setTasks(tasks.map(t => t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t));
        return;
      }

      const { error } = await supabase
        .from('tasks')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', taskId);
      if (error) throw error;
      setTasks(tasks.map(t => t.id === taskId ? { ...t, completed_at: new Date().toISOString() } : t));
    } catch (e) {
      console.error("Failed to complete task", e);
    }
  };

  const handleReflectionSubmit = async (e) => {
    e.preventDefault();
    try {
      if (demoMode) {
        setReflectionSubmitted(true);
        return;
      }

      const formattedAnswers = reflectionAnswers.map((answer, i) => ({
        question: `Question ${i + 1}`,
        answer,
        skipped: !answer
      }));

      const { data: reflection, error } = await supabase
        .from('reflections')
        .insert({
          user_id: user.id,
          answers: formattedAnswers
        })
        .select()
        .single();
        
      if (error) throw error;

      await supabase.functions.invoke('analyze-reflection', {
        body: { reflection_id: reflection.id }
      });

      setReflectionSubmitted(true);
      await fetchUser();
    } catch (e) {
      console.error("Failed to submit reflection", e);
    }
  };

  return (
    <PageTransition>
      <div className="container" style={{ padding: '3rem 1.5rem', minHeight: '100vh' }}>
        
        {/* Header Section */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4rem' }}>
          <div>
            <motion.p 
                initial={{ opacity: 0 }} 
                animate={{ opacity: 1 }} 
                style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}
            >
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </motion.p>
            <h1 className="text-gradient" style={{ fontSize: '2.5rem' }}>The Loop</h1>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            {/* Meditation */}
            <button onClick={() => navigate("/meditation")}
              title="Meditation & Music"
              aria-label="Open meditation page"
              style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "rgba(46,204,113,0.1)",
                border: "1px solid var(--border-default)",
                color: "var(--accent-green)", cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center",
              }}>
              <svg width="20" height="20" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="6" r="3"/>
                <path d="M12 9v3"/>
                <path d="M8 17c0-2.2 1.8-4 4-4s4 1.8 4 4"/>
                <path d="M4 21h16"/>
              </svg>
            </button>
            
            {/* Founder Story */}
            <button onClick={() => navigate("/story")}
              title="Founder's Story"
              aria-label="Read the founder's journey"
              style={{
                width: 44, height: 44, borderRadius: "50%",
                background: "rgba(46,204,113,0.1)",
                border: "1px solid var(--border-default)",
                color: "var(--accent-green)", cursor: "pointer",
                display: "flex", alignItems: "center",
                justifyContent: "center",
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24"
                fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 20h9"/>
                <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
            </button>

            <button 
                onClick={fetchTasks} 
                className="btn-secondary" 
                style={{ borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: 'none', background: 'var(--glass)' }}
            >
                <RefreshCw size={18} style={{ transform: isRefreshing ? 'rotate(180deg)' : 'none', transition: 'transform 0.5s ease' }} />
            </button>
            <PremiumButton variant="secondary" onClick={logout} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <LogOut size={16} style={{ marginRight: '0.5rem' }} /> Log Out
            </PremiumButton>
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '3rem' }}>
          
          {/* Main Content Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            
            {/* Tasks Section */}
            <section>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                <Calendar size={20} className="text-emerald" />
                <h2 style={{ fontSize: '1.5rem' }}>Daily Missions</h2>
                {demoMode && <span style={{ fontSize: '0.7rem', background: 'var(--gold)', color: '#000', padding: '0.1rem 0.4rem', borderRadius: '4px', fontWeight: 'bold' }}>DEMO</span>}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <AnimatePresence>
                  {tasks.length === 0 && !isRefreshing && (
                    <p style={{ color: 'var(--text-muted)' }}>Preparing your missions for today...</p>
                  )}
                  {tasks.map((task, idx) => (
                    <motion.div 
                        key={task.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.1 }}
                    >
                        <GlassCard 
                            style={{ 
                                padding: '1.5rem', 
                                display: 'flex', 
                                alignItems: 'flex-start', 
                                gap: '1.5rem',
                                opacity: task.completed_at ? 0.5 : 1,
                                filter: task.completed_at ? 'grayscale(0.5)' : 'none'
                            }}
                        >
                            <div 
                                onClick={() => !task.completed_at && handleCompleteTask(task.id)}
                                style={{ 
                                    cursor: task.completed_at ? 'default' : 'pointer',
                                    color: task.completed_at ? 'var(--emerald)' : 'var(--text-muted)',
                                    marginTop: '0.2rem'
                                }}
                            >
                                {task.completed_at ? <CheckCircle size={28} /> : <Circle size={28} />}
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{ color: 'var(--emerald)', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.5rem' }}>
                                    {task.domain}
                                </div>
                                <p style={{ fontSize: '1.1rem', color: task.completed_at ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: task.completed_at ? 'line-through' : 'none' }}>
                                    {task.content}
                                </p>
                            </div>
                        </GlassCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </section>

            {/* Reflection Section */}
            <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
                    <MessageSquare size={20} className="text-gold" />
                    <h2 style={{ fontSize: '1.5rem' }}>Nightly Reflection</h2>
                </div>

                {reflectionSubmitted ? (
                    <GlassCard style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ color: 'var(--emerald)', marginBottom: '1rem' }}><CheckCircle size={40} /></div>
                        <h3>Reflection Recorded</h3>
                        <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>Your honesty is the nutrient for your growth.</p>
                        <PremiumButton variant="secondary" onClick={() => setReflectionSubmitted(false)} style={{ marginTop: '2rem' }}>
                            Edit Reflection
                        </PremiumButton>
                    </GlassCard>
                ) : (
                    <form onSubmit={handleReflectionSubmit}>
                        <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                            {[
                                "What did I do today that aligned with who I want to become?",
                                "What did I avoid — and what was underneath that avoidance?",
                                "What is one honest thing I noticed about myself today?"
                            ].map((q, i) => (
                                <div key={i}>
                                    <label style={{ display: 'block', marginBottom: '1rem', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{q}</label>
                                    <textarea 
                                        className="premium-input"
                                        style={{ minHeight: '100px', resize: 'vertical' }}
                                        value={reflectionAnswers[i]} 
                                        onChange={e => {
                                            const newAnswers = [...reflectionAnswers];
                                            newAnswers[i] = e.target.value;
                                            setReflectionAnswers(newAnswers);
                                        }}
                                        placeholder="Type your reflection here..."
                                        required 
                                    />
                                </div>
                            ))}
                            <PremiumButton type="submit" style={{ alignSelf: 'flex-start' }}>Submit to The Loop</PremiumButton>
                        </GlassCard>
                    </form>
                )}
            </section>
          </div>

          {/* Right Sidebar: Stats & Tree */}
          <aside style={{ position: 'sticky', top: '2rem', height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <GrowthTree 
                branchLevel={profile?.growth_tree?.branch_level ?? 1} 
                leafDensity={profile?.growth_tree?.leaf_density ?? 1} 
            />
            
            <GlassCard style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Vitality Stats</span>
                    <TrendingUp size={16} className="text-emerald" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>Current Streak</span>
                        <span style={{ fontWeight: 'bold' }} className="text-gold">{profile?.streak_count || 0} Days</span>
                    </div>
                    <div style={{ width: '100%', height: '4px', background: 'var(--glass)', borderRadius: '2px', overflow: 'hidden' }}>
                        <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(profile?.streak_count || 0) * 10}%` }}
                            style={{ height: '100%', background: 'var(--gold)' }} 
                        />
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                        "Consistent action is the only antidote to existential dread."
                    </p>
                </div>
            </GlassCard>

            <GlassCard className="shimmer" style={{ padding: '1.5rem', textAlign: 'center', border: '1px dashed var(--emerald)' }}>
                <p style={{ color: 'var(--emerald)', fontSize: '0.85rem', fontWeight: 'bold' }}>COMMUNITY ACCESS PENDING</p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>Vulnerability requires trust. Keep growing to unlock the collective space.</p>
            </GlassCard>
          </aside>

        </div>
      </div>
    </PageTransition>
  );
}

export default Dashboard;
