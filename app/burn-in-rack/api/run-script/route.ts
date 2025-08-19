// app/api/run-script/route.ts
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function GET() {
  const scriptPath = path.resolve(process.cwd(), 'app/run-python/hello_timer.py');

  return new Promise((resolve) => {
    exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error('Execution error:', error);
        return resolve(NextResponse.json({ error: error.message }, { status: 500 }));
      }

      if (stderr) {
        console.error('stderr:', stderr);
      }

      resolve(NextResponse.json({ output: stdout }));
    });
  });
}
