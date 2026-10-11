import { and, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { dokumenBooks } from "@/db/schema";
import { resolveDokumenFile, verifyDokumenFile } from "@/lib/dokumen";

/**
 * Поиск словами по dokumen.pub.
 *
 * Как это работает и почему именно так (всё проверено вживую):
 *  - /search?q=… на сайте игнорирует запрос: на «python», «chemistry» и
 *    бессмысленное «zzzqqq» отдаёт один и тот же список 24 «новинок»;
 *  - /category/<slug>?page=N тоже игнорирует страницу (page1 == page2);
 *  - внешние поисковики (Bing, DuckDuckGo, Mojeek, Ecosia, searx, Yandex)
 *    с серверных адресов отдают challenge/403/302, поэтому site:-поиск недоступен;
 *  - НО корневая пагинация dokumen.pub/1 … /19 отдаёт уникальные книги
 *    (пересечение страниц = 0), а /20 уже редиректит — значит потолок 19.
 *
 * Поэтому собираем корпус с рабочих страниц каталога, складываем в PostgreSQL
 * и ищем по нему локально. Корпус накапливается между запросами.
 */

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const SITE = "https://dokumen.pub";
const MAX_CATALOG_PAGE = 19;
/**
 * Каталог сайта сейчас отдаёт ~10 страниц по 24 книги (≈250), дальше редирект.
 * Порог чуть ниже фактического объёма: как только корпус собран полностью,
 * переходим на лёгкое добирание первых страниц (новинки) — и поиск ускоряется.
 */
const FULL_CORPUS_TARGET = 220;

/** То, что видно в листинге сайта (про наличие файла там информации нет). */
export interface DokumenListedBook {
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  sizeLabel: string | null;
  pageUrl: string;
  sourcePage: number;
}

/** Результат поиска — листинг плюс проверенный статус файла. */
export interface DokumenBookItem extends DokumenListedBook {
  /** null — ещё не проверяли; true/false — проверено. */
  hasFile: boolean | null;
  fileUrl: string | null;
}

function decodeOnce(value: string): string {
  return value.replace(/&(amp|lt|gt|quot|apos|nbsp|#\d+|#x[0-9a-f]+);/gi, (_m, code: string) => {
    const c = code.toLowerCase();
    if (c === "amp") return "&";
    if (c === "lt") return "<";
    if (c === "gt") return ">";
    if (c === "quot") return '"';
    if (c === "apos" || c === "nbsp") return " ";
    if (c.startsWith("#x")) {
      const cp = parseInt(c.slice(2), 16);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : " ";
    }
    const cp = parseInt(c.slice(1), 10);
    return Number.isFinite(cp) ? String.fromCodePoint(cp) : " ";
  });
}

/** Мета-теги dokumen.pub закодированы дважды — декодируем до стабильного вида. */
function decode(value: string): string {
  let out = value.replace(/<[^>]+>/g, " ");
  for (let pass = 0; pass < 3; pass += 1) {
    const next = decodeOnce(out);
    if (next === out) break;
    out = next;
  }
  return out.replace(/\s+/g, " ").trim();
}

/** Разбирает листинг dokumen.pub на карточки книг. */
export function parseListing(html: string, sourcePage: number): DokumenListedBook[] {
  const items: DokumenListedBook[] = [];
  const cardRe =
    /<a\s+href="https:\/\/dokumen\.pub\/([a-z0-9\-]+)\.html"[^>]*class="d-block shadow p-3"[^>]*>([\s\S]*?)<\/a>/gi;

  let card: RegExpExecArray | null;
  while ((card = cardRe.exec(html)) !== null) {
    const slug = card[1];
    const body = card[2];

    const title = decode(body.match(/<h6[^>]*>([\s\S]*?)<\/h6>/i)?.[1] || slug);
    const description = decode(
      body.match(/<p[^>]*class="[^"]*text-justify[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1] || ""
    ).slice(0, 600);
    const coverUrl = body.match(/<img[^>]+src="([^"]+)"/i)?.[1] || null;
    const sizeLabel = decode(body.match(/fa-file-o[^>]*><\/i>\s*([^<]+)/i)?.[1] || "").slice(0, 24) || null;

    if (!title) continue;
    items.push({
      slug,
      title: title.slice(0, 400),
      description: description || null,
      coverUrl,
      sizeLabel,
      pageUrl: `${SITE}/${slug}.html`,
      sourcePage,
    });
  }

  return items;
}

