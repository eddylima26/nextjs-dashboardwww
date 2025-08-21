// app/api/notify-ready/route.ts
import { NextResponse } from 'next/server';
import postgres from 'postgres';
import { notifySlack } from '@/app/lib/slack';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function GET() {
  const rows = await sql/* sql */`
    UPDATE public.rack_slots
    SET status = 'READY', updated_at = now()
    WHERE ends_at < now()
      AND status = 'IN_USE'
    RETURNING serial_id
  `;

  for (const row of rows) {
    if (row.serial_id) {
      await notifySlack(`🛩️ Drone *${row.serial_id}* completed burn-in and is READY for pickup.`);
    }
  }

  return NextResponse.json({ checked: rows.length });
}
