import { useEffect, useRef } from 'react';

// Ritorna il valore precedente di una variabile reattiva
export function usePrevious(value) {
  const ref = useRef();
  useEffect(() => { ref.current = value; }, [value]);
  return ref.current;
}
