import { useEffect, useRef, useState } from 'react';

/**
 * Number that animates smoothly when value changes (counter effect).
 * - duration: ms
 * - format: function to format each frame
 * Respects prefers-reduced-motion.
 */
export default function AnimatedNumber({ value, duration = 600, format = (n) => n.toLocaleString('it-IT'), className }) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef();
  const fromRef = useRef(value);

  useEffect(() => {
    const prefersReduced = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const from = fromRef.current;
    const diff = value - from;
    if (diff === 0) return;

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out quart
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = from + diff * eased;
      setDisplay(Number.isInteger(value) ? Math.round(current) : current);
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return <span className={className}>{format(display)}</span>;
}