async function fetchCatalogPage(page: number): Promise<string | null> {
  const url = page <= 1 ? `${SITE}/` : `${SITE}/${page}`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml,*/*;q=0.8" },
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
    });
    if (res.status >= 300 && res.status < 400) return null; // за пределами каталога
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/**
 * Добирает корпус из каталога сайта и кладёт в БД.
 * Возвращает сколько страниц удалось пройти и сколько книг добавлено.
 */
export async function harvestDokumenBooks(pages: number): Promise<{
  pagesCrawled: number;
  newBooks: number;
  seenBooks: number;
}> {
  const target = Math.max(1, Math.min(pages, MAX_CATALOG_PAGE));
  let pagesCrawled = 0;
  let seenBooks = 0;
  const fresh: DokumenListedBook[] = [];

  for (let page = 1; page <= target; page += 1) {
    const html = await fetchCatalogPage(page);
    if (!html) break; // дошли до конца каталога
    pagesCrawled += 1;

    const items = parseListing(html, page);
    if (!items.length) break;
    seenBooks += items.length;
    fresh.push(...items);
  }

  let newBooks = 0;
  if (fresh.length) {
    const result = await db
      .insert(dokumenBooks)
      .values(
        fresh.map((item) => ({
          slug: item.slug,
          title: item.title,
          description: item.description,
          coverUrl: item.coverUrl,
          sizeLabel: item.sizeLabel,
          pageUrl: item.pageUrl,
          sourcePage: item.sourcePage,
        }))
      )
      .onConflictDoNothing()
      .returning({ slug: dokumenBooks.slug });
    newBooks = result.length;
  }

  return { pagesCrawled, newBooks, seenBooks };
}

export type WordMode = "any" | "all" | "none";

export interface DokumenSearchParams {
  /** Слова, которые должны встречаться (через пробел или запятую). */
  include?: string;
  includeMode?: WordMode;
  /** Слова, которых быть не должно. */
  exclude?: string;
  /** Искать и в описании, а не только в заголовке. */
  searchDescription?: boolean;
  /** Показывать только книги с подтверждённым скачиваемым файлом. */
  onlyWithFile?: boolean;
  page?: number;
  pageSize?: number;
}

function words(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .toLowerCase()
    .split(/[,;]+|\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1);
}

export interface DokumenSearchResult {
  items: DokumenBookItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  corpusSize: number;
  /** Сколько книг проверено на наличие файла и у скольких файл есть. */
  verifiedCount: number;
  withFileCount: number;
  harvested: { pagesCrawled: number; newBooks: number; seenBooks: number } | null;
}

async function countCorpus(): Promise<number> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(dokumenBooks);
  return Number(count) || 0;
}

/** Сколько книг в корпусе уже проверено на наличие файла. */
async function countVerified(): Promise<{ verified: number; withFile: number }> {
  const rows = await db
    .select({
      verified: sql<number>`count(*) filter (where ${dokumenBooks.verifiedAt} is not null)::int`,
      withFile: sql<number>`count(*) filter (where ${dokumenBooks.hasFile} = true)::int`,
    })
    .from(dokumenBooks);
  return { verified: Number(rows[0]?.verified) || 0, withFile: Number(rows[0]?.withFile) || 0 };
}

/**
 * Пакетная проверка наличия файла у непроверенных книг корпуса.
 *
 * Viewer и кнопка скачивания у dokumen.pub независимы: min.pdf в просмотрщике
 * не всегда означает, что Download File не сработает. Поэтому прямой PDF
 * помечаем как доступный, очередь — как «не подтверждено», но не как «удалён».
 * За один поиск допроверяем небольшую пачку и постепенно пополняем разметку.
 */
