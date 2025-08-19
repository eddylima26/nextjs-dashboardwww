// app/burn-in-rack/actions.ts
'use server';        // These functions run on the server when called via <form action={...}>
import 'server-only'; // Extra guard: never bundle this file into the client
import { notifySlack } from '@/app/lib/slack';  // You’ll need to implement this helper
import postgres from 'postgres';
import { revalidatePath } from 'next/cache';
import { differenceInSeconds, formatDuration, intervalToDuration, isAfter } from 'date-fns';

// ─────────────────────────────────────────────────────────────────────────────
// DB client: change POSTGRES_URL → DATABASE_URL here if that's what your .env uses.
// The ssl:'require' option is correct for Neon and most hosted Postgres.
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

// A TypeScript type for the rows we select (purely for editor help)
type SlotRow = {
  id: number;
  row: number;
  col: number;
  status: 'EMPTY' | 'PLACE' | 'IN_USE' | 'READY';
  ends_at: string | null; // ISO string or null
  serial_id?:string// if the slot has a serial number assigned
};
// ─────────────────────────────────────────────────────────────────────────────
// Serial normalizer
// - Accepts ANY input (scanner often sends strings; but could be number, etc.)
// - Coerces to string, trims, removes ALL whitespace, UPPERCASES.
// - Result is what we write to the DB (so uniqueness is effectively case-insensitive).
function normalizeSN(raw: unknown): string {
  // 1) coerce to string (undefined/null → ""); 2) trim ends
  const s = String(raw ?? '').trim();

  // 3) remove whitespace anywhere (spaces, tabs, newlines from scanners)
  const compact = s.replace(/\s+/g, '');

  // 4) normalize casing
  return compact.toUpperCase();
}

// Optional: format guard (tighten pattern to your needs)
// Example allows A–Z, 0–9, hyphen, underscore, dot; length 6–32.
// If you want only alphanumerics, change to /^[A-Z0-9]{6,32}$/.
const SN_REGEX = /^[A-Z0-9._-]{6,32}$/;

