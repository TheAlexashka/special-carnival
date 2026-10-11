import type { BookMetadata } from "./types";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/**
 * НЭБ (rusneb.ru).
 *
 * У портала стоит защита от серверных запросов: каталог и внутренние API
 * отвечают 403 на любой запрос не из браузера пользователя, а вьюер —
 * это пустая SPA-оболочка без ссылок в HTML. Поэтому автоматически забрать
 * книгу мы не можем и честно объясняем это пользователю.
 *
 * Зато у открытых книг НЭБ есть официальная кнопка «Скачать PDF», и если
 * пользователь принесёт прямую ссылку на файл, мы с радостью её заберём.
 */

export function isRusnebFileUrl(rawUrl: string): boolean {
  return (
    /rusneb\.ru\/.*\.pdf(\?|$)/i.test(rawUrl) ||
    /rusneb\.ru\/.*(download|getfile|filestore)/i.test(rawUrl)
  );
}

export async function parseRusnebUrl(targetUrl: string): Promise<BookMetadata> {
  const cleanUrl = targetUrl.split("#")[0].trim();

  // Case 1: user already copied the direct PDF link from the НЭБ viewer.
  if (isRusnebFileUrl(cleanUrl)) {
    const head = await fetch(cleanUrl, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/pdf,*/*",
        Referer: "https://rusneb.ru/",
      },
      signal: AbortSignal.timeout(20000),
    }).catch(() => null);

    if (head?.ok) {
      const idMatch = cleanUrl.match(/([0-9A-F_-]{8,})/i);
      return {
        url: cleanUrl,
        libraryType: "rusneb",
        libraryName: "НЭБ — Национальная электронная библиотека",
        title: `Книга НЭБ ${idMatch ? idMatch[1].slice(0, 32) : ""}`.trim(),
        totalPages: 1,
        directPdfUrl: cleanUrl,
        pages: [
          {
            index: 1,
            label: "Книга целиком (PDF)",
            thumbnailUrl: "",
            originalUrl: cleanUrl,
            hdUrl: cleanUrl,
            mobileUrl: cleanUrl,
          },
        ],
      };
    }

    throw new Error(
      "НЭБ не отдала этот файл нашему серверу (ответ 403). Скачайте книгу кнопкой «Скачать PDF» прямо в читалке НЭБ — там она открыта и бесплатна."
    );
  }

  // Case 2: a catalogue page — blocked for server-side fetching.
  throw new Error(
    "НЭБ (rusneb.ru) блокирует запросы не из браузера: каталог и её API отвечают 403, а читалка собирается скриптами уже на вашем устройстве. " +
      "Хорошая новость: у книг общественного достояния в НЭБ есть официальная кнопка «Скачать PDF» — она бесплатна и работает на Android. " +
      "Откройте книгу → «Читать» → «Скачать PDF». Если скопируете прямую ссылку на .pdf, вставьте её сюда — котёнок заберёт файл и положит в историю."
  );
}
