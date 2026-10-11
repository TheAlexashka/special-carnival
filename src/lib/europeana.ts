/**
 * Europeana — официальный Search/Record API.
 *
 * Проверено вживую:
 *  - api.europeana.eu доступен с сервера (в отличие от сайта europeana.eu,
 *    закрытого Cloudflare);
 *  - Europeana выдаёт бесплатный публичный ключ для тестов (api2demo); свой
 *    бесплатный personal key можно указать в EUROPEANA_API_KEY — лимиты тогда
 *    будут ваши;
 *  - фильтры: qf=TYPE:IMAGE, qf=DATA_PROVIDER:"…", qf=YEAR:[1800 TO 1850]
 *    (диапазон работает при корректном кодировании), reusability=open;
 *  - сортировка: sort=timestamp_create&order=desc;
 *  - edmPreview — публичный thumbnail-сервис (отдаёт JPEG без ключа),
 *    edmIsShownBy / edmObject — прямой файл у учреждения-партнёра;
 *  - previewNoDistribute=true означает «превью нельзя раздавать» — такие
 *    объекты мы не проксируем, а только показываем ссылку на Europeana.
 */

const API = "https://api.europeana.eu";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Публичный демо-ключ Europeana; переопределяется своей бесплатной Personal key. */
export function europeanaKey(): string {
  return process.env.EUROPEANA_API_KEY?.trim() || "api2demo";
}

export const EUROPEANA_TYPES = [
  { id: "IMAGE", label: "Изображения (IMAGE)" },
  { id: "TEXT", label: "Тексты и книги (TEXT)" },
  { id: "SOUND", label: "Звук (SOUND)" },
  { id: "VIDEO", label: "Видео (VIDEO)" },
  { id: "3D", label: "3D-объекты (3D)" },
] as const;

export interface EuropeanaItem {
  id: string;
  title: string;
  creators: string[];
  descriptions: string[];
  countries: string[];
  dataProvider: string | null;
  provider: string | null;
  type: string | null;
  rights: string | null;
  language: string | null;
  previewUrl: string | null;
  objectUrl: string | null;
  shownAtUrl: string | null;
  noDistribute: boolean;
  europeanaUrl: string;
  completeness: number | null;
}

export interface EuropeanaSearchResult {
  items: EuropeanaItem[];
  total: number;
  page: number;
  rows: number;
  totalPages: number;
  hasNextPage: boolean;
  query: string;
  /** Провайдеры и годы текущей выдачи — по ним удобно уточнять фильтр. */
  providerCounts: Array<{ value: string; count: number }>;
  usedKey: string;
}

function langAware(value: unknown, prefer: string[] = ["de", "en", "nl", "fr"]): string[] {
  if (!value) return [];
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string");
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of [...prefer, "def", ...Object.keys(record)]) {
      const entry = record[key];
      if (Array.isArray(entry) && entry.length) {
        return entry.filter((v): v is string => typeof v === "string");
      }
    }
  }
  return [];
}

function firstString(value: unknown, prefer?: string[]): string | null {
  return langAware(value, prefer)[0] ?? null;
}

export interface EuropeanaSearchOptions {
  query: string;
  type?: string | null;
  provider?: string | null;
  yearFrom?: number | null;
  yearTo?: number | null;
  onlyOpen?: boolean;
  page?: number;
  rows?: number;
  newestFirst?: boolean;
}

export async function searchEuropeana(
  options: EuropeanaSearchOptions
): Promise<EuropeanaSearchResult> {
  const query = options.query.trim().slice(0, 200);
  const rows = Math.max(6, Math.min(48, options.rows ?? 24));
  const page = Math.max(1, options.page ?? 1);

  // Внимание: Europeana ИГНОРИРУЕТ параметр page и offset — листать выдачу
  // можно только через start, причём он 1-based (start=0 даёт 400
  // "'start' parameter cannot be negative"). Проверено вживую: start=1 →
  // 670/item_TVAH…, start=12 → 670/item_S5G5…
  const params = new URLSearchParams({
    query: query || "*",
    rows: String(rows),
    start: String((page - 1) * rows + 1),
    profile: "rich",
    wskey: europeanaKey(),
  });
  const qf: string[] = [];
  if (options.type) qf.push(`TYPE:${options.type}`);
  if (options.provider) qf.push(`DATA_PROVIDER:"${options.provider.replace(/"/g, "")}"`);
  if (options.yearFrom || options.yearTo) {
    const from = options.yearFrom ?? -3000;
    const to = options.yearTo ?? 2100;
    qf.push(`YEAR:[${from} TO ${to}]`);
  }
  for (const filter of qf) params.append("qf", filter);
  if (options.onlyOpen) params.set("reusability", "open");
  if (options.newestFirst) {
    params.set("sort", "timestamp_create");
    params.set("order", "desc");
  }

  let lastStatus = 0;
  // Europeana иногда отвечает 5xx на единичный запрос — один повтор спасает.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const res = await fetch(`${API}/record/search.json?${params.toString()}`, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/json, */*;q=0.8",
        "Accept-Encoding": "identity",
      },
      signal: AbortSignal.timeout(30000),
    });
    lastStatus = res.status;
    if (res.ok) {
      return parseEuropeanaSearch(await res.json(), {
        items: [],
        page,
        total: 0,
        rows,
        totalPages: 0,
        hasNextPage: false,
        query: query || "*",
        providerCounts: [],
        usedKey: europeanaKey(),
      });
    }
    if (res.status < 500 && res.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, 800));
  }
  throw new Error(`Europeana API ответил HTTP ${lastStatus}`);
}

