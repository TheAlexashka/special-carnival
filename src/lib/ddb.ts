/**
 * Deutsche Digitale Bibliothek — официальный публичный API v2 (без ключа).
 *
 * Что проверено вживую:
 *  - индекс: GET /2/search/index/search/select  (Solr-синтаксис)
 *  - категории «как на сайте»: фасет objecttype_fct (Fotografie, Gemälde, Buch,
 *    Archivale …) отдаёт реальные значения с количествами — из него и строим
 *    фильтр «встроенных» категорий;
 *  - Спарта: sector_fct ("sec_01".."sec_07");
 *  - год создания: поля begin_time / end_time хранят ЧИСЛО ДНЕЙ ОТ ГОДА 0,
 *    т.е. year ≈ значение / 365.2425 (проверено: fq=begin_time:[657436 TO 658265]
 *    → 1800–1802, «Portrait des Atahuallpa» и т.д.);
 *  - описание: caption_1 / caption_2 (в индексе) + ddbObject.description (item API);
 *  - наличие цифровой копии: digitalisat:"true", оригинал — binaries[].local_pathname.
 */

const API = "https://api.deutsche-digitale-bibliothek.de/2";
/** Собственный IIIF-сервер DDB — резервная копия сканов, если источник закрыл hotlink. */
const IIIF_IMAGE = "https://iiif.deutsche-digitale-bibliothek.de/image/2";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** DDB хранит дату как «дни от года 0» — переводим туда и обратно. */
const DAYS_PER_YEAR = 365.2425;
const yearToDays = (year: number) => Math.round(year * DAYS_PER_YEAR);
const daysToYear = (days: number) => Math.round(days / DAYS_PER_YEAR);

function headers(): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json, */*;q=0.8",
    "Accept-Language": "de-DE,de;q=0.9,en-US;q=0.8",
    "Accept-Encoding": "identity",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "cross-site",
    Origin: "https://www.deutsche-digitale-bibliothek.de",
  };
}

/** Спарта (сектора) DDB — значения sector_fct. */
export const DDB_SECTORS = [
  { id: "sec_01", label: "Kultur und Kunst" },
  { id: "sec_02", label: "Medien" },
  { id: "sec_03", label: "Bau- und Raumkunst" },
  { id: "sec_04", label: "Alltagskultur" },
  { id: "sec_05", label: "Karten und Geodaten" },
  { id: "sec_06", label: "Museale Objekte" },
  { id: "sec_07", label: "Fotografie" },
] as const;

export interface DdbItem {
  id: string;
  title: string;
  sector: string;
  objectType: string | null;
  provider: string | null;
  dataprovider: string | null;
  license: string | null;
  year: number | null;
  yearTo: number | null;
  dateLabel: string | null;
  description: string | null;
  place: string | null;
  technique: string | null;
  imageUrl: string | null;
  /** Резерв у самой DDB (IIIF): часть учреждений (напр. DHM) отдаёт серверу 403. */
  imageFallbackUrl: string | null;
  itemUrl: string;
  hasImage: boolean;
}

export interface DdbFacet {
  field: "objecttype_fct" | "mimetype_fct";
  values: Array<{ value: string; count: number }>;
}

export interface DdbSearchResult {
  items: DdbItem[];
  total: number;
  page: number;
  rows: number;
  query: string;
  sector: string | null;
  objectType: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  totalPages: number;
  hasNextPage: boolean;
  facets: DdbFacet[];
}

export interface DdbSearchOptions {
  query: string;
  sector?: string | null;
  objectType?: string | null;
  mimetype?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  onlyImages?: boolean;
  page?: number;
  rows?: number;
}

function toText(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string" && value[0].trim()) return value[0].trim();
  return null;
}

function toArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim().length > 0);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

/** Из списка бинарников выбирает картинку и отдельно PDF. */
function pickBinaries(binaries: Array<{ mimetype: string | null; localPath: string | null }>): {
  imageUrl: string | null;
  pdfUrl: string | null;
} {
  const imageExt = /\.(jpe?g|png|gif|webp|avif)(\?|$)/i;
  const imageUrl =
    binaries.find(
      (b) => b.localPath && (b.mimetype?.startsWith("image/") || imageExt.test(b.localPath))
    )?.localPath ?? null;
  const pdfExt = /\.pdf(\?|$)/i;
  const pdfUrl =
    binaries.find(
      (b) => b.localPath && (b.mimetype === "application/pdf" || pdfExt.test(b.localPath))
    )?.localPath ?? null;
  return { imageUrl, pdfUrl };
}

