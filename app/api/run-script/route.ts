// app/api/run-script/route.ts
import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import path from 'path';

export async function POST() {
  const scriptPath = path.join(process.cwd(), 'app', 'run-python', 'hello_timer.py');

  return new Promise((resolve) => {
    exec(`python3 ${scriptPath}`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return resolve(NextResponse.json({ success: false, error: error.message }));
      }

      if (stderr) {
        console.warn(`stderr: ${stderr}`);
      }

      console.log(`stdout: ${stdout}`);
      resolve(NextResponse.json({ success: true, output: stdout }));
    });
  });
}
