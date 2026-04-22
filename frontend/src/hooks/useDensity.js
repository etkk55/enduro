import { useEffect, useState, useCallback } from 'react';

const KEY = 'enduro_ui_density';
const VALUES = ['comfortable', 'compact', 'dense'];

export function useDensity() {
  const [density, setDensity] = useState(() => {
    if (typeof window === 'undefined') return 'comfortable';
    const v = localStorage.getItem(KEY);
    return VALUES.includes(v) ? v : 'comfortable';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    localStorage.setItem(KEY, density);
  }, [density]);

  const cycle = useCallback(() => {
    setDensity(d => VALUES[(VALUES.indexOf(d) + 1) % VALUES.length]);
  }, []);

  return { density, setDensity, cycle };
}
