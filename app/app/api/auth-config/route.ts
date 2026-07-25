import { NextResponse } from 'next/server';

// Which optional sign-in methods are live, decided by RUNTIME env — Fly
// secrets flip features without a rebuild (NEXT_PUBLIC_* build args can't).
// The login page asks this to know whether to draw the Google button.
export async function GET() {
  return NextResponse.json({
    google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
}
