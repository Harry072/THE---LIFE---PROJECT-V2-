import { useState, useEffect } from "react";
import { getTaskImage } from "../../data/taskImages";
import LoopDetailContent from "./LoopDetailContent";
 
export default function LoopDetailPanel({ task, allDone = false }) {
  const [visible, setVisible] = useState(false);
  const [prevTask, setPrevTask] = useState(task);
  const [transitioning, setTransitioning] = useState(false);
 
  // Cross-fade on task change
  useEffect(() => {
    if (task?.id !== prevTask?.id) {
      setTransitioning(true);
      setVisible(false);
 
      const timer = setTimeout(() => {
        setPrevTask(task);
        setTransitioning(false);
        // Small delay before content fades in
        setTimeout(() => setVisible(true), 100);
      }, 300); // wait for old content to fade out
 
      return () => clearTimeout(timer);
    } else if (!visible && task) {
      setVisible(true);
    }
  }, [task, prevTask, visible]);
 
  const displayTask = transitioning ? prevTask : task;

  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      background: "#0A0F0D",
      height: "100%",
      minHeight: 520,
      transition: "all 0.5s ease",
      boxShadow: displayTask?.done ? "inset 0 0 100px rgba(46,204,113,0.15)" : "none",
    }}>
      {displayTask ? (
        <>
          {/* Background image with cross-fade */}
          <img
            key={getTaskImage(displayTask.category)}
            src={getTaskImage(displayTask.category)}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: visible ? 1 : 0,
              transition: "opacity 0.6s ease-in-out",
            }}
          />
 
          {/* Gradient overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(transparent 0%, rgba(10,15,13,0.4) 30%, rgba(10,15,13,0.88) 60%)",
          }} />
 
          {/* Text content overlay */}
          <div style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            padding: 28,
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(12px)",
            transition: "opacity 0.35s ease 0.2s, transform 0.35s ease 0.2s",
          }}>
            <LoopDetailContent task={displayTask} />
          </div>
 
          {/* Completed badge */}
          {displayTask.done && (
            <div style={{
              position: "absolute", top: 16, right: 16,
              padding: "6px 14px",
              background: "rgba(46,204,113,0.2)",
              border: "1px solid rgba(46,204,113,0.4)",
              borderRadius: 8,
              color: "var(--green-bright)",
              fontSize: 12,
              fontFamily: "var(--font-body)",
              backdropFilter: "blur(8px)",
              animation: "fadeUp 0.3s ease both",
            }}>
              Completed ✓
            </div>
          )}
        </>
      ) : (
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
        }}>
          <p style={{
            color: "var(--text-faint)",
            fontStyle: "italic",
            fontFamily: "var(--font-display)",
            fontSize: 18,
          }}>
            Hover a task to see its purpose
          </p>
        </div>
      )}

      {/* CELEBRATION OVERLAY */}
      {allDone && (
        <div style={{
          position: "absolute", inset: 0,
          background: "rgba(10,15,13,0.8)",
          backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: 40,
          zIndex: 10,
          animation: "fadeIn 0.6s ease both",
        }}>
          <div style={{ animation: "fadeUp 0.5s ease 0.2s both" }}>
             <div style={{
               fontSize: 48, marginBottom: 20
             }}>✨</div>
             <h2 style={{
               fontFamily: "var(--font-display)",
               fontSize: 32, color: "white",
               margin: "0 0 12px"
             }}>
               A Perfect Circle
             </h2>
             <p style={{
               color: "var(--text-dim)",
               fontSize: 16, lineHeight: 1.6,
               maxWidth: 300, margin: "0 auto"
             }}>
               You've completed every step of today's path. Rest well and return tomorrow.
             </p>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

