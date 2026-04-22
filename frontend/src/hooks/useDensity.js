import { useEffect, useState, useCallback } from 'react';

const KEY = 'enduro_ui_density';
// 5 livelli ordinati dal piu' grande al piu' denso
const VALUES = ['xxl', 'xl', 'lg', 'md', 'sm'];

export function useDensity() {
  const [density, setDensity] = useState(() => {
    if (typeof window === 'undefined') return 'xxl';
    const v = localStorage.getItem(KEY);
    return VALUES.includes(v) ? v : 'xxl';
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
