// app/burn-in-rack/ScanBox.tsx
'use client';
import type React from 'react';

export default function ScanBox() {
  // Keep the DOM value clean on every input (covers typing, paste, scanner)
  const handleInput: React.FormEventHandler<HTMLInputElement> = (e) => {
    const input = e.currentTarget;
    const cleaned = input.value
      .toUpperCase()            // normalize case
      .replace(/[^A-Z0-9]/g, '') // drop non-alphanumerics
      .slice(0, 11);             // hard length cap
    if (cleaned !== input.value) input.value = cleaned;
  };

  // Prevent invalid characters before they land (where supported)
  const handleBeforeInput: React.FormEventHandler<HTMLInputElement> = (e) => {
    const ne = e.nativeEvent as InputEvent; // DOM InputEvent
    const char = ne?.data;
    if (typeof char === 'string' && /[^a-zA-Z0-9]/.test(char)) {
      e.preventDefault();
    }
  };

  // Extra belt-and-suspenders for paste events
  const handlePaste: React.ClipboardEventHandler<HTMLInputElement> = (e) => {
    const pasted = e.clipboardData.getData('text');
    if (/[^a-zA-Z0-9]/.test(pasted) || pasted.length > 11) {
      e.preventDefault();
      const cleaned = pasted.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11);
      const target = e.currentTarget;
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      target.setRangeText(cleaned, start, end, 'end');
    }
  };

  return (
    <div className="mb-4">
      <label htmlFor="scan-sn" className="block text-sm text-zinc-400 mb-1">
        Scan or type Serial Number
      </label>

      <input
        id="scan-sn"
        placeholder="e.g. M2300000W93"
        aria-label="Serial number"
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoCapitalize="characters"
        inputMode="text"             // keep letters+numbers keyboard on mobile
        maxLength={11}               // hard cap
        pattern="[A-Za-z0-9]{1,11}"  // native validation on submit
        title="Only letters and numbers, up to 11 characters"
        className="w-80 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"
        onInput={handleInput}
        onBeforeInput={handleBeforeInput}
        onPaste={handlePaste}
      />

      <p className="mt-1 text-xs text-zinc-500">
        Only letters &amp; numbers, max 11 characters.
      </p>
    </div>
  );
}

