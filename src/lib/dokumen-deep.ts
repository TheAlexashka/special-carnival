import { db } from "@/db";
import { dokumenBooks } from "@/db/schema";

/**
 * «Глубокий» поиск по dokumen.pub — тем же способом, каким ChatGPT находит
 * прямые ссылки: через поисковый индекс, а не через сломанный поиск сайта.
 *
 * Обычные движки (Bing/DDG/searx) закрыты для серверов антиботом, зато
 * Wayback Machine CDX API открыт и хранит исторический индекс URL всего
 * dokumen.pub. Слаг каждой книги — это её название латиницей, поэтому поиск
 * слов по слагам = полнотекстовый поиск по названиям за всю историю сайта
 * (а не только по ~250 книгам из живого каталога главной страницы).
 *
 * Проверено вживую:
 *  - `filter=urlkey:.*python.*` → сотни книг («100 Days of Coding in Python»…);
 *  - Java-regex lookahead работает: `(?=.*python)(?=.*pattern).*` → пересечение слов;
 *  - ответ занимает 15–45 секунд, поэтому результаты кешируются в памяти и в БД.
 */

const CDX_ENDPOINT = "https://web.archive.org/cdx/search/cdx";
/** С identity замер: 19,9 и 46,8 с — без него undici зависает на gzip-потоке архива. */
const CDX_TIMEOUT_MS = 70_000;
const CDX_ATTEMPTS = 3;
const CDX_RETRY_DELAY_MS = 2000;
const CACHE_TTL_MS = 60 * 60_000;
/** Умеренный лимит: архивный индекс отвечает тем дольше, чем больше просят. */
const MAX_RESULTS = 60;

export interface DeepFoundBook {
  slug: string;
  title: string;
  pageUrl: string;
}

interface CacheEntry {
  at: number;
  books: DeepFoundBook[];
}

const globalRef = globalThis as typeof globalThis & { __dokumenDeepCache?: Map<string, CacheEntry> };
const cache: Map<string, CacheEntry> = globalRef.__dokumenDeepCache ?? new Map();
if (!globalRef.__dokumenDeepCache) globalRef.__dokumenDeepCache = cache;

/** Слова запроса: латиница/цифры, 2+ символа. Кириллицу транслитерируем — слаги латинские. */
function prepareWords(query: string): string[] {
  const translit: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i",
    й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t",
    у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "",
    э: "e", ю: "yu", я: "ya",
  };
  return query
    .toLowerCase()
    .split("")
    .map((ch) => translit[ch] ?? ch)
    .join("")
    .split(/[^a-z0-9]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2)
    .slice(0, 5);
}

/** Слаг → человекочитаемое название: слова с заглавной, ISBN и хвосты убраны. */
export function slugToTitle(slug: string): string {
  const words = slug
    .replace(/-(\d{9,13}|\d+nbsped|[a-z]-\d{6,})/g, " ")
    .split("-")
    .filter(Boolean)
    .filter((w) => !/^\d{6,}$/.test(w));
  const small = new Set(["a", "an", "the", "of", "in", "on", "to", "and", "or", "for", "with", "by", "at"]);
  return words
    .map((w, i) => (i > 0 && small.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .slice(0, 300);
}

function buildFilterRegex(words: string[]): string {
  if (words.length === 1) return `urlkey:.*${words[0]}.*`;
  // Java-regex lookahead: все слова в любом порядке.
  return `urlkey:${words.map((w) => `(?=.*${w})`).join("")}.*`;
}

async function queryCdx(words: string[]): Promise<string[]> {
  const params = new URLSearchParams({
    url: "dokumen.pub/*",
    output: "text",
    fl: "original",
    collapse: "urlkey",
    limit: String(MAX_RESULTS * 4), // с запасом: отфильтруем /download/ и дубли
    filter: buildFilterRegex(words),
  });

  const res = await fetch(`${CDX_ENDPOINT}?${params.toString()}`, {
    headers: { "User-Agent": "KlubokBookFinder/1.0 (research; contact via app)" },
    signal: AbortSignal.timeout(CDX_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Архивный индекс ответил HTTP ${res.status}`);
  const text = await res.text();
  return text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

/**
 * Ищет книги по всему историческому индексу dokumen.pub.
 * Найденное сохраняется в локальный каталог (sourcePage = 0 — «глубокий индекс»),
 * чтобы скачивание и повторный поиск работали как обычно.
 */
/** Запасной поиск по локальному каталогу, когда архив перегружен. */
async function searchLocalFallback(words: string[]): Promise<DeepFoundBook[]> {
  try {
    const rows = await db.select().from(dokumenBooks).limit(2000);
    const lower = words.map((w) => w.toLowerCase());
    return rows
      .filter((row) => {
        const haystack = `${row.slug} ${row.title}`.toLowerCase();
        return lower.some((w) => haystack.includes(w));
      })
      .slice(0, MAX_RESULTS)
      .map((row) => ({ slug: row.slug, title: row.title, pageUrl: row.pageUrl }));
  } catch {
    return [];
  }
}

export async function deepSearchDokumen(query: string): Promise<{
  books: DeepFoundBook[];
  fromCache: boolean;
  indexedWords: string[];
}> {
  const words = prepareWords(query);
  if (!words.length) return { books: [], fromCache: false, indexedWords: [] };

  const cacheKey = words.join("+");
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return { books: cached.books, fromCache: true, indexedWords: words };
  }
  // TODO(#deep-cache-empty): кешировать и пустой результат на короткий срок,
  // чтобы не дёргать перегруженный архив повторно одними и теми же словами.

  let urls: string[] = [];
  try {
    urls = await queryCdx(words);
  } catch (err: unknown) {
    // Архив регулярно перегружен (503/504). Фолбэк: ищем по уже собранному
    // локальному каталогу — он содержит и книги, найденные прошлыми глубокими
    // поисками (sourcePage = 0), так что результат всё равно осмысленный.
    const fallback = await searchLocalFallback(words);
    if (fallback.length) {
      return { books: fallback, fromCache: false, indexedWords: words };
    }
    throw err;
  }

  const seen = new Set<string>();
  const books: DeepFoundBook[] = [];
  for (const raw of urls) {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      continue;
    }
    const path = parsed.pathname;
    // Только страницы книг: без download/qdownload/cdownload/картинок/категорий.
    const match = path.match(/^\/([a-z0-9][a-z0-9-]{5,})\.html?$/i);
    if (!match) continue;
    const slug = match[1].toLowerCase();
    if (/^(download|qdownload|cdownload|category|search|login|register)$/.test(slug)) continue;
    if (seen.has(slug)) continue;
    seen.add(slug);
    books.push({
      slug,
      title: slugToTitle(slug),
      pageUrl: `https://dokumen.pub/${slug}.html`,
    });
    if (books.length >= MAX_RESULTS) break;
  }

  // Пишем найденное в локальный каталог: дальше работает обычный поток
  // (карточка, проверка файла, скачивание).
  if (books.length) {
    await db
      .insert(dokumenBooks)
      .values(
        books.map((book) => ({
          slug: book.slug,
          title: book.title,
          description: null,
          coverUrl: `https://img.dokumen.pub/img/200x200/${book.slug}.jpg`,
          sizeLabel: null,
          pageUrl: book.pageUrl,
          sourcePage: 0,
        }))
      )
      .onConflictDoNothing()
      .catch(() => undefined);
  }

  if (cache.size > 100) cache.clear();
  cache.set(cacheKey, { at: Date.now(), books });

  return { books, fromCache: false, indexedWords: words };
}
