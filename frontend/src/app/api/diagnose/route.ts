import { NextRequest, NextResponse } from 'next/server';

const SCORING_ENGINE_URL = process.env.NEXT_PUBLIC_SCORING_ENGINE_URL || 'https://spirited-success-production-2b55.up.railway.app';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const res = await fetch(`${SCORING_ENGINE_URL}/api/v1/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json(
      { error: 'Scoring engine unavailable' },
      { status: 502 }
    );
  }
}
