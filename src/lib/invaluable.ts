/**
 * Invaluable — аукционный агрегатор (invaluable.com).
 *
 * Открытый search API подтверждён по JavaScript самого сайта:
 *  GET /search/api/search-results?keyword=…&page=…&upcoming=true|false
 *  SEARCH_BROWSER_PARAMS включает lotCategory, lotSupercategory, upcoming.
 *  Supercategory/category refs взяты из открытого списка категорий Invaluable.
 *
 * Фото доступны с image.invaluable.com; лот подробнее:
 *  GET /api/auctions/lot/{ref}.
 */

const SITE = "https://www.invaluable.com";
const SEARCH_API = `${SITE}/search/api/search-results`;
const LOT_API = `${SITE}/api/auctions/lot`;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
/** Search API возвращает страницы по 200, параметр page начинается с нуля. */
const CHUNK = 200;

export type InvaluableAuctionScope = "upcoming" | "past";

export interface InvaluableCategory {
  ref: string;
  label: string;
  /** Parent/supercategory refs use lotSupercategory; child refs use lotCategory. */
  level: "supercategory" | "category";
  parentRef?: string;
}

/** Основные разделы + подкатегории из живой таксономии Invaluable. */
export const INVALUABLE_CATEGORIES: InvaluableCategory[] = [
  { ref: "URF9IESAHL", label: "Asian Art & Antiques", level: "supercategory" },
  { ref: "WIARM9WZTW", label: "Automobiles, Boats & Airplanes", level: "supercategory" },
  { ref: "BQWOG3FLWY", label: "Collectibles", level: "supercategory" },
  { ref: "HV9SJ0PETO", label: "Decorative Art", level: "supercategory" },
  { ref: "0HV8BV6K8Y", label: "Dolls, Bears & Toys", level: "supercategory" },
  { ref: "WXJEP9TUWL", label: "Estate & Storage", level: "supercategory" },
  { ref: "SG2BIX3JPJ", label: "Fine Art", level: "supercategory" },
  { ref: "66MNH3RVXU", label: "Furniture", level: "supercategory" },
  { ref: "TJYLLGLDKA", label: "Guns & Firearms", level: "supercategory" },
  { ref: "YKGNZXS2MH", label: "Jewelry", level: "supercategory" },
  { ref: "MU8Q47SBT3", label: "Real Estate", level: "supercategory" },
  { ref: "5P1KWJO0ML", label: "Wines & Spirits", level: "supercategory" },

  { ref: "X40D0LU64C", label: "Drawings", level: "category", parentRef: "SG2BIX3JPJ" },
  { ref: "Z3K5WYSB8R", label: "Mixed Media Art", level: "category", parentRef: "SG2BIX3JPJ" },
  { ref: "AF14022FJQ", label: "Paintings", level: "category", parentRef: "SG2BIX3JPJ" },
  { ref: "5FM3GDY2EF", label: "Photography", level: "category", parentRef: "SG2BIX3JPJ" },
  { ref: "QB7AGYS9KO", label: "Posters", level: "category", parentRef: "SG2BIX3JPJ" },
  { ref: "SGERF8GX5G", label: "Prints", level: "category", parentRef: "SG2BIX3JPJ" },
  { ref: "MH70PM0ARM", label: "Sculptures", level: "category", parentRef: "SG2BIX3JPJ" },

  { ref: "V1810UB55N", label: "American Indian Art", level: "category", parentRef: "HV9SJ0PETO" },
  { ref: "W7JLTHSDLU", label: "Ceramics & Pottery", level: "category", parentRef: "HV9SJ0PETO" },
  { ref: "SN06I92UXA", label: "Ethnographic & Indigenous Artifacts", level: "category", parentRef: "HV9SJ0PETO" },
  { ref: "HVPO5ZEMD1", label: "Glass", level: "category", parentRef: "HV9SJ0PETO" },
  { ref: "YIWIKOSRZQ", label: "Greek, Roman & Egyptian Antiquities", level: "category", parentRef: "HV9SJ0PETO" },
  { ref: "G51MM3JCDR", label: "Porcelain & China", level: "category", parentRef: "HV9SJ0PETO" },
  { ref: "HVLGMC4OMS", label: "Silver & Vertu", level: "category", parentRef: "HV9SJ0PETO" },

  { ref: "SD21QYCFQN", label: "Bracelets", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "9OACJQ50M0", label: "Costume Jewelry", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "18N22YFW7F", label: "Earrings", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "OG1XEE04VI", label: "Loose Stones & Beads", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "Q5BUT80T6S", label: "Men's Jewelry", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "7KBYXLPOCW", label: "Men's Watches", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "O62XLMG5L9", label: "Necklaces & Pendants", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "TQ0X13A58C", label: "Pins & Brooches", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "OKRAO7JCZY", label: "Pocket Watches & Accessories", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "QE9HEBWJZR", label: "Rings", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "K9OGPEH0Q1", label: "Vintage Jewelry", level: "category", parentRef: "YKGNZXS2MH" },
  { ref: "WBQ0TKYDMB", label: "Women's Watches", level: "category", parentRef: "YKGNZXS2MH" },

  { ref: "PCM15ZAEJA", label: "Advertising, Paper & Ephemera", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "5FFNCDPPYM", label: "Animation Art", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "U6RB6GC1MM", label: "Antiques", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "EOB7P0TJ34", label: "Autographs", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "NVAZ3UE29G", label: "Books, Maps & Manuscripts", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "SV4INCVA01", label: "Coins, Money & Stamps", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "OKYXW1QPNP", label: "Couture, Fashion & Accessories", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "WNDJ7L05CS", label: "Electronics Collectibles", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "WHUZCHPFAQ", label: "Historical, Political & Space Collectibles", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "WXMDZM23Q2", label: "Memorabilia", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "0EIGHLOFDZ", label: "Military & Wartime Collectibles", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "9RFC2VPWGO", label: "Musical Instruments & Equipment", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "4E71Y757DJ", label: "Natural History Collectibles, Fossils & Minerals", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "5ZZ5EOVHXB", label: "Pens", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "SYHOQE2P4A", label: "Police Collectibles", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "HHO7L7CYWT", label: "Sporting, Fishing & Hunting Collectibles", level: "category", parentRef: "BQWOG3FLWY" },
  { ref: "159SUKPT23", label: "Tools", level: "category", parentRef: "BQWOG3FLWY" },

  { ref: "Q1M0GV0I2V", label: "Beds", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "OQO01MZVPQ", label: "Benches & Stools", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "8RA3GB6FWF", label: "Cabinets, Armoires & Cupboards", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "GPI4WFSDTE", label: "Chairs", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "77XL1D8362", label: "Clocks", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "M6LMPIAVCG", label: "Decor & Accessories", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "MIYYXXKHP7", label: "Dressers & Vanities", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "XGC3VSBGB1", label: "Lamps & Lights", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "1D7I67OQBU", label: "Mirrors", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "9CP1X2GQ1T", label: "Rugs & Carpets", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "ZG423REXF2", label: "Shelves & Bookcases", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "FRT16H4VXB", label: "Sofas, Couches & Chaises", level: "category", parentRef: "66MNH3RVXU" },
  { ref: "FKAJ7AFLJ9", label: "Tables, Stands & Consoles", level: "category", parentRef: "66MNH3RVXU" },

  { ref: "KEDZ10Y647", label: "Chinese Art & Antiques", level: "category", parentRef: "URF9IESAHL" },
  { ref: "I13Z7CQUX6", label: "Indian & South Asian Art & Antiques", level: "category", parentRef: "URF9IESAHL" },
  { ref: "OY2OUC9LF6", label: "Japanese Art & Antiques", level: "category", parentRef: "URF9IESAHL" },
  { ref: "GEKIBCU9K0", label: "Korean Antiques & Art", level: "category", parentRef: "URF9IESAHL" },
  { ref: "QC1A8YCACY", label: "Southeast Asian Art & Antiques", level: "category", parentRef: "URF9IESAHL" },
];

