/*import AcmeLogo from '@/app/ui/acme-logo';
import { ArrowRightIcon } from '@heroicons/react/24/outline';
import Link from 'next/link';
import styles from '@/app/ui/home.module.css';
import { lusitana } from '@/app/ui/fonts';
import Image from 'next/image';

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col p-6">
      <div className={styles.shape} />
      <div className="flex h-20 shrink-0 items-end rounded-lg bg-green-500 p-4 md:h-52">
        { <AcmeLogo /> }
      </div>
      <div className="mt-4 flex grow flex-col gap-4 md:flex-row">
        <div className="flex flex-col justify-center gap-6 rounded-lg bg-gray-50 px-6 py-10 md:w-2/5 md:px-20">
          <p className={` ${lusitana.className} text-xl text-gray-800 md:text-3xl md:leading-normal`}>
            <strong>Welcome to Acme.</strong> This is the example for the{' '}
            <a href="https://nextjs.org/learn/" className="text-green-500">
              Next.js Learn Course
            </a>
            , brought to you by Vercel.
          </p>
          <Link
            href="/login"
            className="flex items-center gap-5 self-start rounded-lg bg-green-500 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-400 md:text-base"
          >
            <span>Log in</span> <ArrowRightIcon className="w-5 md:w-6" />
          </Link>
        </div>
        <div className="flex items-center justify-center p-6 md:w-3/5 md:px-28 md:py-12">
          {/* Add Hero Images Here *//*}/*
          /*   <Image
              src="/hero-desktop.png"
              width={1000}
              height={760}
              className="hidden md:block"
              alt="Screenshots of the dashboard project showing desktop version"
            />
          {/* Add Hero Images Here *//*}
            <Image
              src="/hero-mobile.png"
              width={560}
              height={620}
              className="block md:hidden"
              alt="Screenshots of the dashboard project showing mobile version"
            />
        </div>
      </div>
    </main>
  );
}*/


// app/burn-in/page.tsx
// This is a **server component** (default in the App Router).
// It runs on the server, talks to Postgres, and sends plain data to a client component to render.

import postgres from 'postgres';      // the 'postgres' client you're already using
import { SlotGrid } from '@/app/burn-in-rack/SlotGrid'; // we'll create this next (a client component)
import  ScanBox  from '@/app/burn-in-rack/ScanBox'; // a client component for scanning serial numbers
import { lusitana } from '@/app/ui/fonts'; // import the Roboto font

// Create one DB client for this file. It uses POSTGRES_URL from .env.local.
// If your env var is DATABASE_URL instead, change it here to match.
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

export default async function BurnInPage() {
  // 1) Read all slots from the DB, ordered exactly like a grid (row 1..N, col 1..M).
  const slots = await sql<SlotRow[]>/* sql */`
    SELECT id, row, col, status, ends_at, serial_id
    FROM public.rack_slots
    ORDER BY row, col
  `;
  console.log('Fetched slots:', slots); // Debugging: log the fetched slots

  // 2) Detect how big the grid is (so the UI matches whatever you seeded).
  const maxRow = slots.reduce((m, s) => Math.max(m, s.row), 0);
  const maxCol = slots.reduce((m, s) => Math.max(m, s.col), 0);

  // 3) Render a simple page with a title and the visual grid.
  //    Note: <SlotGrid> is a **client** component; it only receives plain data (no DB client).
  return (
    <div className="relative min-h-screen w-full">
      {/* 🔹 Background image */}
     <div className="fixed inset-0 -z-10 h-full min-h-screen w-full bg-[url('/Pattern.png')] bg-cover bg-center bg-no-repeat" />

      {/* 🔹 Main content layered on top */}
      <main className={`mx-auto max-w-6xl p-6 space-y-6 ${lusitana.className} antialiased`}>
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-black text-white px-2 py-1 rounded">
              Burn-In Rack (3×5)
            </h1>
            <img
              src="/drone.webp"
              alt="Drone"
              className="absolute top-4 right-4 w-20 h-auto z-10 opacity-90"
            />


            <ScanBox />
            <p className="text-sm text-zinc-500">
              Read-only for now (visuals first). We’ll wire buttons next.
            </p>
          </div>
        </header>
        <SlotGrid slots={slots} rows={maxRow} cols={maxCol} />
      </main>
    </div>
  );
}
