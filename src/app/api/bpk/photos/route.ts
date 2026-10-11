import { NextRequest, NextResponse } from "next/server";
import { getBpkPhotos } from "@/lib/bpk";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ success: false, error: "Не указан портфель" }, { status: 400 });
  }

  try {
    const data = await getBpkPhotos(slug);
    return NextResponse.json({ success: true, ...data });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}
