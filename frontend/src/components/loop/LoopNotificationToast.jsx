import { useEffect } from "react";

export default function LoopNotificationToast({
  message,
  isVisible,
  onClose,
  duration = 5200,
}) {
  useEffect(() => {
    if (!isVisible || !message) return undefined;

    const timer = setTimeout(() => {
      onClose?.();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, isVisible, message, onClose]);

  if (!isVisible || !message) return null;

  return (
    <div
      className="loop-notification-toast"
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 22,
        right: 22,
        zIndex: 70,
        width: "min(380px, calc(100vw - 32px))",
        padding: "16px 18px",
        borderRadius: 18,
        border: "1px solid rgba(126, 217, 154, 0.24)",
        background:
          "linear-gradient(180deg, rgba(12,22,17,0.96) 0%, rgba(4,9,7,0.94) 100%)",
        color: "rgba(255,255,255,0.88)",
        boxShadow: "0 22px 64px rgba(0,0,0,0.44)",
        backdropFilter: "blur(18px)",
        display: "flex",
        alignItems: "flex-start",
        gap: 12,
        animation: "loopToastIn 0.26s ease both",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: "var(--green-bright, #2ECC71)",
          boxShadow: "0 0 18px rgba(46,204,113,0.7)",
          marginTop: 7,
          flexShrink: 0,
        }}
      />

      <p
        style={{
          margin: 0,
          flex: 1,
          fontSize: 14,
          lineHeight: 1.55,
          color: "rgba(255,255,255,0.82)",
          fontFamily: "var(--font-body)",
        }}
      >
        {message}
      </p>

      <button
        type="button"
        aria-label="Close notification"
        onClick={onClose}
        style={{
          width: 24,
          height: 24,
          borderRadius: "50%",
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(255,255,255,0.05)",
          color: "rgba(255,255,255,0.55)",
          cursor: "pointer",
          fontSize: 13,
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        x
      </button>

      <style>{`
        @keyframes loopToastIn {
          from { opacity: 0; transform: translate3d(0, -8px, 0); }
          to { opacity: 1; transform: translate3d(0, 0, 0); }
        }

        @media (max-width: 640px) {
          .loop-notification-toast {
            left: 16px !important;
            right: 16px !important;
            top: 16px !important;
            width: auto !important;
          }
        }
      `}</style>
    </div>
  );
}