function firstNumber(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/** Формируем fq-фильтры из выбранных пользователем условий. */
function buildFilters(options: DdbSearchOptions): string[] {
  const filters: string[] = [];
  if (options.sector) filters.push(`sector_fct:"${options.sector}"`);
  if (options.objectType) filters.push(`objecttype_fct:"${options.objectType.replace(/"/g, "")}"`);
  if (options.mimetype) filters.push(`mimetype_fct:"${options.mimetype}"`);
  if (options.onlyImages) filters.push('digitalisat:"true"');

  const from = options.yearFrom;
  const to = options.yearTo;
  if (from || to) {
    // Границы inclusive: добавляем запас в 2 дня на случай округлений DDB.
    const lo = yearToDays(Math.max(-3000, from ?? -3000)) - 2;
    const hi = yearToDays(Math.min(2100, to ?? 2100)) + 2;
    filters.push(`begin_time:[${lo} TO ${hi}]`);
  }
  return filters;
}

async function request(params: URLSearchParams): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/search/index/search/select?${params.toString()}`, {
    headers: headers(),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`DDB API ответил HTTP ${res.status}`);
  return (await res.json()) as Record<string, unknown>;
}

/** Разбирает Solr-ответ (facets могут идти в двух формах). */
function parseResponse(data: Record<string, unknown>) {
  const response = (data.response ?? {}) as {
    docs?: Array<Record<string, unknown>>;
    numFound?: number;
    facets?: { facet_fields?: Record<string, Array<string | number>> };
  };
  const facetMap = new Map<string, Array<{ value: string; count: number }>>();
  // Solr отдаёт фасеты либо в response.facets (новый синтаксис), либо в
  // верхнеуровневом facet_counts.facet_fields — именно так отвечает индекс DDB.
  const facetCounts = (
    data.facet_counts as { facet_fields?: Record<string, Array<string | number>> } | undefined
  )?.facet_fields;
  const raw =
    response.facets?.facet_fields ??
    facetCounts ??
    (data.facet_fields as Record<string, Array<string | number>> | undefined);
  for (const [field, values] of Object.entries(raw ?? {})) {
    const pairs: Array<{ value: string; count: number }> = [];
    for (let i = 0; i + 1 < values.length; i += 2) {
      pairs.push({ value: String(values[i]), count: Number(values[i + 1]) });
    }
    facetMap.set(field, pairs.filter((p) => p.count > 0).slice(0, 40));
  }
  return { docs: response.docs ?? [], total: Number(response.numFound) || 0, facetMap };
}

export async function searchDdb(options: DdbSearchOptions): Promise<DdbSearchResult> {
  const query = options.query.trim().slice(0, 200);
  const rows = Math.max(6, Math.min(60, options.rows ?? 24));
  const page = Math.max(1, options.page ?? 1);
  const start = (page - 1) * rows;
  const yearFrom = options.yearFrom ? Number(options.yearFrom) : null;
  const yearTo = options.yearTo ? Number(options.yearTo) : null;

  const params = new URLSearchParams({
    q: query || "*",
    rows: String(rows),
    start: String(start),
    fl: "id,title,sector_fct,objecttype_fct,mimetype_fct,provider,dataprovider_fct,license,begin_time,end_time,caption_1,caption_2,production,material_technique,digitalisat",
  });
  for (const filter of buildFilters(options)) params.append("fq", filter);
  // Живые фасеты для фильтра «как на сайте».
  params.set("facet", "true");
  params.set("facet.field", "objecttype_fct");
  params.set("facet.limit", "40");
  params.set("facet.mincount", "1");

  const data = await request(params);
  const { docs, total, facetMap } = parseResponse(data);

  const items: DdbItem[] = docs.map((doc) => {
    const id = String(doc.id ?? "");
    const begin = firstNumber(doc.begin_time);
    const end = firstNumber(doc.end_time);
    const year = begin != null ? daysToYear(begin) : null;
    const yearTo = end != null ? daysToYear(end) : null;
    const dateLabel =
      year != null
        ? yearTo != null && yearTo !== year
          ? `${yearTo > 9999 || year < 0 ? "около " : ""}${formatYear(year)} – ${formatYear(yearTo)}`
          : formatYear(year)
        : null;

    return {
      id,
      title: toText(doc.title) || toText(doc.label) || `DDB ${id}`,
      sector: toText(doc.sector_fct) || "—",
      objectType: toArray(doc.objecttype_fct)[0] ?? null,
      provider: toArray(doc.provider)[0] ?? null,
      dataprovider: toArray(doc.dataprovider_fct)[0] ?? null,
      license: toArray(doc.license)[0] ?? null,
      year,
      yearTo,
      dateLabel,
      description: [toText(doc.caption_1), toText(doc.caption_2)].filter(Boolean).join(" · ") || null,
      place: toArray(doc.production)[0] ?? toArray(doc.place)[0] ?? null,
      technique: toArray(doc.material_technique)[0] ?? null,
      imageUrl: null,
      imageFallbackUrl: null,
      itemUrl: `https://www.deutsche-digitale-bibliothek.de/item/${id}`,
      hasImage: toText(doc.digitalisat) === "true",
    };
  });

  // Оригиналы картинок тянем из item API (индекс их не отдаёт) — только для
  // видимой страницы, иначе запрос станет слишком долгим.
  await Promise.all(
    items.slice(0, 24).map(async (item) => {
      if (!item.hasImage) return;
      try {
        const detail = await getDdbItem(item.id);
        item.imageUrl = detail.imageUrl;
        item.imageFallbackUrl = detail.imageFallbackUrl;
        item.hasImage = Boolean(detail.imageUrl);
        if (!item.description && detail.description) item.description = detail.description;
      } catch {
        item.hasImage = false;
      }
    })
  );

  const objectTypes = facetMap.get("objecttype_fct") ?? [];
  const facets: DdbFacet[] = [
    { field: "objecttype_fct", values: objectTypes },
    { field: "mimetype_fct", values: facetMap.get("mimetype_fct") ?? [] },
  ];

  return {
    items: items.filter((item) => (options.onlyImages ? item.hasImage || item.imageUrl : true)),
    total,
    page,
    rows,
    query: query || "*",
    sector: options.sector || null,
    objectType: options.objectType || null,
    yearFrom,
    yearTo,
    totalPages: Math.max(1, Math.ceil(total / rows)),
    hasNextPage: page * rows < total,
    facets,
  };
}

