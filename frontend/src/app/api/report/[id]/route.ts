import { NextRequest, NextResponse } from 'next/server';

const SCORING_ENGINE_URL = process.env.NEXT_PUBLIC_SCORING_ENGINE_URL || 'https://spirited-success-production-2b55.up.railway.app';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wantScores = req.nextUrl.searchParams.get('scores') !== null;

  try {
    // Always fetch full report — /scores endpoint is unreliable
    const res = await fetch(`${SCORING_ENGINE_URL}/api/v1/report/${id}`);
    if (!res.ok) {
      return NextResponse.json({ error: 'Report not found' }, { status: res.status });
    }

    const report = await res.json();

    if (wantScores) {
      // Extract scores from the full report
      const schema = report.metrics?.schema;
      const desc = report.metrics?.description;

      const schemaScore = schema
        ? Math.min(100, Math.round(
            (schema.hasSchema ? 20 : 0) +
            (schema.descriptionCoverage ?? 0) * 0.6 +
            (schema.requiredFields > 0 ? 10 : 0) +
            (schema.hasDefaults ? 5 : 0) +
            (schema.hasEnums ? 5 : 0) -
            (schema.ambiguousFieldNames?.length ?? 0) * 5 -
            (schema.issues?.length ?? 0) * 3
          ))
        : 0;

      const discoverScore = desc
        ? Math.min(100, Math.round(
            40 +
            (desc.hasActionVerb ? 20 : 0) +
            (desc.hasUseCase ? 20 : 0) +
            (desc.hasExample ? 10 : 0) +
            (desc.semanticDensity ?? 0) * 10 -
            (desc.missingElements?.length ?? 0) * 8
          ))
        : 0;

      const composite = Math.round(schemaScore * 0.5 + discoverScore * 0.5);
      const grade = composite >= 90 ? 'A' : composite >= 75 ? 'B' : composite >= 60 ? 'C' : composite >= 40 ? 'D' : 'F';

      return NextResponse.json({
        schemaHealth: { score: schemaScore },
        discoverability: { score: discoverScore },
        overall: composite,
        grade,
      });
    }

    return NextResponse.json(report);
  } catch {
    return NextResponse.json({ error: 'Scoring engine unavailable' }, { status: 502 });
  }
}
