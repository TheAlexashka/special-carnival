import { NextRequest, NextResponse } from "next/server";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const target = searchParams.get("url");
    const download = searchParams.get("download") === "1";
    const filename = searchParams.get("filename") || "bpk-preview.jpg";

    if (!target) return new NextResponse("Missing url", { status: 400 });

    const parsed = new URL(target);
    if (parsed.hostname !== "bpk-fotoarchiv.de" || !parsed.pathname.startsWith("/bs/api/assets:media:")) {
      return new NextResponse("Domain not allowed", { status: 403 });
    }

    const res = await fetch(target, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        "Accept-Language": "de-DE,de;q=0.9",
        "Accept-Encoding": "identity",
        Referer: "https://bpk-fotoarchiv.de/",
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "same-origin",
      },
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) return new NextResponse(`bpk вернул HTTP ${res.status}`, { status: 502 });

    const buffer = await res.arrayBuffer();
    const encoded = encodeURIComponent(filename);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": res.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=86400",
        ...(download
          ? {
              "Content-Disposition": `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`,
            }
          : {}),
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return new NextResponse(`bpk недоступен: ${error}`, { status: 502 });
  }
}
