// app/burn-in/SlotGrid.tsx
'use client';
// ^ This marks the file as a **Client Component**:
//   - It runs in the browser
//   - It can attach event handlers later (clicks on buttons, etc.)
//   - It receives data from the server page as props.

import type { ReactNode } from 'react';
import { clearSlot, startTimer, assignToSlot } from '@/app/burn-in-rack/actions'; // import server actions
import  useRemaining  from '@/app/burn-in-rack/useRemaining';           // ← NEW
import { formatRemaining } from './timer';

type Status = 'EMPTY' | 'PLACE' | 'IN_USE' | 'READY';

type Slot = {
  id: number;
  row: number;
  col: number;
  status: Status;
  ends_at: string | null; // We'll use this for the countdown later
  serial_id?: string; // Optional, if the slot has a serial number assigned
};

export function SlotGrid({
  slots,
  rows,
  cols,
}: {
  slots: Slot[]; // all slots we fetched on the server
  rows: number;  // max row number (from the server)
  cols: number;  // max col number (from the server)
  
}) {
    console.log('SlotGrid received slots:', slots);
  // Build a quick lookup: "r-c" → slot
  // This lets us render a *matrix* and put a placeholder where (r,c) is missing.
   // Use Map<string, Slot> to keep typing simple and avoid template-literal key issues.
  const byKey = new Map<string, Slot>(slots.map((s) => [`${s.row}-${s.col}`, s]));

  // Build the cells in row-major order so CSS grid places them correctly.
  const cells: ReactNode[] = [];
  for (let r = 1; r <= rows; r++) {
    for (let c = 1; c <= cols; c++) {
      const key = `${r}-${c}`;
      const slot = byKey.get(key);

      // If the slot exists in the DB, render it. Otherwise render a dashed placeholder box.
      cells.push(
        slot ? (
          <SlotCard key={slot.id} slot={slot} />
        ) : (
          <div
            key={`placeholder-${key}`}
            className="h-30 rounded-xl border border-dashed border-zinc-700 bg-zinc-900/50" //Grey Block
            title={`No slot at Row ${r}, Col ${c} (skipped cell)`}
          />
        )
      );
    }
  }

  // The CSS grid uses "cols" to know how many columns to draw.
  return (
  <div
    className="grid gap-3"
    style={{
      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
      transform: 'scale(0.6)',           // scales everything to 80%
      transformOrigin: 'top left',        // keeps the grid anchored to the top left
    }}
  >
    {cells}
  </div>
);
}

function SlotCard({ slot }: { slot: Slot }) {
  // Before submitting, copy the current scanned value into a hidden <input name="sn">
  function copyScanInto(form: HTMLFormElement) {
    const scan = document.getElementById('scan-sn') as HTMLInputElement | null;
    if (scan) {
      // TS-safe way to set the hidden input named "sn"
      (form.elements.namedItem('sn') as HTMLInputElement).value = scan.value;
    }
  }

  // ↓↓↓ NEW: countdown when status === 'IN_USE' and ends_at exists
  const { ms, done } = useRemaining(slot.ends_at);
  const readout =
    slot.status === 'IN_USE' && ms !== undefined
      ? formatRemaining(ms)
      : slot.status;

  return (
    <div className={['rounded-xl border-2 p-1 w-30 h-30', colorByStatus(slot.status)].join(' ')}>
      <div className="text-xs opacity-70">Row {slot.row}, Col {slot.col}</div>
      {slot.serial_id && (
        <div className="text-xs font-mono text-black-400">SN: {slot.serial_id}</div>
      )}

      {/* Status or ticking timer */}
<div className="mt-2 text-xl tabular-nums">{readout}</div>

{done && (
  <>
    {slot.status === 'READY' && (
      <div className="mt-1 text-xs text-emerald-400">
        Ready — mark Clear when checked
      </div>
    )}
    {slot.status === 'IN_USE' && (
      <div className="mt-1 text-xs text-emerald-400">
        Done — mark READY when checked
      </div>
    )}
  </>
)}


      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {/* ASSIGN HERE — pulls value from #scan-sn and sends to server */}
        <form
          action={async (fd) => {
            const sn = String(fd.get('sn') ?? '');
            await assignToSlot(slot.id, sn);      // server action will normalize & save
          }}
          onSubmit={(e) => copyScanInto(e.currentTarget)}  // copy from the top input
        >
          {/* Hidden field to carry the SN into the server action */}
          <input type="hidden" name="sn" />
          <button type="submit" className="rounded bg-sky-600 px-3 py-1 text-white">
            Assign here
          </button>
        </form>

        {/* Start fixed 50m timer (you can change 50 to any number) */}
        <form action={startTimer.bind(null, slot.id, 1)}>
          <button type="submit" className="rounded bg-amber-600 px-3 py-1 text-white">
            Start 24h
          </button>
        </form>

        {/* Clear slot */}
        <form action={clearSlot.bind(null, slot.id)}>
          <button type="submit" className="rounded bg-zinc-700 px-3 py-1 text-white">
            Clear
          </button>
        </form>
      </div>
    </div>
  );
}


function labelFor(s: Status) {
  switch (s) {
    case 'EMPTY': return 'EMPTY';
    case 'PLACE': return 'PLACE';
    case 'IN_USE': return 'IN USE';   // timer will replace this in the next step
    case 'READY': return 'READY';
  }
}

function colorByStatus(s: Status) {
  // Simple Tailwind colors so you can distinguish states at a glance.
  switch (s) {
    case 'EMPTY': return 'border-zinc-700 bg-zinc-900 text-zinc-200';
    case 'PLACE': return 'border-amber-400 bg-amber-400 text-black-300';
    case 'IN_USE': return 'border-red-400 bg-red-400 text-black-300';
    case 'READY': return 'border-emerald-500 bg-emerald-500 text-black-300';
  }
}
