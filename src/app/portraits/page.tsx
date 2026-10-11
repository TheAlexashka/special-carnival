"use client";

import React, { useCallback, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ImageIcon,
  Loader2,
  ChevronLeft,
  ChevronRight,
  PawPrint,
  Info,
  RefreshCw,
} from "lucide-react";
import { FilterPanel, type FilterState } from "@/components/goskatalog/FilterPanel";
import { ExhibitCard } from "@/components/goskatalog/ExhibitCard";
import { ExhibitModal } from "@/components/goskatalog/ExhibitModal";
import { ConnectivityNotice } from "@/components/goskatalog/ConnectivityNotice";
import type { GkSearchResult } from "@/lib/goskatalog/types";

const DEFAULT_FILTERS: FilterState = {
  code: "",
  title: "",
  titleMode: "any",
  description: "",
  descriptionMode: "any",
  museums: [],
  categoryIds: [],
  onlyWithPhoto: false,
  pageSize: 50,
};

export default function PortraitsPage() {
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<GkSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeExhibitId, setActiveExhibitId] = useState<number | null>(null);
  const [lastQuery, setLastQuery] = useState<{ page: number; filters: FilterState } | null>(null);

  const runSearch = useCallback(
    async (targetPage: number, currentFilters: FilterState) => {
      setIsLoading(true);
      setError(null);
      setLastQuery({ page: targetPage, filters: currentFilters });

      // Клиентский таймаут с отменой: серверный бюджет ~16 с, берём с запасом,
      // чтобы запрос не висел вечно, если приложение перезапустилось.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 45_000);

      try {
        const res = await fetch("/api/goskatalog/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            code: currentFilters.code,
            title: currentFilters.title,
            titleMode: currentFilters.titleMode,
            description: currentFilters.description,
            descriptionMode: currentFilters.descriptionMode,
            museumIds: currentFilters.museums.map((m) => m.id),
            categoryIds: currentFilters.categoryIds,
            onlyWithPhoto: currentFilters.onlyWithPhoto,
            page: targetPage,
            pageSize: currentFilters.pageSize,
          }),
        });

        // Ответ может прийти не-JSON (страница ошибки прокси или перезапуск
        // приложения) — тогда показываем понятную подсказку, а не «Unexpected token».
        const text = await res.text();
        let data: { success?: boolean; error?: string; result?: GkSearchResult };
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          throw new Error(
            `Сервер вернул не-JSON (HTTP ${res.status}). Скорее всего приложение перезапустилось — нажмите «Повторить поиск».`
          );
        }

        if (!res.ok || !data.success || !data.result) {
          throw new Error(data.error || "Не удалось получить результаты");
        }
        setResult(data.result);
        setPage(targetPage);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          setError(
            "Поиск не уложился в 45 секунд. Госкаталог или промежуточные серверы сейчас медленные — попробуйте повторить или уменьшить число экспонатов на странице."
          );
        } else {
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        clearTimeout(timer);
        setIsLoading(false);
      }
    },
    []
  );

  const handleSubmit = () => runSearch(1, filters);
  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setResult(null);
    setError(null);
  };
  const goToPage = (next: number) => {
    if (next < 1) return;
    runSearch(next, filters);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const estimatedTotalPages = result?.upstreamTotal
    ? Math.max(1, Math.ceil(result.upstreamTotal / result.pageSize))
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(253,247,241,0.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)]">
            <ArrowLeft className="w-4 h-4" /> Клубок
          </Link>
          <h1 className="font-display text-base sm:text-xl font-bold text-[var(--plum)] flex items-center gap-2">
            <ImageIcon className="w-5 h-5 text-[var(--rose-600)]" />
            Портреты Госкаталога
          </h1>
          <span className="chip hidden sm:inline-flex">
            <PawPrint className="w-3 h-3" /> goskatalog.ru
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3.5 text-xs text-[var(--plum-soft)] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[var(--rose-600)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Раздел ищет портреты и любые другие музейные предметы напрямую в Государственном
            каталоге Музейного фонда РФ. Настройте фильтры слева и нажмите «Искать» — результаты
            подгружаются постранично, а по клику на экспонат открывается полная карточка со
            скачиванием изображений.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
          <div className="lg:sticky lg:top-24">
            <FilterPanel
              state={filters}
              onChange={setFilters}
              onSubmit={handleSubmit}
              onReset={handleReset}
              isLoading={isLoading}
            />
          </div>

          <div className="space-y-4 min-w-0">
            {isLoading && (
              <div className="flex items-center justify-center gap-2 py-16 text-[var(--rose-700)] text-sm font-bold">
                <Loader2 className="w-5 h-5 animate-spin" /> Котёнок рыщет по Госкаталогу…
              </div>
            )}

            {!isLoading && error && (
              <div className="rounded-2xl border border-[#f3c3bb] bg-[#fdf0ed] p-4 text-xs text-[#9a4a3e] space-y-3">
                <p className="leading-relaxed">{error}</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => lastQuery && runSearch(lastQuery.page, lastQuery.filters)}
                    disabled={!lastQuery}
                    className="px-3.5 py-2 rounded-xl bg-[#c05e7d] text-white font-bold text-[11px] flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Повторить поиск
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-3.5 py-2 rounded-xl bg-white border border-[#f3c3bb] text-[#9a4a3e] font-bold text-[11px]"
                  >
                    Перезагрузить страницу
                  </button>
                </div>
              </div>
            )}

            {!isLoading && !error && result && result.source === "unavailable" && (
              <ConnectivityNotice
                deepLink={result.deepLink}
                warning={result.warning}
                upstreamUrl={result.upstreamUrl}
              />
            )}

            {!isLoading && !error && result && result.source === "live" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-soft)]">
                  <span>
                    Госкаталог сообщает:{" "}
                    <strong className="text-[var(--plum)]">
                      {result.upstreamTotal != null ? result.upstreamTotal.toLocaleString("ru-RU") : "—"}
                    </strong>{" "}
                    найдено · на этой странице после уточнения фильтров:{" "}
                    <strong className="text-[var(--rose-700)]">{result.refinedCount}</strong>
                  </span>
                  <a
                    href={result.deepLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[var(--rose-700)] font-bold hover:underline"
                  >
                    Открыть на goskatalog.ru →
                  </a>
                </div>

                {result.items.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-2 border-2 border-dashed border-[var(--rose-200)] rounded-3xl bg-[rgba(253,231,224,0.35)]">
                    <PawPrint className="w-8 h-8 text-[var(--rose-300)]" />
                    <p className="font-display text-sm font-bold text-[var(--plum)]">
                      На этой странице ничего не нашлось
                    </p>
                    <p className="text-xs text-[var(--ink-soft)] max-w-sm text-center">
                      Попробуйте смягчить фильтры (например, переключить режим «включает любое») или
                      проверить следующую страницу.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                    {result.items.map((exhibit) => (
                      <ExhibitCard key={exhibit.id} exhibit={exhibit} onOpen={() => setActiveExhibitId(exhibit.id)} />
                    ))}
                  </div>
                )}

                {/* Pagination */}
                <div className="flex items-center justify-center gap-3 pt-4">
                  <button
                    onClick={() => goToPage(page - 1)}
                    disabled={page <= 1}
                    className="btn-ghost-rose p-2.5 rounded-xl disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-bold text-[var(--plum)]">
                    Страница {page}
                    {estimatedTotalPages ? ` из ~${estimatedTotalPages.toLocaleString("ru-RU")}` : ""}
                  </span>
                  <button
                    onClick={() => goToPage(page + 1)}
                    disabled={!result.hasNextPage}
                    className="btn-rose p-2.5 rounded-xl disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}

            {!isLoading && !error && !result && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 border-2 border-dashed border-[var(--rose-200)] rounded-3xl bg-[rgba(253,231,224,0.35)] text-center px-4">
                <ImageIcon className="w-10 h-10 text-[var(--rose-300)]" />
                <p className="font-display text-base font-bold text-[var(--plum)]">
                  Настройте фильтры и нажмите «Искать»
                </p>
                <p className="text-xs text-[var(--ink-soft)] max-w-sm">
                  Можно начать с пресета «Портреты» слева — он сразу подставит ключевые слова
                  «портрет», «автопортрет» и «парсуна».
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {activeExhibitId != null && <ExhibitModal id={activeExhibitId} onClose={() => setActiveExhibitId(null)} />}
    </div>
  );
}