export async function verifyBatch(limit: number): Promise<number> {
  const pending = await db
    .select({ slug: dokumenBooks.slug, pageUrl: dokumenBooks.pageUrl })
    .from(dokumenBooks)
    .where(isNull(dokumenBooks.verifiedAt))
    .limit(limit);

  if (!pending.length) return 0;

  await Promise.all(
    pending.map(async (book) => {
      try {
        const res = await fetch(book.pageUrl, {
          headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
          redirect: "follow",
          signal: AbortSignal.timeout(9000),
        });
        if (!res.ok) {
          if (res.status === 404) {
            // Только реальный 404 страницы книги считаем подтверждённым отсутствием.
            await db
              .update(dokumenBooks)
              .set({ hasFile: false, verifiedAt: new Date() })
              .where(eq(dokumenBooks.slug, book.slug));
          }
          // 403/429/5xx — временная/серверная блокировка, оставляем unknown.
          return;
        }
        const html = await res.text();
        const resolution = resolveDokumenFile(html, book.pageUrl);
        // Даже наличие viewer URL не доказывает, что это настоящий файл:
        // проверяем первые 5 байт. Queue-flow оставляем неизвестным, не false.
        const hasFile =
          resolution.hasFile === true
            ? await verifyDokumenFile(resolution.fileUrl, book.pageUrl)
            : resolution.hasFile;
        await db
          .update(dokumenBooks)
          .set({ hasFile, fileUrl: resolution.fileUrl, verifiedAt: new Date() })
          .where(eq(dokumenBooks.slug, book.slug));
      } catch {
        // сеть нестабильна — оставим книгу непроверенной до следующего раза
      }
    })
  );

  return pending.length;
}

export async function searchDokumenBooks(params: DokumenSearchParams): Promise<DokumenSearchResult> {
  const include = words(params.include);
  const exclude = words(params.exclude);
  const mode: WordMode = params.includeMode ?? "any";
  const inDescription = params.searchDescription !== false;
  const page = Math.max(1, params.page ?? 1);
  const pageSize = Math.max(10, Math.min(100, params.pageSize ?? 24));

  const corpusBefore = await countCorpus();

  // Пока корпус не заполнен — проходим весь доступный каталог (19 страниц ≈ 456 книг).
  // Дальше берём лишь первые страницы, чтобы подхватывать новинки и не тормозить поиск.
  const needFullHarvest = corpusBefore < FULL_CORPUS_TARGET;
  const harvested = await harvestDokumenBooks(needFullHarvest ? MAX_CATALOG_PAGE : 2).catch(() => null);

  const corpusSize = needFullHarvest ? await countCorpus() : corpusBefore + (harvested?.newBooks ?? 0);

  // Допроверяем небольшую пачку книг, чтобы выдача постепенно размечалась.
  await verifyBatch(params.onlyWithFile ? 14 : 8).catch(() => 0);

  // Сужаем SQL теми же семантиками, что и итоговая проверка:
  // any → OR по словам, all → AND, none → не сужаем выборку и исключаем ниже.
  const wordConditions = include.map((word) =>
    inDescription
      ? or(ilike(dokumenBooks.title, `%${word}%`), ilike(dokumenBooks.description, `%${word}%`))
      : ilike(dokumenBooks.title, `%${word}%`)
  );
  const candidateCondition =
    mode === "all" && wordConditions.length
      ? and(...wordConditions)
      : mode === "any" && wordConditions.length
      ? or(...wordConditions)
      : undefined;

  const rows = await db
    .select()
    .from(dokumenBooks)
    .where(candidateCondition)
    .orderBy(desc(dokumenBooks.discoveredAt), dokumenBooks.slug)
    .limit(2000);

  const matched = rows.filter((row) => {
    const title = row.title.toLowerCase();
    const description = (row.description || "").toLowerCase();
    const haystack = inDescription ? `${title} ${description}` : title;

    if (include.length) {
      if (mode === "all" && !include.every((w) => haystack.includes(w))) return false;
      if (mode === "any" && !include.some((w) => haystack.includes(w))) return false;
      if (mode === "none" && include.some((w) => haystack.includes(w))) return false;
    }
    if (exclude.length && exclude.some((w) => haystack.includes(w))) return false;
    if (params.onlyWithFile && row.hasFile !== true) return false;
    return true;
  });

  const total = matched.length;
  const start = (page - 1) * pageSize;
  const items: DokumenBookItem[] = matched.slice(start, start + pageSize).map((row) => ({
    slug: row.slug,
    title: row.title,
    description: row.description,
    coverUrl: row.coverUrl,
    sizeLabel: row.sizeLabel,
    pageUrl: row.pageUrl,
    sourcePage: row.sourcePage,
    hasFile: row.hasFile ?? null,
    fileUrl: row.fileUrl ?? null,
  }));

  const { verified, withFile } = await countVerified();

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    corpusSize,
    verifiedCount: verified,
    withFileCount: withFile,
    harvested,
  };
}

export const DOKUMEN_CATALOG_LIMIT = MAX_CATALOG_PAGE;
