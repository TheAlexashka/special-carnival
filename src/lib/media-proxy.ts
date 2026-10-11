import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Общий SSRF-безопасный прокси публичных медиа (DDB / Europeana).
 *
 * Культурные источники разбросаны по сотням доменов учреждений, поэтому
 * вместо бесконечного allowlist проверяем: публичный адрес, image/pdf тип
 * контента и разумный лимит размера.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_BYTES = 40 * 1024 * 1024;

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 0) return true;
  const parts = address.split(".").map(Number);
  if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
    const [a, b] = parts;
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    return false;
  }
  const lower = address.toLowerCase();
  if (lower.startsWith("::1") || lower.startsWith("fe80") || lower.startsWith("fc") || lower.startsWith("fd")) {
    return true;
  }
  if (lower.includes("::ffff:")) {
    const mapped = lower.split("::ffff:")[1];
    if (mapped) return isPrivateAddress(mapped);
  }
  return false;
}

async function isPublicHost(hostname: string): Promise<boolean> {
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local")) return false;
  if (isIP(hostname)) return !isPrivateAddress(hostname);
  try {
    const records = await lookup(hostname, { all: true });
    if (!records.length) return false;
    return records.every((record) => !isPrivateAddress(record.address));
  } catch {
    return false;
  }
}

/** Подписи форматов, которые браузер умеет показывать в <img>. */
function sniffFormat(bytes: Uint8Array): "jpg" | "png" | "gif" | "webp" | "avif" | "pdf" | "tiff" | null {
  const b = bytes;
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "gif";
  if (
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50
  ) {
    return "webp";
  }
  // ISO-BMFF: ftypavif
  if (
    b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70 &&
    b[8] === 0x61 && b[9] === 0x76
  ) {
    return "avif";
  }
  if (b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "pdf";
  if (
    (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) ||
    (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00)
  ) {
    return "tiff";
  }
  return null;
}

export async function proxyPublicMedia(
  req: NextRequest,
  options: { defaultReferer: string; filenamePrefix: string }
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("url");
    const fallbackRaw = searchParams.get("fallback");
    const download = searchParams.get("download") === "1";

    if (!raw) return new NextResponse("Missing url", { status: 400 });

    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      return new NextResponse("Bad url", { status: 400 });
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return new NextResponse("Protocol not allowed", { status: 400 });
    }
    // Referer по умолчанию — сам источник: многие музеи не отдают файл
    // при стороннем Referer.
    const referer = searchParams.get("referer") || `${parsed.protocol}//${parsed.host}/`;
    if (!(await isPublicHost(parsed.hostname))) {
      return new NextResponse("Host not allowed", { status: 403 });
    }
    // Запасной адрес (напр. IIIF-копия DDB): пробуем, если основной источник отказал.
    let fallback: URL | null = null;
    if (fallbackRaw) {
      try {
        const candidate = new URL(fallbackRaw);
        if (
          (candidate.protocol === "https:" || candidate.protocol === "http:") &&
          (await isPublicHost(candidate.hostname))
        ) {
          fallback = candidate;
        }
      } catch {
        // битый fallback игнорируем — пробуем основной адрес
      }
    }

    const load = (target: URL) =>
      fetch(target.toString(), {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,application/pdf,*/*;q=0.5",
          "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8",
          "Accept-Encoding": "identity",
          // Многие музеи отдают файл только при Referer со своего домена.
          Referer: referer,
        },
        redirect: "follow",
        signal: AbortSignal.timeout(30000),
      });

    let res: Response;
    try {
      res = await load(parsed);
      if (!res.ok && fallback) {
        await res.body?.cancel().catch(() => undefined);
        res = await load(fallback);
      }
    } catch (err) {
      if (!fallback) throw err;
      res = await load(fallback);
    }

    if (!res.ok) {
      return new NextResponse(`Источник вернул HTTP ${res.status}`, { status: 502 });
    }

    const contentType = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const isImage = contentType.startsWith("image/");
    const isPdf = contentType === "application/pdf" || contentType === "application/octet-stream";
    if (!isImage && !isPdf) {
      return new NextResponse("Источник отдал не изображение", { status: 502 });
    }

    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BYTES) {
      return new NextResponse("Файл слишком большой для прокси", { status: 413 });
    }

    const buffer = await res.arrayBuffer();
    if (buffer.byteLength > MAX_BYTES) {
      return new NextResponse("Файл слишком большой для прокси", { status: 413 });
    }

    // Проверяем реальные байты: часть учреждений отдаёт TIFF (браузер его в
    // <img> не покажет) или HTML-заглушку с заголовком image/*. Такое мы
    // отклоняем, чтобы в интерфейсе не появлялись битые картинки.
    const format = sniffFormat(new Uint8Array(buffer));
    if (!format) {
      return new NextResponse("Источник отдал неподдерживаемый формат", { status: 502 });
    }

    const filename = `${options.filenamePrefix}.${format}`;

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          format === "pdf"
            ? "application/pdf"
            : `image/${format === "jpg" ? "jpeg" : format}`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "public, max-age=86400",
        ...(download ? { "Content-Disposition": `attachment; filename="${filename}"` } : {}),
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return new NextResponse(`Не удалось получить файл: ${error}`, { status: 502 });
  }
}