// Helper: assert a reasonable minutes value (1..24h by default)
function normalizeMinutes(value: unknown, max = 24 * 60): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const m = Math.trunc(n);
  if (m <= 0 || m > max) return null;
  return m;
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Assign (or move) a drone SN to a slot.
// - If the SN exists in another slot, we atomically "move" it: clear old, set new.
// - Puts the target slot into PLACE and clears any timer fields.
// - Requires nothing else; you can call this right after scanning and selecting a slot.
export async function assignToSlot(slotId: number, rawSn: unknown) {
  // Validate inputs early
  if (!Number.isInteger(slotId)) return;

  const serial_id = normalizeSN(rawSn);
  if (!serial_id) return;                         // empty after normalization → no-op
  if (!SN_REGEX.test(serial_id)) return;          // optional: reject bad formats silently (or throw)

  await sql.begin(async (tx) => {
    // 1) Lock any existing slot that already has this SN (prevents races)
    const existing = await tx/* sql */`
      SELECT id FROM public.rack_slots WHERE drone_sn = ${serial_id}  FOR UPDATE
    `;

    // 2) If another slot had this SN, clear it
    if (existing.length && existing[0].id !== slotId) {
      await tx/* sql */`
        UPDATE public.rack_slots
        SET serial_id = NULL,
            status   = 'EMPTY',
            started_at = NULL,
            burn_minutes = NULL,
            ends_at  = NULL,
            updated_at = now()
        WHERE id = ${existing[0].id}
      `;
    }

    // 3) Assign SN to the target slot and reset timers
    await tx/* sql */`
      UPDATE public.rack_slots
      SET serial_id = ${serial_id},
          status   = 'PLACE',
          started_at = NULL,
          burn_minutes = NULL,
          ends_at  = NULL,
          updated_at = now()
      WHERE id = ${slotId}
    `;
  });

  // Re-fetch data for the rack page so the UI updates
  revalidatePath('/burn-in-rack');
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Start a timer on a slot.
// - Requires that a drone is present (drone_sn IS NOT NULL), so operators don't
//   accidentally time an empty cell.
// - Sets status → IN_USE and computes ends_at once; the client shows countdown.
export async function startTimer(slotId: number, minutes: number) {
  if (!Number.isInteger(slotId)) return;

  const mins = normalizeMinutes(minutes, 24 * 60); // 1..1440 minutes (24h)
  if (mins == null) return; // invalid or out of range

  await sql/* sql */`
    UPDATE public.rack_slots
    SET status       = 'IN_USE',
        started_at   = now(),
        burn_minutes = ${mins},
        ends_at      = now() + (INTERVAL '1 minute' * ${mins}),
        updated_at   = now()
    WHERE id = ${slotId} AND serial_id IS NOT NULL
  `;

  revalidatePath('/burn-in-rack');
}

// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Clear a slot back to EMPTY.
// - Removes SN and wipes timer fields. Use when removing a unit or undoing.
export async function clearSlot(slotId: number) {
  if (!Number.isInteger(slotId)) return;

  // Get slot data, especially ends_at and serial_id
  const [slot] = await sql<SlotRow[]>/* sql */`
    SELECT ends_at, serial_id
    FROM public.rack_slots
    WHERE id = ${slotId}
  `;

  let slackMessage = '';
  const now = new Date();

  if (slot?.ends_at && slot.serial_id) {
    const endsAt = new Date(slot.ends_at);
    const remainingSec = differenceInSeconds(endsAt, now); // positive = early, negative = late

    const duration = intervalToDuration({
      start: remainingSec > 0 ? now : endsAt,
      end: remainingSec > 0 ? endsAt : now,
    });

    const pretty = formatDuration(duration);

    slackMessage = remainingSec > 0
      ? `🛩️ Drone *${slot.serial_id}* picked up *early* with ${pretty} remaining.`
      : `🛩️ Drone *${slot.serial_id}* has been successfully picked up.`;
  }

  // Clear the slot
  await sql/* sql */`
    UPDATE public.rack_slots
    SET status       = 'EMPTY',
        serial_id    = NULL,
        started_at   = NULL,
        burn_minutes = NULL,
        ends_at      = NULL,
        updated_at   = now()
    WHERE id = ${slotId}
  `;

  revalidatePath('/burn-in-rack');

  // Send Slack message
   // Notify Slack using your function
  if (slackMessage) {
    await notifySlack(slackMessage);
  }

}


// ─────────────────────────────────────────────────────────────────────────────
// ACTION: Mark READY (optional convenience).
// - Leaves timer fields as-is for quick audit. If you prefer to wipe them, add NULLs.
export async function markReady(slotId: number) {
  if (!Number.isInteger(slotId)) return;

  await sql/* sql */`
    UPDATE public.rack_slots
    SET status = 'READY',
        updated_at = now()
    WHERE id = ${slotId}
  `;

  revalidatePath('/burn-in-rack');
}

/* ─────────────────────────────────────────────────────────────────────────────
   Notes / DB hygiene (already handled in your seed, but good to keep in mind):

   1) One-slot-per-drone constraint (unique when NOT NULL):
      CREATE UNIQUE INDEX IF NOT EXISTS rack_slots_drone_sn_unique
        ON public.rack_slots (drone_sn) WHERE drone_sn IS NOT NULL;

   2) If you ever want DB-level case-insensitivity instead of uppercasing in code:
      CREATE EXTENSION IF NOT EXISTS citext;
      ALTER TABLE public.rack_slots ALTER COLUMN drone_sn TYPE citext;
      -- then keep the UNIQUE index on drone_sn (citext compares case-insensitively).

   3) Because we normalize to UPPERCASE here, the simple UNIQUE index above is enough.

   4) With the postgres npm client, keep ONE SQL statement per template literal
      (we’ve done that here). Multi-statement strings cause errors.
────────────────────────────────────────────────────────────────────────────── */
