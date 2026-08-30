'use client';

import { Info, Settings2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export function AppMenu({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  return (
    <div ref={root} className={`relative ${compact ? '' : 'w-full'}`}>
      <button
        type="button"
        aria-label="Stacks settings and version"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className={
          compact
            ? 'grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground'
            : 'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-500 hover:bg-white/5 hover:text-slate-300'
        }
      >
        <Settings2 className="size-4" />
        {!compact && <span>Stacks {__STACKS_VERSION__}</span>}
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Stacks application menu"
          className={`absolute z-50 w-56 rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 ${compact ? 'right-0 top-full mt-1' : 'bottom-0 left-full ml-2'}`}
        >
          <p className="px-2 py-1.5 text-xs font-semibold">Stacks</p>
          <div className="my-1 h-px bg-border" />
          <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground">
            <Info className="size-4" /> Version {__STACKS_VERSION__}
          </div>
          <p className="px-2 py-2 text-xs leading-5 text-muted-foreground">
            Account and application settings will live here.
          </p>
        </div>
      )}
    </div>
  );
}
