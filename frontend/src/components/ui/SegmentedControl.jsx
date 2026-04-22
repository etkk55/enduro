// Segmented Control stile iOS — pill orizzontale con sfondo animato sotto l'opzione selezionata
// Uso:
//   <SegmentedControl value={classe} onChange={setClasse} options={[{value:'',label:'Tutti'},{value:'major',label:'Major'}]}/>
// Per multiSelect: value è un array, onChange riceve array.

import { useRef, useEffect, useState } from 'react';

export default function SegmentedControl({ options, value, onChange, multiSelect = false, size = 'md', className = '' }) {
  const containerRef = useRef(null);
  const [indicator, setIndicator] = useState(null); // { left, width }

  const isSelected = (v) => multiSelect ? (Array.isArray(value) && value.includes(v)) : value === v;

  useEffect(() => {
    if (multiSelect || !containerRef.current) return;
    const idx = options.findIndex(o => o.value === value);
    if (idx < 0) { setIndicator(null); return; }
    const btn = containerRef.current.querySelectorAll('button[data-seg]')[idx];
    if (!btn) return;
    setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [value, options, multiSelect]);

  const handleClick = (v) => {
    if (multiSelect) {
      const arr = Array.isArray(value) ? [...value] : [];
      const i = arr.indexOf(v);
      if (i >= 0) arr.splice(i, 1); else arr.push(v);
      onChange(arr);
    } else {
      onChange(v);
    }
  };

  const sizes = {
    sm: 'h-8 text-xs p-0.5',
    md: 'h-9 text-sm p-1',
    lg: 'h-10 text-sm p-1',
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center bg-surface-2 border border-border-subtle rounded-lg ${sizes[size] || sizes.md} ${className}`}
      role={multiSelect ? 'group' : 'tablist'}
    >
      {!multiSelect && indicator && (
        <div
          className="absolute top-1 bottom-1 rounded-md bg-surface shadow-sm transition-all duration-200 ease-out pointer-events-none"
          style={{ left: indicator.left, width: indicator.width }}
          aria-hidden="true"
        />
      )}
      {options.map(opt => {
        const selected = isSelected(opt.value);
        return (
          <button
            key={String(opt.value)}
            data-seg
            type="button"
            onClick={() => handleClick(opt.value)}
            aria-pressed={selected}
            className={`relative z-[1] px-3 font-medium whitespace-nowrap rounded-md transition-colors ${
              selected
                ? 'text-content-primary' + (multiSelect ? ' bg-surface shadow-sm' : '')
                : 'text-content-tertiary hover:text-content-secondary'
            }`}
          >
            {opt.icon ? <span className="mr-1">{opt.icon}</span> : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
