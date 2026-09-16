import { useEffect, useRef } from 'react';

/** Runs callback on an interval only while the tab is visible. */
export function useVisibleInterval(callback: () => void, delayMs: number | null) {
  const saved = useRef(callback);
  saved.current = callback;

  useEffect(() => {
    if (delayMs == null) return;
    const ms = delayMs;

    let id: ReturnType<typeof setInterval> | null = null;

    function tick() {
      saved.current();
    }

    function start() {
      stop();
      id = setInterval(tick, ms);
    }

    function stop() {
      if (id) {
        clearInterval(id);
        id = null;
      }
    }

    function onVisibility() {
      if (document.visibilityState === 'visible') {
        tick();
        start();
      } else {
        stop();
      }
    }

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [delayMs]);
}
