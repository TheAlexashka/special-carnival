import type { BookMetadata, PageInfo } from "./types";

/**
 * Royal Collection Trust online collection.
 *
 * Основной www.rct.uk защищён Cloudflare, но официальный search API открыт
 * напрямую на col.rct.uk/collection/search-api (POST). Endpoint отдаёт более
 * 300k публичных записей, RCIN, автора/создателя, датировку, teaser и ссылки
 * на уменьшенное и полноразмерное изображение. Файлы с col.rct.uk общедоступны.
 */
const SEARCH_API = "https://col.rct.uk/collection/search-api";
const SITE = "https://www.rct.uk";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface RctRawItem {
  id?: number;
  title?: string;
  type?: string;
  creator?: string;
  creationDate?: string;
  primaryImage?: string;
  primaryImageDesktop?: string;
  primaryImageMobile?: string;
  primaryLargeImage?: string;
  inventoryNumber?: string;
  locationDisplay?: string;
  teaser?: string;
  url?: string;
  from?: string;
}

interface RctResponse {
  page?: string | number;
  pages?: string | number;
  totalObjects?: number;
  itemsPerPage?: number;
  results?: RctRawItem[];
  facets?: Record<string, unknown>;
}

export interface RctItem {
  id: number;
  title: string;
  type: string | null;
  creator: string | null;
  creationDate: string | null;
  inventoryNumber: string | null;
  location: string | null;
  description: string | null;
  thumbnailUrl: string | null;
  imageUrl: string | null;
  itemUrl: string;
  hasImage: boolean;
}

export interface RctSearchResult {
  items: RctItem[];
  total: number;
  page: number;
  rows: number;
  totalPages: number;
  hasNextPage: boolean;
  query: string;
  onlyWithImages: boolean;
}

function absoluteImage(value?: string): string | null {
  if (!value) return null;
  const normalized = value.startsWith("//") ? `https:${value}` : value.startsWith("/") ? `https://col.rct.uk${value}` : value;
  try {
    const url = new URL(normalized);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function stripHtml(value?: string): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return cleaned || null;
}

function mapItem(raw: RctRawItem): RctItem {
  const id = Number(raw.id) || 0;
  const imageUrl = absoluteImage(raw.primaryLargeImage || raw.primaryImageDesktop || raw.primaryImage);
  const thumb = absoluteImage(raw.primaryImageDesktop || raw.primaryImageMobile || raw.primaryImage || raw.primaryLargeImage);
  const inventoryNumber = raw.inventoryNumber?.trim() || null;
  const itemUrl = raw.url
    ? new URL(raw.url, SITE).toString()
    : inventoryNumber
    ? `${SITE}/collection/${encodeURIComponent(inventoryNumber.replace(/^RCIN\s*/i, ""))}`
    : `${SITE}/collection/search?query=${encodeURIComponent(raw.title || "")}`;
  return {
    id,
    title: raw.title?.trim() || inventoryNumber || `Объект Royal Collection ${id}`,
    type: raw.type?.trim() || null,
    creator: raw.creator?.trim() || null,
    creationDate: raw.creationDate?.trim() || null,
    inventoryNumber,
    location: raw.locationDisplay?.trim() || null,
    description: stripHtml(raw.teaser),
    thumbnailUrl: thumb,
    imageUrl,
    itemUrl,
    hasImage: Boolean(imageUrl),
  };
}

function payload(query: string, page: number, rows: number, onlyWithImages: boolean) {
  return {
    searchTerm: query,
    hasImages: onlyWithImages,
    orderBy: "",
    orderDirection: "desc",
    page,
    searchType: { who: [], what: {}, where: [], when: [], more: {} },
    themeSubject: [],
    objectTypes: [],
    placeOfProduct: [],
    source: [],
    curriculumTheme: [],
    resourceArtist: [],
    relatedRoyalty: [],
    themePeople: [],
    themeType: "",
    whatsOn: [],
    whatsOnDate: "",
    whatsOnEndDateIsPast: false,
    whatsOnAccess: 0,
    excludeNode: "",
    conservationProcesses: [],
    conservationTypes: [],
    exhibitionReference: [],
    residenceReference: [],
    itemsPerPage: rows,
    eventType: "objects",
    whoFor: [],
    resourceType: [],
    parentGroup: 0,
    isPrimaryDomain: false,
  };
}

async function postSearch(query: string, page: number, rows: number, onlyWithImages: boolean): Promise<RctResponse> {
  const body = JSON.stringify(payload(query, page, rows, onlyWithImages));
  const res = await fetch(SEARCH_API, {
    method: "POST",
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
      "Content-Type": "application/json",
      Origin: "https://albert.rct.uk",
      Referer: `https://albert.rct.uk/collection/search?query=${encodeURIComponent(query)}`,
    },
    body,
    signal: AbortSignal.timeout(35_000),
  });
  if (!res.ok) throw new Error(`Royal Collection API ответил HTTP ${res.status}`);
  const data = (await res.json()) as RctResponse;
  if (!Array.isArray(data.results)) throw new Error("Royal Collection вернул неожиданный ответ");
  return data;
}

