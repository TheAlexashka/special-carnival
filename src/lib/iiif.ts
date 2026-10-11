import type { BookMetadata, PageInfo } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_PAGES = 1200;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/[\\/:*?"<>|]/g, "_")
    .trim()
    .slice(0, 180);
}

/** IIIF label can be a string, array, language-map (v3) or {"@value"} (v2). */
function readLabel(label: unknown): string | undefined {
  if (!label) return undefined;
  if (typeof label === "string") return label;
  if (Array.isArray(label)) {
    for (const item of label) {
      const v = readLabel(item);
      if (v) return v;
    }
    return undefined;
  }
  if (typeof label === "object") {
    const obj = label as Record<string, unknown>;
    if (typeof obj["@value"] === "string") return obj["@value"] as string;
    // v3 language map: { "de": ["..."], "none": ["..."] }
    const preferred = ["ru", "en", "de", "fr", "it", "la", "none"];
    const keys = [...preferred.filter((k) => k in obj), ...Object.keys(obj)];
    for (const k of keys) {
      const v = readLabel(obj[k]);
      if (v) return v;
    }
  }
  return undefined;
}

/** Pull a named value out of IIIF metadata[] pairs. */
function readMetadataField(metadata: unknown, names: string[]): string | undefined {
  if (!Array.isArray(metadata)) return undefined;
  const wanted = names.map((n) => n.toLowerCase());
  for (const entry of metadata) {
    if (!entry || typeof entry !== "object") continue;
    const pair = entry as { label?: unknown; value?: unknown };
    const label = readLabel(pair.label)?.toLowerCase();
    if (label && wanted.some((w) => label.includes(w))) {
      const value = readLabel(pair.value);
      if (value) return value.replace(/<[^>]+>/g, "").trim();
    }
  }
  return undefined;
}

/** Build a IIIF Image API URL at a given width. */
function imageApiUrl(serviceId: string, width: number | "full"): string {
  const base = serviceId.replace(/\/$/, "");
  const size = width === "full" ? "full" : `${width},`;
  return `${base}/full/${size}/0/default.jpg`;
}

function isIiifImageService(profile: unknown): boolean {
  const text = JSON.stringify(profile ?? "").toLowerCase();
  return (
    text.includes("iiif.io/api/image") ||
    text.includes("level0") ||
    text.includes("level1") ||
    text.includes("level2")
  );
}

/* ------------------------------------------------------------------ */
/* Manifest discovery                                                   */
/* ------------------------------------------------------------------ */

