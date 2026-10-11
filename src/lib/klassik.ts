import type { BookMetadata } from "./types";
import { parseIiifManifest } from "./iiif";

/**
 * Klassik Stiftung Weimar — Sammlungen Online (suche.klassik-stiftung.de).
 *
 * Сайт — SPA, но его бэкенд открыт (найдено в bundle приложения):
 *   поиск:      GET https://suche.klassik-stiftung.de/solr/{endpoint}/
 *               ?q=…&offset=…&sort=…  (offset — 1-based, 30 документов на страницу)
 *   фасеты:     &agentfacet=…&datefacet=…&mediafacet=…&imagefacet=Ja&orgfacet=…
 *               (значение — точная строка, imagefacet=Ja — «только с изображением»)
 *   suggest:    GET /solr/suggest/?q=…
 *   IIIF:       GET /solr/manifest/?id=<id объекта>
 *   картинки:   https://ores.klassik-stiftung.de/digilib/Scaler/IIIF/<id>/full/full/0/default.jpg
 *
 * Endpoint «collections» — сами музейные объекты (их id выглядит как
 * /resources/id/object/museen/276, как в ссылке пользователя).
 */

const SITE = "https://suche.klassik-stiftung.de";
const SOLR = `${SITE}/solr`;
const IMAGE_SERVICE = "https://ores.klassik-stiftung.de/digilib/Scaler/IIIF";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function headersJson(): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json, */*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8",
    "Accept-Encoding": "identity",
    Referer: `${SITE}/`,
  };
}

function toText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) return entry.trim();
      if (entry && typeof entry === "object") {
        const values = (entry as Record<string, unknown>).value;
        if (Array.isArray(values) && typeof values[0] === "string") return values[0].trim();
      }
    }
  }
  return null;
}

/** KSW хранит дату как [{ value: ["1860"] }] — достаём человеческую строку. */
function dateLabel(value: unknown): string | null {
  if (Array.isArray(value)) {
    const parts = value
      .map((entry) => toText(entry))
      .filter((entry): entry is string => Boolean(entry));
    if (parts.length) return parts.join(" – ");
  }
  return toText(value);
}

export interface KlassikPhoto {
  id: string;
  title: string;
  date: string | null;
  creators: string[];
  collection: string | null;
  thumbnailUrl: string;
  fullImageUrl: string | null;
  objectUrl: string;
  detailsUrl: string;
}

export interface KlassikSearchResult {
  items: KlassikPhoto[];
  total: number;
  page: number;
  rows: number;
  totalPages: number;
  hasNextPage: boolean;
  query: string;
  onlyImages: boolean;
}

export interface KlassikSearchParams {
  query: string;
  creator?: string | null;
  collection?: string | null;
  date?: string | null;
  onlyImages?: boolean;
  page?: number;
  rows?: number;
}

function buildQuery(options: KlassikSearchParams): string {
  const params = new URLSearchParams();
  params.set("q", options.query.trim() || "*");
  // offset у KSW — номер страницы (1-based), 30 документов на страницу.
  params.set("offset", String(Math.max(1, options.page ?? 1)));
  params.set("sort", "score desc");
  if (options.creator) params.append("agentfacet", options.creator);
  if (options.collection) params.append("collectionsfacet", options.collection);
  if (options.date) params.append("datefacet", options.date);
  if (options.onlyImages) params.append("imagefacet", "Ja");
  return params.toString();
}

