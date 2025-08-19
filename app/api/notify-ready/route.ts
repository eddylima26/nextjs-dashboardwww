// app/api/notify-ready/route.ts
import { notifyReadyDrones } from '@/app/lib/notify-ready';

export async function GET() {
  await notifyReadyDrones();
  return new Response('Ready drones notified.');
}
