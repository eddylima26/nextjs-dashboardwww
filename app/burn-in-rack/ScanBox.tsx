// app/burn-in-rack/ScanBox.tsx
'use client';

/**
 * A single input the barcode scanner types into.
 * We give it a fixed id so other forms can read its current value.
 */
// app/burn-in-rack/ScanHeader.tsx (or ScanBox.tsx)
'use client';

export default function ScanBox() {
  return (
    <div className="mb-4">
      <label htmlFor="scan-sn" className="block text-sm text-zinc-400 mb-1">
        Scan or type Serial Number
      </label>

      <input
        id="scan-sn"
        placeholder="e.g. M2300000W93"
        autoFocus
        // UX hints:
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoCapitalize="characters"
        inputMode="text"                // keep letters+numbers keyboard on mobile
        maxLength={11}                  // hard cap
        pattern="[A-Za-z0-9]{1,11}"     // for native validation on submit
        title="Only letters and numbers, up to 11 characters"
        className="w-80 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100"

        // Hard sanitization: enforce uppercase A–Z and 0–9 only.
        onInput={(e) => {
          const input = e.currentTarget;
          const cleaned = input.value
            .toUpperCase()          // normalize case
            .replace(/[^A-Z0-9]/g, '')  // drop non-alphanumerics
            .slice(0, 11);          // enforce length
          if (cleaned !== input.value) input.value = cleaned;
        }}

        // (Optional) Prevent invalid characters before they land (modern browsers)
        onBeforeInput={(e: any) => {
          if (typeof e.data === 'string' && /[^a-zA-Z0-9]/.test(e.data)) {
            e.preventDefault();
          }
        }}
      />

      <p className="mt-1 text-xs text-zinc-500">
        Only letters & numbers, max 11 characters.
      </p>
    </div>
  );
}
