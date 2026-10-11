import { NextResponse } from "next/server";
import { listBpkCollections } from "@/lib/bpk";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const collections = await listBpkCollections();
    return NextResponse.json({ success: true, collections });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 502 });
  }
}
