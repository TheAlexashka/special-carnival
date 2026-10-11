/** Public SSR search integration for Staatliche Museen zu Berlin (SMB).
 *
 * Unlike goskatalog, the portal renders search results on the server at
 * https://search.smb.museum/en?q=<term>&page=<number>. It therefore works
 * without an API key, private endpoint, or Russian proxy. Result cards contain
 * object URLs and public thumbnail paths; object pages expose original JPGs.
 */

const SMB_BASE = "https://search.smb.museum";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36";

export interface SmbSearchItem {
  objectId: string;
  title: string;
  thumbnailUrl?: string;
  objectUrl: string;
  objectType?: string;
  collection?: string;
}

export interface SmbSearchResult {
  items: SmbSearchItem[];
  query: string;
  page: number;
  total: number | null;
  totalPages: number | null;
  hasNextPage: boolean;
}

function decodeHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsolute(path: string | undefined): string | undefined {
  if (!path) return undefined;
  try {
    return new URL(path.replace(/&amp;/g, "&"), SMB_BASE).toString();
  } catch {
    return undefined;
  }
}

/** Extract result cards from the SSR markup; duplicates are removed by object ID. */
function parseSearchResults(html: string, query: string): SmbSearchItem[] {
  const result: SmbSearchItem[] = [];
  const seen = new Set<string>();
  const linkRegex = /href="\/(?:en\/)?object\/(obj-\d+)(?:\?[^"']*)?"/gi;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(html)) !== null) {
    const objectId = match[1];
    if (seen.has(objectId)) continue;
    seen.add(objectId);

    // The first card link points at thumbnail; take its local markup block.
    const block = html.slice(match.index, Math.min(html.length, match.index + 3500));
    const image = block.match(/<img[^>]+src="([^"]*\/media\/images\/thumbs\/medium\/[^"']+)"[^>]*alt="([^"]*)"/i);
    const title = decodeHtml(
      block.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)?.[1] || image?.[2] || objectId
    );
    const objectType = decodeHtml(
      block.match(/Object type:<\/span>\s*([\s\S]*?)<\/p>/i)?.[1] || ""
    );
    const collection = decodeHtml(
      block.match(/Collections:<\/span>\s*([\s\S]*?)<\/p>/i)?.[1] || ""
    );

    result.push({
      objectId,
      title,
      thumbnailUrl: toAbsolute(image?.[1]),
      objectUrl: `${SMB_BASE}/en/object/${objectId}`,
      objectType: objectType || undefined,
      collection: collection || undefined,
    });
  }

  return result;
}

function parseTotal(html: string): number | null {
  // Nuxt serializes pagination as {"artworks":…,"total":1095,"start":…}.
  const match = html.match(/"artworks":\d+,"total":(\d+),"start":\d+,"limit":\d+/);
  return match ? Number(match[1]) : null;
}

export async function searchSmb(query: string, page = 1): Promise<SmbSearchResult> {
  const cleanQuery = query.trim().slice(0, 180);
  const currentPage = Math.max(1, Math.floor(page));
  const url = new URL("/en", SMB_BASE);
  if (cleanQuery) url.searchParams.set("q", cleanQuery);
  if (currentPage > 1) url.searchParams.set("page", String(currentPage));

  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
      "Accept-Language": "en,de;q=0.8",
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`SMB Collections Online ответил HTTP ${res.status}`);

  const html = await res.text();
  const items = parseSearchResults(html, cleanQuery);
  const total = parseTotal(html);
  // У портала 10 объектов на SSR-странице (confirmed from SSR markup / pagination).
  const pageSize = Math.max(1, items.length || 10);
  const totalPages = total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;

  return {
    items,
    query: cleanQuery,
    page: currentPage,
    total,
    totalPages,
    hasNextPage: totalPages ? currentPage < totalPages : items.length === pageSize,
  };
}
