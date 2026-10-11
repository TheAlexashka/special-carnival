import { NextRequest, NextResponse } from "next/server";
import { getDdbItem } from "@/lib/ddb";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const item = await getDdbItem(id);
    return NextResponse.json({ success: true, item });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}
