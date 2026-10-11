import { NextRequest, NextResponse } from "next/server";
import { getInvaluableLot } from "@/lib/invaluable";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ ref: string }> }) {
  const { ref } = await context.params;
  try {
    const lot = await getInvaluableLot(decodeURIComponent(ref));
    return NextResponse.json({ success: true, lot });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}
