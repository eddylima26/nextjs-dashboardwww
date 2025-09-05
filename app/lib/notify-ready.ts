import postgres from 'postgres';
import { notifySlack } from '@/app/lib/slack';

// The ssl:'require' option is correct for Neon and most hosted Postgres.
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export async function notifyReadyDrones() {
  // 1. Find expired timers still marked as IN_USE
  const expired = await sql/* sql */`
    SELECT id, serial_id, row, col
    FROM public.rack_slots
    WHERE ends_at <= now()
      AND status = 'IN_USE'
      AND serial_id IS NOT NULL
  `;

  // 2. For each expired timer, mark it as READY + send Slack message
  for (const drone of expired) {
    await sql/* sql */`
      UPDATE public.rack_slots
      SET status = 'READY',
          updated_at = now()
      WHERE id = ${drone.id}
    `;

    await notifySlack(`✅ Drone *${drone.serial_id}* is ready for pickup. (Row ${drone.row}, Column ${drone.col})`);
  }
}
