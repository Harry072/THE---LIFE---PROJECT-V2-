import { useState, useRef, useCallback, useEffect } from "react";

export function useAmbientAudio() {
  const ctxRef = useRef(null);
  const nodesRef = useRef([]);
  const gainRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [soundscape, setSoundscape] = useState("forest");

  const start = useCallback((type, scData) => {
    // Stop any existing audio first
    if (ctxRef.current) {
      try {
        nodesRef.current.forEach((n) => {
          try { n.osc.stop(); n.lfo.stop(); } catch (e) {}
        });
        ctxRef.current.close();
      } catch (e) {}
      ctxRef.current = null;
      nodesRef.current = [];
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctxRef.current = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    gainRef.current = master;

    const sc = scData.find((s) => s.id === type) || scData[0];
    const nodes = sc.frequencies.map((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = sc.detune[i];

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = sc.filterFreq;
      filter.Q.value = 1;

      const g = ctx.createGain();
      g.gain.value = sc.volume;

      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start();

      // LFO for organic pulsing
      const lfo = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.frequency.value = 0.1 + i * 0.05;
      lfoG.gain.value = sc.volume * 0.3;
      lfo.connect(lfoG);
      lfoG.connect(g.gain);
      lfo.start();

      return { osc, g, filter, lfo, lfoG };
    });

    nodesRef.current = nodes;
    // Gentle fade in over 2 seconds
    master.gain.setTargetAtTime(1, ctx.currentTime, 2);
    setPlaying(true);
    setSoundscape(type);
  }, []);

  const stop = useCallback(() => {
    if (!gainRef.current || !ctxRef.current) return;
    // Fade out over 0.5 seconds
    gainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.5);
    const currentCtx = ctxRef.current;
    const currentNodes = nodesRef.current;
    setTimeout(() => {
      currentNodes.forEach((n) => {
        try { n.osc.stop(); n.lfo.stop(); } catch (e) {}
      });
      try { currentCtx.close(); } catch (e) {}
    }, 2000);
    ctxRef.current = null;
    nodesRef.current = [];
    gainRef.current = null;
    setPlaying(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        if (gainRef.current && ctxRef.current) {
          gainRef.current.gain.setTargetAtTime(0, ctxRef.current.currentTime, 0.1);
        }
        nodesRef.current.forEach((n) => {
          try { n.osc.stop(); n.lfo.stop(); } catch (e) {}
        });
        if (ctxRef.current) ctxRef.current.close();
      } catch (e) {}
    };
  }, []);

  return { playing, soundscape, start, stop, setSoundscape };
}
