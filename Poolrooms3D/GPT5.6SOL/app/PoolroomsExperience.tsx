"use client";

import { useEffect, useRef, useState } from "react";

export function PoolroomsExperience() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<{ enter(): void; dispose(): void } | null>(null);
  const [entered, setEntered] = useState(false);
  const [status, setStatus] = useState("initializing enclosed light field");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!canvasRef.current) return;
      const { PoolroomsApp } = await import("./engine/PoolroomsApp");
      if (cancelled || !canvasRef.current) return;

      const app = new PoolroomsApp(canvasRef.current, (message) => {
        setStatus(message);
        if (message === "simulation stable") setReady(true);
      });
      appRef.current = app;
      await app.init();
    }

    void boot();
    return () => {
      cancelled = true;
      appRef.current?.dispose();
      appRef.current = null;
    };
  }, []);

  const enter = () => {
    setEntered(true);
    appRef.current?.enter();
  };

  return (
    <main className="poolrooms-shell">
      <canvas
        ref={canvasRef}
        className="poolrooms-canvas"
        aria-label="Interactive first-person poolrooms simulation"
        tabIndex={0}
      />
      <button
        className="entry-veil"
        data-hidden={entered}
        onClick={enter}
        aria-label="Enter the poolrooms simulation"
      >
        <span className="entry-copy">
          <span className="entry-title">POOL / NULL</span>
          <span className="entry-line" />
          <span className="entry-hint">click to enter · wasd to walk · mouse to look</span>
        </span>
      </button>
      <p className="status-whisper" data-ready={ready} aria-live="polite">
        {status}
      </p>
    </main>
  );
}
