// app/seed/route.ts
import postgres from 'postgres';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// If your env var is DATABASE_URL, change POSTGRES_URL below to DATABASE_URL.
const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

/**
 * >>> EDIT THESE TO RESHAPE THE GRID <<<
 * 8 rows × 4 cols, but SKIP the cell at (row=1, col=4)
 */
const ROWS = 8;
const COLS = 4;
const SKIP: Array<[number, number]> = [[1, 4]];

/**
 * Build a WHERE clause that excludes skipped cells, e.g.:
 *   NOT (r=1 AND c=4) AND NOT (r=3 AND c=2)
 */
const skipClause =
  SKIP.length > 0
    ? SKIP.map(([r, c]) => `NOT (r=${r} AND c=${c})`).join(' AND ')
    : '1=1';

export async function GET() {
  // Safety: never seed in production
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  try {
    // --- one statement per call (postgres library requirement) ---

    // 1) Create enum (idempotent)
    await sql/* sql */`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rack_status') THEN
          CREATE TYPE rack_status AS ENUM ('EMPTY','PLACE','IN_USE','READY');
        END IF;
      END$$;
    `;

    // 2) Create table (idempotent)
    await sql/* sql */`
      CREATE TABLE IF NOT EXISTS public.rack_slots (
        id           SERIAL PRIMARY KEY,
        row          INT NOT NULL,
        col          INT NOT NULL,
        status       rack_status NOT NULL DEFAULT 'EMPTY',
        drone_sn     VARCHAR(32),

        -- timer fields:
        started_at   TIMESTAMPTZ,
        burn_minutes INT,
        ends_at      TIMESTAMPTZ,

        updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT rack_slots_row_col_unique UNIQUE (row, col)
      );
    `;

    // 3) Unique index so one SN can’t be in two slots
    await sql/* sql */`
      CREATE UNIQUE INDEX IF NOT EXISTS rack_slots_drone_sn_unique
      ON public.rack_slots (drone_sn) WHERE drone_sn IS NOT NULL;
    `;

    // 4) Exact reshape inside a transaction:
    await sql.begin(async (tx) => {
      // 4A) DELETE any rows not in our filtered grid (respects SKIP)
      await tx/* sql */`
        WITH grid AS (
          SELECT r, c
          FROM generate_series(1, ${ROWS}) AS r,
               generate_series(1, ${COLS}) AS c
          WHERE ${sql.unsafe(skipClause)}
        )
        DELETE FROM public.rack_slots rs
        WHERE NOT EXISTS (
          SELECT 1 FROM grid g WHERE g.r = rs.row AND g.c = rs.col
        );
      `;

      // 4B) INSERT/RESET rows that are in the filtered grid (respects SKIP)
      await tx/* sql */`
        WITH grid AS (
          SELECT r, c
          FROM generate_series(1, ${ROWS}) AS r,
               generate_series(1, ${COLS}) AS c
          WHERE ${sql.unsafe(skipClause)}
        )
        INSERT INTO public.rack_slots (row, col)
        SELECT r, c FROM grid
        ON CONFLICT (row, col) DO UPDATE SET
          status       = 'EMPTY',
          drone_sn     = NULL,
          started_at   = NULL,
          burn_minutes = NULL,
          ends_at      = NULL,
          updated_at   = now();
      `;
    });

    // 5) Return a summary
    const [count] = await sql<{ n: number }[]>`
      SELECT COUNT(*)::int AS n FROM public.rack_slots
    `;

    return NextResponse.json({
      ok: true,
      rows: ROWS,
      cols: COLS,
      skipped: SKIP,
      totalSlots: count.n, // expect 8*4 - 1 = 31
    });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: String(err?.message ?? err) }, { status: 500 });
  }
}