export async function searchRct(options: {
  query: string;
  page?: number;
  rows?: number;
  onlyWithImages?: boolean;
}): Promise<RctSearchResult> {
  const query = options.query.trim().slice(0, 180);
  const page = Math.max(1, Math.floor(options.page || 1));
  const rows = Math.min(48, Math.max(6, Math.floor(options.rows || 24)));
  const onlyWithImages = options.onlyWithImages !== false;
  const response = await postSearch(query, page, rows, onlyWithImages);
  const items = (response.results || []).map(mapItem);
  const total = Math.max(0, Number(response.totalObjects) || 0);
  const totalPages = Math.max(1, Number(response.pages) || Math.ceil(total / rows));
  return {
    items,
    total,
    page,
    rows,
    totalPages,
    hasNextPage: page < totalPages,
    query,
    onlyWithImages,
  };
}

/**
 * Поиск карточки по Royal Collection Inventory Number (RCIN), который входит
 * в URL публичной страницы. Основной сайт может быть недоступен серверу, поэтому
 * карточку восстанавливаем через официальный search API.
 */
export async function getRctObject(rawId: string): Promise<BookMetadata> {
  const digits = rawId.replace(/^RCIN\s*/i, "").match(/\d{3,}/)?.[0];
  if (!digits) throw new Error("В ссылке Royal Collection не найден номер RCIN.");
  const response = await postSearch(`RCIN ${digits}`, 1, 20, false);
  const raw = (response.results || []).find(
    (item) => item.inventoryNumber?.replace(/\s/g, "").toUpperCase() === `RCIN${digits}`
  );
  if (!raw) throw new Error(`Royal Collection не нашёл точное совпадение для RCIN ${digits}.`);

  const item = mapItem(raw);
  const pages: PageInfo[] = item.imageUrl
    ? [{
        index: 1,
        id: item.inventoryNumber || item.id,
        label: item.title,
        thumbnailUrl: item.thumbnailUrl || item.imageUrl,
        originalUrl: item.imageUrl,
        hdUrl: item.imageUrl,
        mobileUrl: item.thumbnailUrl || item.imageUrl,
      }]
    : [];

  return {
    url: item.itemUrl,
    libraryType: "rct",
    libraryName: "Royal Collection Trust",
    title: item.title,
    author: item.creator || undefined,
    year: item.creationDate || undefined,
    description: item.description || undefined,
    coverUrl: item.thumbnailUrl || undefined,
    totalPages: pages.length,
    pages,
    metaRaw: {
      rctId: item.id,
      inventoryNumber: item.inventoryNumber,
      objectType: item.type,
      location: item.location,
      source: "Royal Collection Trust / col.rct.uk",
      rightsNote: "Права на изображения принадлежат Royal Collection Trust; перед публикацией проверьте условия Picture Library.",
    },
  };
}