function headers(): Record<string, string> {
  return {
    "User-Agent": USER_AGENT,
    Accept: "application/json, */*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: `${SITE}/`,
  };
}

export interface InvaluablePhoto {
  thumb: string;
  medium: string;
  large: string;
}

export interface InvaluableLot {
  ref: string;
  title: string;
  description: string | null;
  estimate: string | null;
  price: number | null;
  currency: string | null;
  priceLabel: string | null;
  images: InvaluablePhoto[];
  lotUrl: string;
  house: string | null;
  categories: string[];
  lotNumber: string | null;
  bidCount: number | null;
  eventDate: string | null;
  isSold: boolean;
  isPassed: boolean;
}

export interface InvaluableSearchResult {
  items: InvaluableLot[];
  total: number;
  page: number;
  rows: number;
  totalPages: number;
  hasNextPage: boolean;
  query: string;
  scope: InvaluableAuctionScope;
  category: string | null;
}

function stripHtml(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function firstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    const value = text(candidate);
    if (value) return value;
  }
  return null;
}

function money(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatAmount(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

function houseFromPhoto(url?: string): string | null {
  const match = url?.match(/housePhotos\/([^/]+)\//);
  if (!match) return null;
  try { return decodeURIComponent(match[1].replace(/\+/g, " ")); }
  catch { return match[1]; }
}

function mapLot(view: Record<string, unknown>): InvaluableLot | null {
  const record = view as Record<string, any>;
  const ref = text(record.ref);
  if (!ref) return null;

  const images: InvaluablePhoto[] = [];
  for (const photo of Array.isArray(record.photos) ? record.photos : []) {
    const links = (photo && photo._links) || {};
    const large = text(links.large?.href);
    if (!large) continue;
    images.push({
      large,
      medium: text(links.medium?.href) || large,
      thumb: text(links.thumbnail?.href) || text(links.medium?.href) || large,
    });
  }

  const currency = text(record.currency);
  const estimateLow = money(record.estimateLow);
  const estimateHigh = money(record.estimateHigh);
  const estimate =
    estimateLow != null && estimateHigh != null
      ? `${formatAmount(estimateLow)}–${formatAmount(estimateHigh)}${currency ? ` ${currency}` : ""}`
      : estimateLow != null
      ? `от ${formatAmount(estimateLow)}${currency ? ` ${currency}` : ""}`
      : null;
  const price = money(record.price) ?? money(record.currentBid);
  const symbol = text(record.currencySymbol);
  const priceLabel = price != null ? `${symbol || ""}${formatAmount(price)}${currency ? ` ${currency}` : ""}` : null;

  // Prefer the official Invaluable URL; API may return an AuctionZip partner URL.
  let lotUrl = text(record.url);
  if (lotUrl) {
    try {
      const parsed = new URL(lotUrl);
      parsed.protocol = "https:";
      parsed.hostname = "www.invaluable.com";
      lotUrl = parsed.toString();
    } catch { lotUrl = null; }
  }

  const seller = (record.sellerView || {}) as Record<string, any>;
  const catalog = (record.catalogView || {}) as Record<string, any>;
  const house = firstString(
    seller.sellerName, seller.name, seller.companyName,
    catalog.companyName, catalog.houseName, catalog.location?.companyName
  ) || houseFromPhoto(images[0]?.large);
  const lotNumber = record.lotNumber != null ? `#${record.lotNumber}${text(record.lotNumberExtension) || ""}` : null;
  const eventMs = money(record.eventLocalDate) ?? money(record.eventDate);
  const eventDate = eventMs ? new Date(eventMs).toISOString() : null;

  return {
    ref,
    title: text(record.title) || `Лот ${ref}`,
    description: text(record.description) ? stripHtml(record.description as string).slice(0, 1600) || null : null,
    estimate, price, currency, priceLabel, images,
    lotUrl: lotUrl || `${SITE}/search?query=${encodeURIComponent(ref)}`,
    house,
    categories: Array.isArray(record.categories)
      ? record.categories.map((category: any) => text(category?.name)).filter((name): name is string => Boolean(name))
      : [],
    lotNumber, bidCount: money(record.bidCount), eventDate,
    isSold: record.isSold === true || (record.priceResult != null && record.priceResult !== 0),
    isPassed: record.isPassed === true || record.catalogView?.catalogStatus === "CLOSED",
  };
}

export interface InvaluableSearchOptions {
  keyword: string;
  page?: number;
  rows?: number;
  scope?: InvaluableAuctionScope;
  category?: string | null;
}

export async function searchInvaluable(options: InvaluableSearchOptions): Promise<InvaluableSearchResult> {
  const keyword = options.keyword.trim().slice(0, 200);
  const rows = Math.max(6, Math.min(100, options.rows ?? 24));
  const page = Math.max(1, options.page ?? 1);
  const scope = options.scope === "past" ? "past" : "upcoming";
  const category = options.category?.trim() || null;
  const start = (page - 1) * rows;
  const end = start + rows;
  const firstChunk = Math.floor(start / CHUNK);
  const lastChunk = Math.floor((end - 1) / CHUNK);
  const chunks: Array<{ page?: { totalElements?: number }; itemViewList?: Array<{ itemView?: Record<string, unknown> }> }> = [];

  for (let chunk = firstChunk; chunk <= lastChunk; chunk++) {
    const params = new URLSearchParams({
      keyword: keyword || "art",
      page: String(chunk),
      size: String(CHUNK),
    });

    // Invaluable API accepts upcoming parameter as string boolean
    if (scope === "past") {
      params.set("upcoming", "false");
    }

    if (category) {
      const picked = INVALUABLE_CATEGORIES.find((item) => item.ref === category);
      if (picked?.level === "supercategory") params.set("lotSupercategory", picked.ref);
      else if (picked) {
        params.set("lotCategory", picked.ref);
        if (picked.parentRef) params.set("lotSupercategory", picked.parentRef);
      }
    }

    let parsedData: any = null;
    let lastError: string = "";

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetch(`${SEARCH_API}?${params.toString()}`, {
          headers: headers(),
          signal: AbortSignal.timeout(25000),
        });

        if (response.status === 200) {
          const textBody = await response.text();
          if (textBody.startsWith("{") || textBody.startsWith("[")) {
            parsedData = JSON.parse(textBody);
            break;
          }
        }
        if (response.status === 202 || response.status === 429) {
          lastError = "Invaluable временно ограничил частоту запросов";
        } else {
          lastError = `HTTP ${response.status}`;
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : String(err);
      }
      await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
    }

    if (!parsedData) {
      // If past or filtered search gave empty/202, return an empty result structure
      // rather than crashing the route with 502
      chunks.push({ page: { totalElements: 0 }, itemViewList: [] });
    } else {
      chunks.push(parsedData);
    }
  }

  const total = Number(chunks[0]?.page?.totalElements) || 0;
  const all = chunks.flatMap((chunk) => (Array.isArray(chunk.itemViewList) ? chunk.itemViewList : []));
  const offset = firstChunk * CHUNK;
  const items = all
    .slice(start - offset, end - offset)
    .map((entry) => mapLot(entry?.itemView || {}))
    .filter((lot): lot is InvaluableLot => Boolean(lot));

  const totalPages = Math.max(1, Math.ceil(total / rows));
  return {
    items, total, page, rows, totalPages, hasNextPage: page < totalPages && total > 0,
    query: keyword, scope, category,
  };
}

export async function getInvaluableLot(ref: string): Promise<InvaluableLot> {
  const clean = ref.trim();
  if (!/^[A-Za-z0-9]{4,24}$/.test(clean)) throw new Error("Некорректный ref лота");
  const res = await fetch(`${LOT_API}/${encodeURIComponent(clean)}`, {
    headers: headers(),
    signal: AbortSignal.timeout(25000),
  });
  if (!res.ok) throw new Error(`Invaluable lot API ответил HTTP ${res.status}`);
  const data = (await res.json()) as { itemView?: Record<string, unknown> };
  const lot = mapLot(data?.itemView || {});
  if (!lot) throw new Error("Лот не найден");
  return lot;
}
