import { NextRequest, NextResponse } from 'next/server';

const SCORING_ENGINE_URL = process.env.NEXT_PUBLIC_SCORING_ENGINE_URL || 'https://spirited-success-production-2b55.up.railway.app';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = req.nextUrl;
  const path = url.searchParams.get('scores') !== null
    ? `${SCORING_ENGINE_URL}/api/v1/report/${id}/scores`
    : `${SCORING_ENGINE_URL}/api/v1/report/${id}`;

  try {
    const res = await fetch(path);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: 'Scoring engine unavailable' }, { status: 502 });
  }
}