function formatYear(year: number): string {
  if (year < 0) return `${Math.abs(year)} до н.э.`;
  return String(year);
}

/** Метаданные объекта: год/описание/изображения у источника. */
export async function getDdbItem(id: string): Promise<{
  id: string;
  title: string;
  subtitle: string | null;
  provider: string | null;
  rights: string | null;
  metadataRights: string | null;
  description: string | null;
  dateLabel: string | null;
  imageUrl: string | null;
  pdfUrl: string | null;
  imageFallbackUrl: string | null;
  binaries: Array<{ ref: string; license: string | null; mimetype: string | null; localPath: string | null; fallbackUrl: string | null }>;
  itemUrl: string;
}> {
  const res = await fetch(`${API}/items/${encodeURIComponent(id)}`, {
    headers: headers(),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`DDB API ответил HTTP ${res.status}`);
  const data = (await res.json()) as Record<string, any>;

  const preview = data.preview ?? {};
  const providerInfo = data["provider-info"] ?? {};
  const ddb = data.ddbObject ?? {};
  const view = data.view ?? {};

  const literal = (value: unknown): string | null => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
      const parts = value
        .map((entry) => {
          if (!entry || typeof entry !== "object") return typeof entry === "string" ? entry : null;
          const record = entry as Record<string, any>;
          return (
            toText(record.literal) ??
            toArray(record.literal)[0] ??
            toText(record.value) ??
            toText(record.standardised) ??
            null
          );
        })
        .filter(Boolean);
      return parts.length ? parts.join("; ") : null;
    }
    return null;
  };

  const binariesRaw: any[] = Array.isArray(data.binaries?.binary) ? data.binaries.binary : [];
  const binaries = binariesRaw.map((binary) => {
    const ref = String(binary?.ref ?? "");
    const mimetype = typeof binary?.mimetype === "string" ? binary.mimetype : null;
    return {
      ref,
      license: typeof binary?.kind === "string" ? binary.kind : null,
      mimetype,
      localPath: typeof binary?.local_pathname === "string" ? binary.local_pathname : null,
      // DDB хранит свою копию скана: если источник закрыл прямую раздачу (403),
      // изображение и скачивание забираем отсюда.
      fallbackUrl:
        ref && mimetype?.startsWith("image/") ? `${IIIF_IMAGE}/${ref}/full/full/0/default.jpg` : null,
    };
  });

  return {
    id,
    title: preview.title || id,
    subtitle: preview.subtitle || null,
    provider: providerInfo["provider-name"] || null,
    rights: view.item?.rights || null,
    metadataRights: view.item?.["metdata-rights"] || null,
    description: literal(ddb.description) || literal(ddb.abstract) || null,
    dateLabel: literal(ddb.creationDate) || literal(ddb.durationDate) || null,
    ...pickBinaries(binaries),
    imageFallbackUrl: binaries.find((binary) => binary.fallbackUrl)?.fallbackUrl ?? null,
    binaries,
    itemUrl: `https://www.deutsche-digitale-bibliothek.de/item/${id}`,
  };
}

/** Значения для подсказки диапазона годов (по живому фасету нельзя — отдаём пресеты). */
export const DDB_YEAR_PRESETS = [
  { label: "до 1500", from: -3000, to: 1499 },
  { label: "1500–1700", from: 1500, to: 1700 },
  { label: "18 век", from: 1700, to: 1799 },
  { label: "19 век", from: 1800, to: 1899 },
  { label: "1900–1950", from: 1900, to: 1950 },
  { label: "после 1950", from: 1950, to: 2100 },
] as const;

export { yearToDays, daysToYear };
