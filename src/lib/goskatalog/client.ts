import {
  GK_CATEGORIES,
  GK_IMAGE_BASE,
  GK_POPULAR_MUSEUMS,
  GK_PORTAL_BASE,
  GK_REST_BASE,
} from "./constants";
import { gkFetch, hasVerifiedRoute, proxyPoolStats } from "./transport";
import type {
  GkExhibitDetail,
  GkExhibitSummary,
  GkImage,
  GkMuseum,
  GkSearchFilters,
  GkSearchResult,
  TextMatchMode,
} from "./types";

class GoskatalogUnavailableError extends Error {}

/** Короткий кеш ответов: бережёт хрупкие прокси и ускоряет повторные запросы. */
const jsonCache = new Map<string, { at: number; value: unknown }>();

function cacheGet<T>(key: string, ttlMs: number): T | null {
  const hit = jsonCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > ttlMs) {
    jsonCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function cacheSet(key: string, value: unknown) {
  if (jsonCache.size > 200) jsonCache.clear();
  jsonCache.set(key, { at: Date.now(), value });
}

async function fetchJson<T>(url: string, ttlMs = 0): Promise<T> {
  if (ttlMs > 0) {
    const cached = cacheGet<T>(url, ttlMs);
    if (cached !== null) return cached;
  }

  try {
    const result = await gkFetch(url);
    if (!result.ok) {
      throw new Error(`Госкаталог ответил HTTP ${result.status}`);
    }
    const parsed = JSON.parse(result.body.toString("utf8")) as T;
    if (ttlMs > 0) cacheSet(url, parsed);
    return parsed;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const stats = proxyPoolStats();
    const reason = msg.includes("дедлайн") || msg.includes("timeout") || msg.includes("aborted")
      ? "источник не ответил вовремя"
      : msg.slice(0, 120);
    throw new GoskatalogUnavailableError(
      `Госкаталог сейчас не отвечает (${reason}). ` +
        `Проверено путей: напрямую и через российский пул (${stats.verified} подтверждённо живых из ${stats.healthy}/${stats.total}). ` +
        `Откройте этот же поиск на самом goskatalog.ru — с обычного IP он доступен.`
    );
  }
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").trim();
}

function splitWords(value: string): string[] {
  return normalizeText(value)
    .split(/[,;]+|\s{2,}|\n/)
    .flatMap((part) => part.split(" "))
    .map((w) => w.trim())
    .filter(Boolean);
}

function matchesMode(haystack: string, rawQuery: string | undefined, mode: TextMatchMode | undefined): boolean {
  if (!rawQuery || !rawQuery.trim()) return true;
  const text = normalizeText(haystack);
  const words = splitWords(rawQuery);
  if (!words.length) return true;

  if (mode === "none") {
    return !words.some((w) => text.includes(w));
  }
  if (mode === "all") {
    return words.every((w) => text.includes(w));
  }
  // "any" (default)
  return words.some((w) => text.includes(w));
}

function matchesCode(exhibit: { gikNumber?: string; invNumber?: string; id: number }, code?: string): boolean {
  if (!code || !code.trim()) return true;
  const needle = normalizeText(code);
  const haystacks = [exhibit.gikNumber, exhibit.invNumber, String(exhibit.id)]
    .filter(Boolean)
    .map((v) => normalizeText(String(v)));
  return haystacks.some((h) => h.includes(needle));
}

function categoryLabelsFor(ids: string[] | undefined): string[] {
  if (!ids || !ids.length) return [];
  return GK_CATEGORIES.filter((c) => ids.includes(c.id)).map((c) => normalizeText(c.label));
}

function imageUrl(imageId: number, size: "original" | number = 600): string {
  if (size === "original") return `${GK_IMAGE_BASE}/original/${imageId}`;
  return `${GK_IMAGE_BASE}/public/${size}/${imageId}/${imageId}.jpg`;
}

function toSummary(raw: Record<string, unknown>): GkExhibitSummary {
  const id = Number(raw.id ?? raw.regNumber ?? 0);
  const museumRaw = raw.museum as Record<string, unknown> | undefined;
  const typologyRaw = raw.typology as Record<string, unknown> | undefined;
  const imagesRaw = Array.isArray(raw.images) ? (raw.images as Array<Record<string, unknown>>) : [];

  const images: GkImage[] = [];
  for (const img of imagesRaw) {
    const imgId = Number(img.id ?? 0);
    if (!imgId) continue;
    images.push({ id: imgId, code: img.code as string | undefined, url: imageUrl(imgId, 600) });
  }

  return {
    id,
    title: String(raw.name ?? raw.title ?? `Экспонат №${id}`),
    description: typeof raw.description === "string" ? raw.description : undefined,
    museum: museumRaw
      ? { id: Number(museumRaw.id ?? 0), name: String(museumRaw.name ?? ""), code: museumRaw.code as string | undefined }
      : undefined,
    categoryName: typologyRaw ? String(typologyRaw.name ?? "") : undefined,
    gikNumber: typeof raw.gikNumber === "string" ? raw.gikNumber : undefined,
    invNumber: typeof raw.invNumber === "string" ? raw.invNumber : undefined,
    periodStr: typeof raw.periodStr === "string" ? raw.periodStr : undefined,
    images,
    thumbnailUrl: images[0]?.url,
    deepLink: `${GK_PORTAL_BASE}/collections?id=${id}`,
  };
}

function toDetail(raw: Record<string, unknown>): GkExhibitDetail {
  const summary = toSummary(raw);
  const technologies = Array.isArray(raw.technologies) ? (raw.technologies as unknown[]).map(String) : undefined;
  return {
    ...summary,
    productionPlace: typeof raw.productionPlace === "string" ? raw.productionPlace : undefined,
    dimensions: typeof raw.dimStr === "string" ? raw.dimStr : undefined,
    technologies,
    author: typeof raw.author === "string" ? raw.author : undefined,
  };
}

function buildDeepLink(filters: GkSearchFilters): string {
  // «Глубокая» ссылка повторяет формат самого портала, чтобы при открытии
  // в браузере пользователя подхватились те же условия поиска.
  const params = new URLSearchParams();
  params.set("statusIds", "6");
  params.set("publicationLimit", "false");
  params.set("calcCountsType", "1");
  if (filters.museumIds?.length) params.set("museumIds", filters.museumIds.join(","));
  const deepTypologyIds = GK_CATEGORIES.filter(
    (c) => filters.categoryIds?.includes(c.id) && c.typologyId
  ).map((c) => c.typologyId as number);
  if (deepTypologyIds.length) params.set("typologyIds", deepTypologyIds.join(","));
  const words = [filters.code, filters.title, filters.description].filter(Boolean).join(" ").trim();
  if (words) params.set("q", words);
  params.set("limit", String(filters.pageSize));
  params.set("offset", String((filters.page - 1) * filters.pageSize));
  return `${GK_PORTAL_BASE}/collections?${params.toString()}`;
}

export function buildExhibitDeepLink(id: number): string {
  return `${GK_PORTAL_BASE}/collections?id=${id}`;
}

export function getImageUrl(imageId: number, size: "original" | number = 600): string {
  return imageUrl(imageId, size);
}

export async function searchExhibits(filters: GkSearchFilters): Promise<GkSearchResult> {
  const deepLink = buildDeepLink(filters);
  const offset = (filters.page - 1) * filters.pageSize;

  /**
   * Формат параметров подтверждён по архивной копии портала:
   *   goskatalog.ru/?statusIds=6&publicationLimit=false&cacheEnabled=true
   *                 &calcCountsType=1&limit=…&museumIds=95&offset=0&q=…
   * То есть у каталога ОДНО общее поле полнотекста `q`, а не отдельные
   * name/description. Поэтому в `q` отправляем самый селективный запрос
   * (шифр → заголовок → описание), а остальные условия допроверяем на клиенте
   * сервера строго по полям карточки — так результат остаётся точным.
   */
  const upstreamQuery =
    filters.code?.trim() || filters.title?.trim() || filters.description?.trim() || "";

  const params = new URLSearchParams({
    statusIds: "6",
    publicationLimit: "false",
    cacheEnabled: "true",
    calcCountsType: "1",
    dirFields: "desc",
    sortFields: "id",
    limit: String(filters.pageSize),
    offset: String(offset),
  });

  if (filters.museumIds?.length) params.set("museumIds", filters.museumIds.join(","));
  if (upstreamQuery) params.set("q", upstreamQuery);

  // Категория → официальный typologyId из справочника Госкаталога.
  const knownTypologyIds = GK_CATEGORIES.filter(
    (c) => filters.categoryIds?.includes(c.id) && c.typologyId
  ).map((c) => c.typologyId as number);
  if (knownTypologyIds.length) params.set("typologyIds", knownTypologyIds.join(","));

  const upstreamUrl = `${GK_REST_BASE}/exhibits/ext?${params.toString()}`;

  try {
    const raw = await fetchJson<Record<string, unknown>>(upstreamUrl, 60_000);

    // Форма ответа не задокументирована, поэтому перебираем известные варианты
    // (exhibits / content / data / items / records / голый массив).
    const listKeys = ["exhibits", "content", "data", "items", "records", "list"] as const;
    let list: Array<Record<string, unknown>> = Array.isArray(raw)
      ? (raw as unknown as Array<Record<string, unknown>>)
      : [];
    if (!list.length) {
      for (const key of listKeys) {
        const candidate = raw[key];
        if (Array.isArray(candidate) && candidate.length) {
          list = candidate as Array<Record<string, unknown>>;
          break;
        }
      }
    }

    const totalKeys = ["totalCount", "totalElements", "total", "count", "totalRecords"] as const;
    let upstreamTotal: number | null = null;
    for (const key of totalKeys) {
      const value = raw[key];
      if (typeof value === "number" && Number.isFinite(value)) {
        upstreamTotal = value;
        break;
      }
      if (typeof value === "string" && /^\d+$/.test(value)) {
        upstreamTotal = Number(value);
        break;
      }
    }

    const summaries = (list as Array<Record<string, unknown>>).map(toSummary);
    const categoryLabels = categoryLabelsFor(filters.categoryIds);

    const refined = summaries.filter((item) => {
      if (!matchesCode(item, filters.code)) return false;
      if (!matchesMode(item.title, filters.title, filters.titleMode)) return false;
      if (!matchesMode(item.description || "", filters.description, filters.descriptionMode)) return false;
      if (filters.onlyWithPhoto && item.images.length === 0) return false;
      if (categoryLabels.length) {
        const cat = normalizeText(item.categoryName || "");
        if (!categoryLabels.some((label) => cat.includes(label) || label.includes(cat))) return false;
      }
      return true;
    });

    return {
      items: refined,
      page: filters.page,
      pageSize: filters.pageSize,
      upstreamTotal,
      refinedCount: refined.length,
      hasNextPage: summaries.length === filters.pageSize,
      deepLink,
      upstreamUrl,
      source: "live",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      items: [],
      page: filters.page,
      pageSize: filters.pageSize,
      upstreamTotal: null,
      refinedCount: 0,
      hasNextPage: false,
      deepLink,
      upstreamUrl,
      source: "unavailable",
      warning: msg,
    };
  }
}

export async function getExhibit(id: number): Promise<{ exhibit: GkExhibitDetail | null; warning?: string }> {
  try {
    const raw = await fetchJson<Record<string, unknown>>(`${GK_REST_BASE}/exhibits/${id}`, 300_000);
    return { exhibit: toDetail(raw) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { exhibit: null, warning: msg };
  }
}

export async function searchMuseums(query: string): Promise<{ museums: GkMuseum[]; source: "live" | "fallback" }> {
  const needle = normalizeText(query);

  // Быстрый путь: если живого маршрута до Госкаталога сейчас нет, не заставляем
  // пользователя ждать десятки секунд — сразу отдаём курированный список.
  if (!hasVerifiedRoute()) {
    const quick = needle
      ? GK_POPULAR_MUSEUMS.filter((m) => normalizeText(m.name).includes(needle))
      : GK_POPULAR_MUSEUMS;
    return { museums: quick.length ? quick : GK_POPULAR_MUSEUMS, source: "fallback" };
  }

  try {
    const raw = await fetchJson<Record<string, unknown>>(
      `${GK_REST_BASE}/museums?limit=30&offset=0${query ? `&name=${encodeURIComponent(query)}` : ""}`,
      600_000
    );
    const list = Array.isArray(raw.museums) ? (raw.museums as Array<Record<string, unknown>>) : [];
    const museums: GkMuseum[] = list.map((m) => ({
      id: Number(m.id ?? 0),
      name: String(m.name ?? ""),
      code: m.code as string | undefined,
    }));
    if (museums.length) return { museums, source: "live" };
    throw new Error("empty");
  } catch {
    const filtered = needle
      ? GK_POPULAR_MUSEUMS.filter((m) => normalizeText(m.name).includes(needle))
      : GK_POPULAR_MUSEUMS;
    return { museums: filtered, source: "fallback" };
  }
}

export { GoskatalogUnavailableError };
