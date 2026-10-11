import { NextRequest, NextResponse } from "next/server";
import { getRctObject } from "@/lib/rct";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const object = await getRctObject(decodeURIComponent(id));
    return NextResponse.json({ success: true, object });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}
