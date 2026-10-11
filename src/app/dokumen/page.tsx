"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Loader2,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Library,
  Ban,
  Info,
  Download,
  Globe,
} from "lucide-react";
import type { WordMode } from "@/lib/dokumen-search";

interface BookItem {
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  sizeLabel: string | null;
  pageUrl: string;
  hasFile: boolean | null;
  fileUrl: string | null;
}

interface SearchResult {
  items: BookItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  corpusSize: number;
  verifiedCount: number;
  withFileCount: number;
  harvested: { pagesCrawled: number; newBooks: number; seenBooks: number } | null;
}

const MODES: { value: WordMode; label: string; hint: string }[] = [
  { value: "any", label: "включает любое", hint: "достаточно одного из слов" },
  { value: "all", label: "включает все", hint: "должны встретиться все слова" },
  { value: "none", label: "только без этих слов", hint: "исключает книги со словами" },
];

const PAGE_SIZES = [12, 24, 48, 96];

export default function DokumenPage() {
  const [include, setInclude] = useState("");
  const [exclude, setExclude] = useState("");
  const [includeMode, setIncludeMode] = useState<WordMode>("any");
  const [searchDescription, setSearchDescription] = useState(true);
  const [onlyWithFile, setOnlyWithFile] = useState(false);
  const [pageSize, setPageSize] = useState(24);
  const [page, setPage] = useState(1);

  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [isDeepSearching, setIsDeepSearching] = useState(false);
  const [deepInfo, setDeepInfo] = useState<string | null>(null);

  const run = useCallback(
    async (targetPage: number, overrides?: { pageSize?: number; onlyWithFile?: boolean }) => {
      setIsLoading(true);
      setError(null);
      setStarted(true);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60_000);

      try {
        const res = await fetch("/api/dokumen/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            include,
            includeMode,
            exclude,
            searchDescription,
            onlyWithFile: overrides?.onlyWithFile ?? onlyWithFile,
            page: targetPage,
            pageSize: overrides?.pageSize ?? pageSize,
          }),
        });
        const text = await res.text();
        let data: { success?: boolean; error?: string; result?: SearchResult };
        try {
          data = JSON.parse(text);
        } catch {
          throw new Error(`Сервер вернул не-JSON (HTTP ${res.status}). Обновите страницу.`);
        }
        if (!res.ok || !data.success || !data.result) {
          throw new Error(data.error || "Не удалось выполнить поиск");
        }
        setResult(data.result);
        setPage(targetPage);
      } catch (err: unknown) {
        setError(
          err instanceof DOMException && err.name === "AbortError"
            ? "Поиск занял больше минуты — dokumen.pub сейчас медленный. Попробуйте ещё раз."
            : err instanceof Error
            ? err.message
            : String(err)
        );
      } finally {
        clearTimeout(timer);
        setIsLoading(false);
      }
    },
    [include, includeMode, exclude, searchDescription, onlyWithFile, pageSize]
  );

  // Первый заход — сразу показываем корпус, чтобы раздел не был пустым.
  useEffect(() => {
    void run(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Глубокий поиск по всему сайту через архивный индекс (Wayback CDX) —
   * тот же принцип, каким внешние ассистенты находят прямые ссылки.
   * Найденное попадает в локальный каталог, затем перезапускается обычный поиск.
   */
  const runDeepSearch = useCallback(async () => {
    if (!include.trim()) {
      setDeepInfo("Для глубокого поиска введите слова в поле «Искать слова».");
      return;
    }
    setIsDeepSearching(true);
    setDeepInfo(null);
    setError(null);
    try {
      const res = await fetch("/api/dokumen/deep-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: include }),
        signal: AbortSignal.timeout(180_000),
      });

      // Гарантируем JSON: если пришёл HTML (прокси отдал страницу ошибки),
      // показываем понятное сообщение вместо «Unexpected token '<'».
      const text = await res.text();
      let data: { success?: boolean; error?: string; result?: { books?: unknown[] } };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(
          `Сервер вернул не-JSON ответ (HTTP ${res.status}). Скорее всего прокси предпросмотра прервал долгий запрос к архивному индексу — нажмите кнопку ещё раз.`
        );
      }
      if (!res.ok || !data.success) throw new Error(data.error || "Глубокий поиск не удался");
      const found = Array.isArray(data.result?.books) ? data.result.books.length : 0;
      setDeepInfo(
        found
          ? `Архивный индекс нашёл ${found} книг по всему сайту — они добавлены в каталог, показываю результаты.`
          : "Архивный индекс не нашёл книг по этим словам. Попробуйте другие слова (индекс ищет по латинице названий)."
      );
      if (found) await run(1);
    } catch (err: unknown) {
      setDeepInfo(
        err instanceof DOMException && err.name === "AbortError"
          ? "Архивный индекс не ответил за 70 секунд — он бывает медленным, попробуйте ещё раз."
          : `Глубокий поиск не удался: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setIsDeepSearching(false);
    }
  }, [include, run]);

  const openBook = (book: BookItem) => {
    // Передаём книгу в основной поток приложения: инспекция + скачивание PDF.
    // Если файл уже подтверждён проверкой, берём его адрес напрямую — это
    // надёжнее, чем пересобирать ссылку по шаблону.
    const target = book.hasFile === true && book.fileUrl ? book.fileUrl : book.pageUrl;
    window.location.href = `/?dokumen=${encodeURIComponent(target)}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(253,247,241,0.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)] shrink-0">
            <ArrowLeft className="w-4 h-4" /> Клубок
          </Link>
          <h1 className="font-display text-base sm:text-xl font-bold text-[var(--plum)] flex items-center gap-2 truncate">
            <Library className="w-5 h-5 text-[var(--rose-600)] shrink-0" />
            Поиск по dokumen.pub
          </h1>
          <Link href="/portraits" className="chip shrink-0 hidden sm:inline-flex">
            Портреты Госкаталога
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3.5 text-xs text-[var(--plum-soft)] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[var(--rose-600)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Собственный поиск на dokumen.pub не работает: при любом запросе сайт отдаёт один и тот
            же список «новинок». Поэтому котёнок собирает собственный каталог с рабочих страниц
            сайта и ищет по нему словами — заголовок и описание, с режимами «включает любое»,
            «включает все» и исключением слов.
          </p>
        </div>

        {/* Фильтры */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(1);
          }}
          className="card-boudoir p-4 sm:p-5 space-y-4"
        >
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--plum-soft)] flex items-center gap-1.5">
                <Search className="w-3 h-3" /> Искать слова
              </label>
              <input
                type="text"
                value={include}
                onChange={(e) => setInclude(e.target.value)}
                placeholder="python, patterns, design"
                className="input-boudoir w-full px-3 py-2.5 rounded-xl text-xs"
              />
              <div className="flex flex-wrap gap-1">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    title={m.hint}
                    onClick={() => setIncludeMode(m.value)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold tile-rose ${
                      includeMode === m.value ? "is-active" : ""
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--plum-soft)] flex items-center gap-1.5">
                <Ban className="w-3 h-3" /> Исключить слова
              </label>
              <input
                type="text"
                value={exclude}
                onChange={(e) => setExclude(e.target.value)}
                placeholder="например: hungaropress, manual"
                className="input-boudoir w-full px-3 py-2.5 rounded-xl text-xs"
              />
              <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--plum-soft)] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={searchDescription}
                  onChange={(e) => setSearchDescription(e.target.checked)}
                  className="w-3.5 h-3.5 accent-[#c05e7d]"
                />
                искать и в описании, не только в заголовке
              </label>
              <label
                className="flex items-center gap-2 text-[11px] font-bold text-[var(--plum-soft)] cursor-pointer"
                title="Оставляет книги, чей прямой PDF сервер смог подтвердить. Книги с загрузкой через очередь могут иметь статус «не подтверждено», даже если у вас в браузере скачивание работает."
              >
                <input
                  type="checkbox"
                  checked={onlyWithFile}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setOnlyWithFile(next);
                    void run(1, { onlyWithFile: next });
                  }}
                  className="w-3.5 h-3.5 accent-[#c05e7d]"
                />
                только с подтверждённым PDF
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 pt-1">
            <div className="space-y-1">
              <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] block">
                На странице
              </label>
              <select
                value={pageSize}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setPageSize(next);
                  void run(1, { pageSize: next });
                }}
                className="input-boudoir px-2 py-2 rounded-lg text-xs"
              >
                {PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n} книг
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-rose flex-1 sm:flex-none px-6 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Искать
            </button>
            <button
              type="button"
              onClick={() => void runDeepSearch()}
              disabled={isDeepSearching || !include.trim()}
              title="Ищет по всему историческому индексу сайта через архив — как это делают внешние ассистенты. Занимает 15–60 секунд."
              className="btn-ghost-rose flex-1 sm:flex-none px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isDeepSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
              По всему сайту
            </button>
            <button
              type="button"
              onClick={() => {
                setInclude("");
                setExclude("");
                setIncludeMode("any");
                setSearchDescription(true);
                setDeepInfo(null);
              }}
              className="btn-ghost-rose px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Сбросить
            </button>
          </div>

          {deepInfo && (
            <div className="rounded-xl bg-[var(--rose-100)] border border-[var(--rose-200)] px-3 py-2.5 text-[11px] text-[var(--plum-soft)] leading-relaxed">
              {deepInfo}
            </div>
          )}
          {isDeepSearching && (
            <div className="rounded-xl bg-white/80 border border-[var(--border)] px-3 py-2.5 text-[11px] text-[var(--plum-soft)] flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--rose-600)]" />
              Котёнок перебирает архивный индекс всего сайта — это занимает до минуты, не закрывайте страницу…
            </div>
          )}
        </form>

        {/* Состояние */}
        {isLoading && (
          <div className="flex items-center justify-center gap-2 py-16 text-[var(--rose-700)] text-sm font-bold">
            <Loader2 className="w-5 h-5 animate-spin" /> Котёнок листает каталог dokumen.pub…
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-[#f3c3bb] bg-[#fdf0ed] p-4 text-xs text-[#9a4a3e] space-y-3">
            <p className="leading-relaxed">{error}</p>
            <button
              onClick={() => void run(page)}
              className="px-3.5 py-2 rounded-xl bg-[#c05e7d] text-white font-bold text-[11px] flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Повторить
            </button>
          </div>
        )}

        {!isLoading && !error && result && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-soft)]">
              <span>
                Найдено: <strong className="text-[var(--plum)]">{result.total}</strong>
                {include.trim() && <> по словам «{include.trim()}»</>}
                {exclude.trim() && <> без «{exclude.trim()}»</>}
                {" · "}в каталоге котёнка {result.corpusSize.toLocaleString("ru-RU")} книг
                {result.harvested?.newBooks ? ` (+${result.harvested.newBooks} новых)` : ""}
                {" · "}проверено на файл {result.verifiedCount}
                {result.withFileCount ? `, доступно ${result.withFileCount}` : ""}
              </span>
              <a
                href="https://dokumen.pub/"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--rose-700)] font-bold hover:underline"
              >
                Открыть dokumen.pub →
              </a>
            </div>

            {result.items.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2 border-2 border-dashed border-[var(--rose-200)] rounded-3xl bg-[rgba(253,231,224,0.35)] text-center px-4">
                <BookOpen className="w-9 h-9 text-[var(--rose-300)]" />
                <p className="font-display text-sm font-bold text-[var(--plum)]">Ничего не нашлось</p>
                <p className="text-xs text-[var(--ink-soft)] max-w-md leading-relaxed">
                  В локальном каталоге по этим словам пусто. Попробуйте кнопку{" "}
                  <strong className="text-[var(--rose-700)]">«По всему сайту»</strong> — она ищет по
                  архивному индексу всего dokumen.pub (как внешние ассистенты) и находит на порядки
                  больше книг.
                </p>
                {include.trim() && (
                  <button
                    onClick={() => void runDeepSearch()}
                    disabled={isDeepSearching}
                    className="btn-rose px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 disabled:opacity-60"
                  >
                    {isDeepSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5" />}
                    Искать «{include.trim().slice(0, 30)}» по всему сайту
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {result.items.map((book) => (
                  <button
                    key={book.slug}
                    type="button"
                    onClick={() => void openBook(book)}
                    className="group card-boudoir p-3 text-left flex flex-col gap-2 hover:-translate-y-1 transition-transform"
                    title="Открыть и скачать книгу"
                  >
                    <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-[var(--rose-100)] border border-[var(--border)] flex items-center justify-center">
                      {book.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={book.coverUrl}
                          alt={book.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <BookOpen className="w-7 h-7 text-[var(--ink-soft)]" />
                      )}
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[rgba(74,42,56,0.82)] text-white text-[9px] font-bold flex items-center gap-1">
                        <Download className="w-2.5 h-2.5" /> PDF
                      </span>
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-[var(--plum)] line-clamp-2 leading-snug group-hover:text-[var(--rose-700)]">
                        {book.title}
                      </h4>
                      {book.description && (
                        <p className="text-[10px] text-[var(--ink-soft)] line-clamp-2 leading-relaxed">
                          {book.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-1">
                        {book.sizeLabel && (
                          <span className="chip !text-[9px] !py-0.5">{book.sizeLabel}</span>
                        )}
                        {book.hasFile === true && (
                          <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded-md bg-[#e8f2e9] text-[#3f6b4a] border border-[#c6ddc9]">
                            файл есть
                          </span>
                        )}
                        {book.hasFile === false && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-[#f6efea] text-[#8a6a52] border border-[#e4d5c8]"
                            title="Сайт не отдал страницу или кнопку загрузки при последней проверке. Это не гарантирует, что файл недоступен в вашем браузере."
                          >
                            источник не ответил
                          </span>
                        )}
                        {book.hasFile === null && (
                          <span
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-white text-[var(--ink-soft)] border border-[var(--border)]"
                            title="Встроенный просмотрщик не дал прямой PDF. Кнопка DOWNLOAD FILE может выдавать его через очередь — котёнок попробует при скачивании."
                          >
                            загрузка через очередь
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Пагинация */}
            <div className="flex items-center justify-center gap-3 pt-4">
              <button
                onClick={() => void run(page - 1)}
                disabled={page <= 1 || isLoading}
                className="btn-ghost-rose p-2.5 rounded-xl disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-[var(--plum)]">
                Страница {page} из {result.totalPages}
              </span>
              <button
                onClick={() => void run(page + 1)}
                disabled={page >= result.totalPages || isLoading}
                className="btn-rose p-2.5 rounded-xl disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}

        {!isLoading && !error && !result && started && (
          <div className="text-center py-12 text-xs text-[var(--ink-soft)]">Нажмите «Искать»</div>
        )}
      </main>
    </div>
  );
}