/** Known shortcuts: turn a human page URL into its IIIF manifest URL. */
export function guessManifestUrl(rawUrl: string): string | null {
  const url = rawUrl.trim();

  // Already a manifest
  if (/\/manifest(\.json)?(\?|$)/i.test(url) || /\/iiif\/.*\/manifest/i.test(url)) {
    return url;
  }

  // Münchener DigitalisierungsZentrum (MDZ) — bsbXXXXXXXX
  const bsb = url.match(/bsb(\d{8,})/i);
  if (/digitale-sammlungen\.de/i.test(url) && bsb) {
    return `https://api.digitale-sammlungen.de/iiif/presentation/v2/bsb${bsb[1]}/manifest`;
  }

  // Gallica (BnF) — ark:/12148/btv1b...
  const ark = url.match(/ark:\/([^/\s?#]+)\/([^/\s?#]+)/i);
  if (/gallica\.bnf\.fr/i.test(url) && ark) {
    return `https://gallica.bnf.fr/iiif/ark:/${ark[1]}/${ark[2]}/manifest.json`;
  }

  // e-codices. Ссылки бывают двух видов, и оба ведут к одному манифесту:
  //   /en/csg/0390/...            → csg-0390
  //   /en/list/one/csg/0390       → csg-0390 (служебные list/one/thumbs пропускаем)
  const ecod = url.match(
    /e-codices\.unifr\.ch\/(?:[a-z]{2}\/)?(?:list\/one\/|thumbs\/|searchresult\/list\/one\/)?([a-z]{2,8})\/([0-9a-z_-]+)/i
  );
  if (ecod && !/^(list|one|thumbs|metadata|search|searchresult|about|loris)$/i.test(ecod[1])) {
    return `https://www.e-codices.unifr.ch/metadata/iiif/${ecod[1].toLowerCase()}-${ecod[2]}/manifest.json`;
  }

  // Wellcome Collection
  const wellcome = url.match(/wellcomecollection\.org\/works\/([a-z0-9]+)/i);
  if (wellcome) {
    return `https://iiif.wellcomecollection.org/presentation/v3/${wellcome[1]}`;
  }

  // ONB — Österreichische Nationalbibliothek: viewer.onb.ac.at/{id}.
  // Манифесты отдаёт открытый IIIF Presentation v3 API (адрес объявлен
  // в window.ENV_VARS на самом сайте).
  const onb = url.match(/^(?:https?:\/\/)?(?:viewer|api)\.onb\.ac\.at\/(?:viewer\/image\/)?([A-Za-z0-9]+)/i);
  if (onb) {
    return `https://api.onb.ac.at/iiif/presentation/v3/manifest/${onb[1]}`;
  }

  // Internet Culturale / Biblioteca Digitale and generic "manifest=" params
  const param = url.match(/[?&](manifest|iiif-content)=([^&]+)/i);
  if (param) {
    try {
      return decodeURIComponent(param[2]);
    } catch {
      return param[2];
    }
  }

  return null;
}

/** Scrape an HTML page for an embedded IIIF manifest link. */
export async function discoverManifestInHtml(pageUrl: string): Promise<string | null> {
  let html: string;
  try {
    const res = await fetch(pageUrl, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "";
    if (!type.includes("html")) return null;
    html = await res.text();
  } catch {
    return null;
  }

  const patterns: RegExp[] = [
    // <link rel="manifest" type="application/ld+json" href="...">
    /<link[^>]+rel=["'](?:manifest|iiif-manifest)["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:manifest|iiif-manifest)["']/i,
    // data attributes used by Mirador / UV embeds
    /data-(?:iiif-)?manifest(?:-url)?=["']([^"']+)["']/i,
    // inline JS: manifest: "https://..." / manifestUri / "@id": ".../manifest"
    /["'](?:manifest|manifestUri|manifestUrl)["']\s*[:=]\s*["']([^"']+manifest[^"']*)["']/i,
    /(https?:\/\/[^\s"'<>]+\/manifest(?:\.json)?)/i,
    /(https?:\/\/[^\s"'<>]*\/iiif\/[^\s"'<>]+)/i,
  ];

  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) {
      try {
        return new URL(m[1], pageUrl).toString();
      } catch {
        continue;
      }
    }
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* Manifest parsing (Presentation API v2 + v3)                          */
/* ------------------------------------------------------------------ */

interface CanvasImage {
  serviceId?: string;
  directUrl?: string;
  width?: number;
  height?: number;
  label?: string;
}

function parseV2Canvases(manifest: Record<string, unknown>): CanvasImage[] {
  const out: CanvasImage[] = [];
  const sequences = manifest.sequences as Array<Record<string, unknown>> | undefined;
  const canvases = (sequences?.[0]?.canvases as Array<Record<string, unknown>>) || [];

  for (const canvas of canvases) {
    const images = canvas.images as Array<Record<string, unknown>> | undefined;
    const resource = images?.[0]?.resource as Record<string, unknown> | undefined;
    if (!resource) continue;

    const service = resource.service as Record<string, unknown> | undefined;
    const serviceId =
      (typeof service?.["@id"] === "string" && isIiifImageService(service.profile)
        ? (service["@id"] as string)
        : undefined) ||
      (typeof service?.["@id"] === "string" ? (service["@id"] as string) : undefined);

    out.push({
      serviceId,
      directUrl: typeof resource["@id"] === "string" ? (resource["@id"] as string) : undefined,
      width: typeof canvas.width === "number" ? canvas.width : undefined,
      height: typeof canvas.height === "number" ? canvas.height : undefined,
      label: readLabel(canvas.label),
    });
  }
  return out;
}

function parseV3Canvases(manifest: Record<string, unknown>): CanvasImage[] {
  const out: CanvasImage[] = [];
  const items = manifest.items as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(items)) return out;

  for (const canvas of items) {
    if (canvas.type !== "Canvas" && canvas["@type"] !== "sc:Canvas") continue;
    const annoPages = canvas.items as Array<Record<string, unknown>> | undefined;
    const annos = annoPages?.[0]?.items as Array<Record<string, unknown>> | undefined;
    const body = annos?.[0]?.body as Record<string, unknown> | undefined;
    if (!body) continue;

    const services = (body.service as Array<Record<string, unknown>>) || [];
    const svc = Array.isArray(services) ? services[0] : undefined;
    const serviceId =
      (typeof svc?.id === "string" && (svc.id as string)) ||
      (typeof svc?.["@id"] === "string" && (svc["@id"] as string)) ||
      undefined;

    out.push({
      serviceId: serviceId || undefined,
      directUrl:
        (typeof body.id === "string" && (body.id as string)) ||
        (typeof body["@id"] === "string" && (body["@id"] as string)) ||
        undefined,
      width: typeof canvas.width === "number" ? canvas.width : undefined,
      height: typeof canvas.height === "number" ? canvas.height : undefined,
      label: readLabel(canvas.label),
    });
  }
  return out;
}

export async function parseIiifManifest(
  manifestUrl: string,
  originalPageUrl?: string
): Promise<BookMetadata> {
  const res = await fetch(manifestUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/ld+json, application/json;q=0.9, */*;q=0.5",
    },
    signal: AbortSignal.timeout(25000),
  });

  if (!res.ok) {
    throw new Error(
      `IIIF-манифест не отвечает (HTTP ${res.status}). Проверьте ссылку на документ.`
    );
  }

  let manifest: Record<string, unknown>;
  try {
    manifest = (await res.json()) as Record<string, unknown>;
  } catch {
    throw new Error("По этой ссылке лежит не IIIF-манифест (не удалось прочитать JSON).");
  }

  const context = JSON.stringify(manifest["@context"] ?? "");
  const isV3 =
    context.includes("presentation/3") ||
    manifest.type === "Manifest" ||
    Array.isArray(manifest.items);

  let canvases = isV3 ? parseV3Canvases(manifest) : parseV2Canvases(manifest);
  if (canvases.length === 0) {
    // try the other flavour as a fallback
    canvases = isV3 ? parseV2Canvases(manifest) : parseV3Canvases(manifest);
  }

  if (canvases.length === 0) {
    throw new Error(
      "В IIIF-манифесте не нашлось страниц (canvases). Возможно, это коллекция, а не книга — откройте конкретный том."
    );
  }

  if (canvases.length > MAX_PAGES) {
    canvases = canvases.slice(0, MAX_PAGES);
  }

  const title = cleanTitle(
    readLabel(manifest.label) || `IIIF-документ ${new URL(manifestUrl).hostname}`
  );

  const metadataArr = manifest.metadata;
  const author = readMetadataField(metadataArr, [
    "author",
    "creator",
    "autor",
    "verfasser",
    "автор",
  ]);
  const yearRaw = readMetadataField(metadataArr, [
    "date",
    "datum",
    "erschein",
    "published",
    "год",
    "дата",
  ]);
  const year = yearRaw?.match(/1[0-9]{3}|20[0-2][0-9]/)?.[0] || yearRaw?.slice(0, 40);
  const publisher = readMetadataField(metadataArr, ["publisher", "verlag", "издатель"]);

  const descRaw =
    readLabel(manifest.description) ||
    readLabel(manifest.summary) ||
    readMetadataField(metadataArr, ["description", "beschreibung", "описание"]);
  const description = descRaw
    ? descRaw.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim().slice(0, 320)
    : undefined;

  const pages: PageInfo[] = canvases.map((c, idx) => {
    const index = idx + 1;
    const canvasWidth = c.width || 2000;

    // Prefer the Image API service (lets us pick a size); fall back to the static URL.
    if (c.serviceId) {
      const originalWidth = Math.min(canvasWidth, 4000);
      const hdWidth = Math.min(canvasWidth, 1600);
      const mobileWidth = Math.min(canvasWidth, 900);
      const thumbWidth = 240;

      return {
        index,
        id: c.serviceId,
        label: c.label || `Страница ${index}`,
        thumbnailUrl: imageApiUrl(c.serviceId, thumbWidth),
        originalUrl: imageApiUrl(c.serviceId, originalWidth),
        hdUrl: imageApiUrl(c.serviceId, hdWidth),
        mobileUrl: imageApiUrl(c.serviceId, mobileWidth),
        width: c.width,
        height: c.height,
      };
    }

    const direct = c.directUrl || "";
    return {
      index,
      label: c.label || `Страница ${index}`,
      thumbnailUrl: direct,
      originalUrl: direct,
      hdUrl: direct,
      mobileUrl: direct,
      width: c.width,
      height: c.height,
    };
  });

  return {
    url: originalPageUrl || manifestUrl,
    libraryType: "iiif",
    libraryName: iiifSourceName(manifestUrl),
    title,
    author,
    year,
    publisher,
    description,
    coverUrl: pages[0]?.thumbnailUrl,
    totalPages: pages.length,
    pages,
    metaRaw: { manifestUrl, iiifVersion: isV3 ? 3 : 2 },
  };
}

/** Friendly source name from the manifest host. */
export function iiifSourceName(manifestUrl: string): string {
  let host = "";
  try {
    host = new URL(manifestUrl).hostname.replace(/^www\./, "");
  } catch {
    return "IIIF-библиотека";
  }

  const known: Record<string, string> = {
    "api.digitale-sammlungen.de": "MDZ — Баварская государственная библиотека",
    "digitale-sammlungen.de": "MDZ — Баварская государственная библиотека",
    "gallica.bnf.fr": "Gallica — Национальная библиотека Франции",
    "iiif.wellcomecollection.org": "Wellcome Collection",
    "www.e-codices.unifr.ch": "e-codices — рукописи Швейцарии",
    "e-codices.unifr.ch": "e-codices — рукописи Швейцарии",
    "iiif.lib.harvard.edu": "Harvard Library",
    "digi.vatlib.it": "Ватиканская апостольская библиотека",
    "iiif.bodleian.ox.ac.uk": "Bodleian Library, Oxford",
    "api.bl.uk": "British Library",
    "iiif.archivelab.org": "Internet Archive (IIIF)",
    "api.onb.ac.at": "ONB — Австрийская национальная библиотека",
  };

  return known[host] || `IIIF-библиотека (${host})`;
}

/* ------------------------------------------------------------------ */
/* Entry point                                                          */
/* ------------------------------------------------------------------ */

export async function parseIiifUrl(rawUrl: string): Promise<BookMetadata> {
  const cleanUrl = rawUrl.split("#")[0].trim();

  // 1) direct manifest or a known pattern
  const guessed = guessManifestUrl(cleanUrl);
  if (guessed) {
    return parseIiifManifest(guessed, cleanUrl);
  }

  // 2) scrape the HTML page for an embedded manifest
  const discovered = await discoverManifestInHtml(cleanUrl);
  if (discovered) {
    return parseIiifManifest(discovered, cleanUrl);
  }

  throw new Error(
    "Не нашёл IIIF-манифест на этой странице. Попробуйте вставить прямую ссылку на manifest.json — котёнок поймёт её сразу."
  );
}

/** Quick check used by the dispatcher. */
export function looksLikeIiif(rawUrl: string): boolean {
  const url = rawUrl.toLowerCase();
  return (
    /\/manifest(\.json)?(\?|$)/.test(url) ||
    url.includes("/iiif/") ||
    url.includes("manifest=") ||
    url.includes("digitale-sammlungen.de") ||
    url.includes("gallica.bnf.fr") ||
    url.includes("e-codices.unifr.ch") ||
    url.includes("wellcomecollection.org/works") ||
    url.includes("digi.vatlib.it") ||
    url.includes("bodleian.ox.ac.uk") ||
    url.includes("onb.ac.at")
  );
}