function parseEuropeanaSearch(
  data: {
    success?: boolean;
    message?: string;
    totalResults?: number;
    items?: Array<Record<string, unknown>>;
  },
  meta: EuropeanaSearchResult
): EuropeanaSearchResult {
  if (data.success === false) {
    throw new Error(data.message || "Europeana вернула ошибку");
  }

  const rawItems = data.items ?? [];
  const items: EuropeanaItem[] = rawItems.map((item) => {
    const id = String(item.id ?? "");
    const previews = langAware(item.edmPreview);
    const objects = langAware(item.edmIsShownBy);
    const shownAt = langAware(item.edmIsShownAt);
    return {
      id,
      title: firstString(item.title) ?? firstString(item.dcTitleLangAware) ?? "Без названия",
      creators: langAware(item.dcCreator),
      descriptions: langAware(item.dcDescription),
      countries: langAware(item.country),
      dataProvider: langAware(item.dataProvider)[0] ?? null,
      provider: typeof item.provider === "string" ? item.provider : null,
      type: typeof item.type === "string" ? item.type : null,
      rights: langAware(item.rights)[0] ?? null,
      language: langAware(item.language)[0] ?? null,
      previewUrl: previews[0] ?? null,
      objectUrl: objects[0] ?? null,
      shownAtUrl: shownAt[0] ?? null,
      noDistribute: item.previewNoDistribute === true,
      europeanaUrl: `https://www.europeana.eu/en/item${id}`,
      completeness:
        typeof item.europeanaCompleteness === "number" ? item.europeanaCompleteness : null,
    };
  });

  const providerCounts = new Map<string, number>();
  for (const item of items) {
    const key = item.dataProvider || item.provider;
    if (!key) continue;
    providerCounts.set(key, (providerCounts.get(key) ?? 0) + 1);
  }

  const total = Number(data.totalResults) || 0;
  return {
    ...meta,
    items,
    total,
    totalPages: Math.max(1, Math.ceil(total / meta.rows)),
    hasNextPage: meta.page * meta.rows < total && total > 0,
    providerCounts: [...providerCounts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
  };
}

export interface EuropeanaFile {
  url: string;
  mimetype: string | null;
  rights: string | null;
}

export async function getEuropeanaRecord(id: string): Promise<{
  id: string;
  title: string | null;
  dates: string[];
  descriptions: string[];
  creators: string[];
  subjects: string[];
  types: string[];
  countries: string[];
  languages: string[];
  dataProvider: string | null;
  rights: string | null;
  objectUrl: string | null;
  shownAtUrl: string | null;
  files: EuropeanaFile[];
  europeanaUrl: string;
}> {
  const url = `${API}/record/v2${encodeURIComponent(id)}.json?profile=full&wskey=${encodeURIComponent(
    europeanaKey()
  )}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json, */*;q=0.8",
      "Accept-Encoding": "identity",
    },
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Europeana record API ответил HTTP ${res.status}`);

  const payload = (await res.json()) as { object?: Record<string, any> };
  const object = payload.object ?? {};
  const proxies: any[] = Array.isArray(object.proxies) ? object.proxies : [];
  const aggregations: any[] = Array.isArray(object.aggregations) ? object.aggregations : [];
  const aggregation = aggregations[0] ?? {};
  const webResources: any[] = Array.isArray(aggregation.webResources) ? aggregation.webResources : [];

  const collect = (key: string): string[] => {
    const out = new Set<string>();
    for (const proxy of proxies) {
      for (const value of langAware(proxy?.[key])) out.add(value);
    }
    return [...out].slice(0, 8);
  };

  const files: EuropeanaFile[] = [];
  const pushFile = (entry: { url?: unknown; format?: unknown; rights?: unknown }) => {
    if (typeof entry.url !== "string") return;
    if (files.some((file) => file.url === entry.url)) return;
    files.push({
      url: entry.url,
      mimetype: typeof entry.format === "string" ? entry.format : null,
      rights: langAware(entry.rights)[0] ?? null,
    });
  };
  for (const resource of webResources) pushFile(resource);
  if (aggregation.edmIsShownBy || aggregation.edmObject) {
    pushFile({
      url: aggregation.edmObject ?? aggregation.edmIsShownBy,
      rights: aggregation.edmRights,
    });
  }

  return {
    id,
    title: collect("dcTitle")[0] ?? null,
    dates: collect("dcDate"),
    descriptions: collect("dcDescription"),
    creators: collect("dcCreator"),
    subjects: collect("dcSubject"),
    types: collect("dcType"),
    countries: langAware(object.europeanaAggregation?.edmCountry).slice(0, 4),
    languages: langAware(object.europeanaAggregation?.edmLanguage).slice(0, 4),
    dataProvider: typeof aggregation.edmDataProvider === "string" ? aggregation.edmDataProvider : null,
    rights:
      langAware(aggregation.edmRights)[0] ??
      langAware(object.europeanaAggregation?.edmRights)[0] ??
      null,
    objectUrl:
      typeof aggregation.edmObject === "string"
        ? aggregation.edmObject
        : typeof aggregation.edmIsShownBy === "string"
        ? aggregation.edmIsShownBy
        : null,
    shownAtUrl: typeof aggregation.edmIsShownAt === "string" ? aggregation.edmIsShownAt : null,
    files: files.slice(0, 12),
    europeanaUrl: `https://www.europeana.eu/en/item${id}`,
  };
}
