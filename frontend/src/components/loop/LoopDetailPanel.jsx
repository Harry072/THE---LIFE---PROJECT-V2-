/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect } from "react";
import { getCinematicImage } from "../../utils/imageMapping";
import LoopDetailContent from "./LoopDetailContent";

export default function LoopDetailPanel({ task }) {
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
  
  if (!displayTask) return (
    <div style={{
      background: "#0D1310",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100%",
      minHeight: 520,
    }}>
      <p style={{
        color: "var(--text-faint)",
        fontStyle: "italic",
        fontFamily: "var(--font-display)",
        fontSize: 18,
      }}>
        Select a task to see its purpose
      </p>
    </div>
  );

  // Dynamic image based on task category and title
  const taskImage = getCinematicImage(displayTask.category, displayTask.title);

  return (
    <div style={{
      position: "relative",
      overflow: "hidden",
      background: "#0D1310",
      height: "100%",
      minHeight: 520,
    }}>
      {/* Background image with cross-fade and dynamic source */}
      <img
        key={taskImage}
        src={taskImage}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: visible ? 0.4 : 0, // Lower opacity for better text contrast
          transition: "opacity 0.6s ease-in-out",
        }}
      />

      {/* Gradient overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(transparent 0%, rgba(10,15,13,0.4) 30%, rgba(10,15,13,0.88) 60%)",
      }} />

      {/* Text content */}
      <div style={{
        position: "absolute",
        inset: 0,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(12px)",
        transition: "opacity 0.35s ease 0.2s, transform 0.35s ease 0.2s",
      }}>
        <LoopDetailContent
          key={displayTask.id || displayTask.title}
          task={displayTask}
        />
      </div>

      {/* Completed overlay */}
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
        }}>
          Completed ✓
        </div>
      )}
      
      <style>{`
        @keyframes fadeUp {
            from { opacity: 0; transform: translateY(8px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