export async function searchKlassik(options: KlassikSearchParams): Promise<KlassikSearchResult> {
  const rows = Math.max(10, Math.min(60, options.rows ?? 30));
  const page = Math.max(1, options.page ?? 1);

  const res = await fetch(`${SOLR}/collections/?${buildQuery(options)}`, {
    headers: headersJson(),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`Klassik Stiftung ответил HTTP ${res.status}`);

  const data = (await res.json()) as {
    hits?: number;
    docs?: Array<Record<string, unknown>>;
  };
  const docs = data.docs ?? [];
  const total = Number(data.hits) || 0;

  const items: KlassikPhoto[] = docs.map((doc) => {
    const id = String(doc.id ?? "");
    const thumbnails = toText(doc.thumbnail);
    // thumbnail — это IIIF Image API с фиксированным размером !400,400;
    // подменяем на full/full, чтобы получить оригинал.
    const fullImageUrl = thumbnails ? thumbnails.replace(/\/full\/[^/]+\//, "/full/full/") : null;
    return {
      id,
      title: toText(doc.title) || "Без названия",
      date: dateLabel(doc.date),
      creators: Array.isArray(doc.contributor)
        ? (doc.contributor as Array<{ name?: string }>)
            .map((person) => person?.name)
            .filter((name): name is string => Boolean(name))
            .slice(0, 3)
        : [],
      collection: toText(doc.originalIndex),
      thumbnailUrl: thumbnails ?? "",
      fullImageUrl,
      objectUrl: `${SITE}/#/details?id=${encodeURIComponent(id)}`,
      detailsUrl: `${SITE}/#/details?id=${encodeURIComponent(id)}`,
    };
  });

  return {
    items,
    total,
    page,
    rows,
    totalPages: Math.max(1, Math.ceil(total / rows)),
    hasNextPage: page * rows < total && total > 0,
    query: options.query.trim() || "*",
    onlyImages: Boolean(options.onlyImages),
  };
}

/** Значения фасетов — берём из открытого эндпоинта facets. */
export async function klassikFacets(): Promise<{
  creators: string[];
  collections: string[];
  dates: string[];
}> {
  try {
    const res = await fetch(`${SOLR}/facets/?q=*&offset=0`, {
      headers: headersJson(),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { creators: [], collections: [], dates: [] };
    const data = (await res.json()) as Record<string, unknown>;
    const collect = (key: string): string[] => {
      const raw = data[key];
      if (Array.isArray(raw)) {
        return raw
          .map((entry) => {
            if (typeof entry === "string") return entry;
            if (entry && typeof entry === "object") {
              const record = entry as Record<string, unknown>;
              return typeof record.value === "string" ? record.value : null;
            }
            return null;
          })
          .filter((entry): entry is string => Boolean(entry))
          .slice(0, 24);
      }
      return [];
    };
    return {
      creators: collect("agentfacet"),
      collections: collect("collectionsfacet"),
      dates: collect("datefacet"),
    };
  } catch {
    return { creators: [], collections: [], dates: [] };
  }
}

/** Манифест объекта (для ссылки из приложения). */
export async function klassikManifestUrl(objectId: string): Promise<string> {
  return `${SOLR}/manifest/?id=${objectId}`;
}

/**
 * Объект по ссылке вида
 * https://suche.klassik-stiftung.de/#/details?id=/resources/id/object/museen/276
 *
 * Проверено вживую: /solr/detail/?id=… отдаёт полный документ с полем
 * iiifmanifest, у которого два вида значений:
 *  - для музейных объектов — готовое изображение …/full/full/0/default.jpg;
 *  - для остальных (gsa, гsa-архивы) — настоящий IIIF Presentation manifest.
 * Плюс thumbnail — это IIIF Image API, поэтому оригинал = full/full.
 */
export async function parseKlassikUrl(rawUrl: string): Promise<BookMetadata> {
  const match = rawUrl.match(/id=([^&]+)/);
  if (!match) {
    throw new Error("В ссылке Klassik Stiftung нет идентификатора объекта (id=/resources/id/object/…).");
  }
  const objectId = decodeURIComponent(match[1]);
  const pageUrl = `${SITE}/#/details?id=${objectId}`;

  const detailRes = await fetch(`${SOLR}/detail/?id=${encodeURIComponent(objectId)}`, {
    headers: headersJson(),
    signal: AbortSignal.timeout(25000),
  });
  if (!detailRes.ok) {
    throw new Error(`Klassik Stiftung не отдала карточку (HTTP ${detailRes.status})`);
  }
  const payload = (await detailRes.json()) as { doc?: Record<string, unknown> };
  const doc = payload.doc ?? {};

  const title = toText(doc.title) || "Объект Klassik Stiftung";
  const manifests = Array.isArray(doc.iiifmanifest)
    ? (doc.iiifmanifest as unknown[]).filter((v): v is string => typeof v === "string")
    : [];
  const thumbnail = toText(doc.thumbnail);
  const fullFromThumbnail = thumbnail ? thumbnail.replace(/\/full\/[^/]+\//, "/full/full/") : null;

  // Вариант 1: iiifmanifest — это сразу картинка в полном размере.
  const directImage = manifests.find((value) => /\/full\/full\/0\/default\.(jpg|jpeg|png)$/i.test(value));

  // Вариант 2: iiifmanifest — настоящий IIIF Presentation manifest.
  let metadata: BookMetadata | null = null;
  const presentationManifest = manifests.find((value) => !/\.jpg$/i.test(value));
  if (presentationManifest) {
    try {
      metadata = await parseIiifManifest(presentationManifest, pageUrl);
    } catch {
      metadata = null;
    }
  }

  // Манифест годится, только если он дал настоящую абсолютную ссылку на файл.
  // Часть манифестов KSW возвращает заглушку ("/resources/id/…" без хоста) —
  // тогда надёжнее взять thumbnail и поднять размер до full/full.
  const manifestPages = (metadata?.pages ?? []).filter((page) =>
    /^https?:\/\//i.test(page.originalUrl)
  );

  const singleImage = directImage || fullFromThumbnail;
  const pages = manifestPages.length
    ? manifestPages
    : singleImage
    ? [
        {
          index: 1,
          label: "Оригинальное изображение",
          thumbnailUrl: thumbnail ?? singleImage,
          originalUrl: singleImage,
          hdUrl: singleImage,
          mobileUrl: thumbnail ?? singleImage,
        },
      ]
    : [];

  if (!pages.length) {
    throw new Error(
      "У этого объекта Klassik Stiftung нет опубликованного изображения — только описание."
    );
  }

  return {
    url: pageUrl,
    libraryType: "klassik",
    libraryName: "Klassik Stiftung Weimar — Sammlungen Online",
    title: metadata?.title || title,
    author: metadata?.author || undefined,
    description: metadata?.description || undefined,
    coverUrl: pages[0].thumbnailUrl,
    totalPages: pages.length,
    pages,
    metaRaw: {
      ...(metadata?.metaRaw ?? {}),
      objectId,
      detailUrl: `${SOLR}/detail/?id=${objectId}`,
      collection: toText(doc.originalIndex),
      source: "Klassik Stiftung Weimar",
    },
  };
}

export { SITE as KLASSIK_SITE, SOLR as KLASSIK_SOLR, IMAGE_SERVICE as KLASSIK_IMAGE_SERVICE };
