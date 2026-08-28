// DEV-ONLY chain state overlay. Never ships: the whole body is behind
// `import.meta.env.DEV`, which Vite statically replaces with `false` in a
// production build so the minifier drops it as dead code. Same gate as
// DevChainReset.jsx and GrowthTree.jsx:29,37.
//
// Why this exists: the tree card failed to render twice after fixes that
// passed logic traces, because the gap was render-time, not logic-time —
// the values were right and never reached component state. There is no
// DevTools console on the phone this is tested on, so the state has to be
// on the screen.
import { useEffect, useState } from "react";
import { readChain, getStagePool } from "../hooks/useContinuationChain";
import { fetchDashboardPayload } from "../hooks/useDashboard";

export default function ChainDebugOverlay({ fromChain, chainResult }) {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  return <Overlay fromChain={fromChain} chainResult={chainResult} />;
}

function Overlay({ fromChain, chainResult }) {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState(null);
  const [tasksToday, setTasksToday] = useState(null);

  // Only fetches while the panel is open, so a closed overlay costs nothing.
  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      const payload = await fetchDashboardPayload({ fresh: true });
      if (cancelled) return;
      if (!payload) { setPool(["<no payload>"]); return; }
      setTasksToday(payload?.tasks_today ?? null);
      setPool(getStagePool(payload, null, undefined, undefined));
    })();
    return () => { cancelled = true; };
  }, [open]);

  const chain = readChain();
  const row = (k, v) => (
    <div style={{ display: "flex", gap: 8, lineHeight: 1.5 }}>
      <span style={{ opacity: 0.6, minWidth: 104 }}>{k}</span>
      <span style={{ wordBreak: "break-word" }}>{v}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "fixed", right: 8, bottom: 8, zIndex: 2147483646,
        maxWidth: 320, padding: open ? "10px 12px" : "6px 10px",
        borderRadius: 6, border: "2px dashed #000", background: "#00e5ff",
        color: "#000", font: "600 11px/1.4 monospace", cursor: "pointer",
      }}
      onClick={() => setOpen((v) => !v)}
      title="DEV ONLY — continuation chain state"
    >
      {!open ? (
        <span>DEV: CHAIN {chainResult ? "● card" : "○ no card"}</span>
      ) : (
        <div>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>DEV: CHAIN STATE (tap to hide)</div>
          {row("fromChain", String(fromChain))}
          {row("chainResult", chainResult ? (chainResult.isTerminal ? "TERMINAL" : `OFFER ${chainResult.nextFeatureName}`) : "null  <- no card")}
          {row("isTerminal", chainResult ? String(Boolean(chainResult.isTerminal)) : "-")}
          {row("offersShown", String(chain.offersShown))}
          {row("completed", JSON.stringify(chain.completed))}
          {row("closed", String(chain.closed))}
          {row("pool", pool ? JSON.stringify(pool) : "loading...")}
          {row("tasks_today", tasksToday ? JSON.stringify(tasksToday) : "loading...")}
        </div>
      )}
    </div>
  );
}
