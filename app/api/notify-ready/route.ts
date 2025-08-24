// app/api/notify-ready/route.ts
import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { notifySlack } from '@/app/lib/slack';

export const runtime = 'nodejs';
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

type Row = { serial_id: string | null };

export async function GET() {
  // Step 1: flip IN_USE → READY if timer done
  await sql/* sql */`
    UPDATE public.rack_slots
    SET status = 'READY', updated_at = now()
    WHERE status = 'IN_USE'
      AND ends_at IS NOT NULL
      AND ends_at <= now()
  `;

  // Step 2: notify READY rows not yet notified
  const rows = await sql<Row[]>/* sql */`
    UPDATE public.rack_slots
    SET notified_at = now(), updated_at = now()
    WHERE status = 'READY'
      AND ends_at IS NOT NULL
      AND ends_at <= now()
      AND notified_at IS NULL
    RETURNING serial_id
  `;

  for (const row of rows) {
    if (row.serial_id) {
      await notifySlack(`🛩️ Drone *${row.serial_id}* completed burn-in and is READY for pickup.`);
    }
  }

  return NextResponse.json({ checked: rows.length });
}
