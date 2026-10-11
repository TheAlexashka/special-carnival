"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Gavel,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Download,
  ImageOff,
  AlertTriangle,
  ShieldCheck,
  X,
} from "lucide-react";
import { INVALUABLE_CATEGORIES, type InvaluableAuctionScope } from "@/lib/invaluable";

interface InvaluablePhoto {
  thumb: string;
  medium: string;
  large: string;
}

interface InvaluableLot {
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
}

interface SearchResult {
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

const mediaUrl = (url: string, download = false) =>
  `/api/invaluable/media?url=${encodeURIComponent(url)}${download ? "&download=1" : ""}`;

const formatDate = (iso: string | null) => {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
  } catch {
    return null;
  }
};

export default function InvaluablePage() {
  const [query, setQuery] = useState("portrait");
  const [rows, setRows] = useState(24);
  const [scope, setScope] = useState<InvaluableAuctionScope>("upcoming");
  const [category, setCategory] = useState("");
  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<InvaluableLot | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [activeImage, setActiveImage] = useState(0);

  const search = useCallback(
    async (
      targetPage: number,
      q = query,
      r = rows,
      auctionScope: InvaluableAuctionScope = scope,
      selectedCategory = category
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q,
          page: String(targetPage),
          rows: String(r),
          scope: auctionScope,
          category: selectedCategory,
        });
        const res = await fetch(`/api/invaluable/search?${params.toString()}`, {
          signal: AbortSignal.timeout(45_000),
        });
        const text = await res.text();
        let data: { success?: boolean; error?: string; result?: SearchResult };
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          throw new Error(`Сервер вернул не-JSON (HTTP ${res.status}). Обновите страницу и повторите.`);
        }
        if (!res.ok || !data.success || !data.result) {
          throw new Error(data.error || "Invaluable не вернул результаты");
        }
        setResult(data.result);
      } catch (err: unknown) {
        setError(
          err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")
            ? "Invaluable отвечает слишком долго — попробуйте ещё раз."
            : err instanceof Error
            ? err.message
            : String(err)
        );
      } finally {
        setIsLoading(false);
      }
    },
    [query, rows, scope, category]
  );

  useEffect(() => {
    void search(1, "portrait", 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openLot = useCallback(async (item: InvaluableLot) => {
    setIsLoadingDetail(true);
    setDetail(item);
    setActiveImage(0);
    try {
      const res = await fetch(`/api/invaluable/lot/${encodeURIComponent(item.ref)}`);
      const data = await res.json();
      if (data.success && data.lot) setDetail(data.lot);
    } catch {
      /* показываем то, что уже есть в выдаче */
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(253,247,241,.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)] shrink-0">
            <ArrowLeft className="w-4 h-4" /> Клубок
          </Link>
          <h1 className="font-display text-base sm:text-xl font-bold text-[var(--plum)] flex items-center gap-2 truncate">
            <Gavel className="w-5 h-5 text-[var(--rose-600)]" />
            Invaluable
          </h1>
          <a href="https://www.invaluable.com/" target="_blank" rel="noreferrer" className="chip hidden sm:inline-flex">
            invaluable.com
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3.5 text-xs text-[var(--plum-soft)] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Аукционный агрегатор: поиск по миллионам лотов сотен домов. Показываем фото,
            эстимейт, цену, описание и дом — фото скачиваются в полном размере, ставки
            делаются на самом invaluable.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search(1);
          }}
          className="card-boudoir p-3 sm:p-4 flex flex-col sm:flex-row gap-2"
        >
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--rose-500)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="portrait, vase, Faberge, icon…"
              className="input-boudoir w-full pl-10 pr-3 py-3 rounded-2xl text-sm"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => {
              const next = e.target.value as InvaluableAuctionScope;
              setScope(next);
              void search(1, query, rows, next, category);
            }}
            className="input-boudoir px-3 py-3 rounded-2xl text-xs sm:w-48"
            aria-label="Статус аукциона"
          >
            <option value="upcoming">Текущие и предстоящие</option>
            <option value="past">Прошедшие аукционы</option>
          </select>
          <select
            value={category}
            onChange={(e) => {
              const next = e.target.value;
              setCategory(next);
              void search(1, query, rows, scope, next);
            }}
            className="input-boudoir px-3 py-3 rounded-2xl text-xs sm:w-56"
            aria-label="Категория лота"
          >
            <option value="">Все категории</option>
            <optgroup label="Основные разделы">
              {INVALUABLE_CATEGORIES.filter((item) => item.level === "supercategory").map((item) => (
                <option key={item.ref} value={item.ref}>{item.label}</option>
              ))}
            </optgroup>
            <optgroup label="Категории">
              {INVALUABLE_CATEGORIES.filter((item) => item.level === "category").map((item) => (
                <option key={item.ref} value={item.ref}>{item.label}</option>
              ))}
            </optgroup>
          </select>
          <select
            value={rows}
            onChange={(e) => {
              const next = Number(e.target.value);
              setRows(next);
              void search(1, query, next, scope, category);
            }}
            className="input-boudoir px-3 py-3 rounded-2xl text-xs sm:w-32"
            aria-label="Число лотов на странице"
          >
            {[12, 24, 48].map((n) => (
              <option key={n} value={n}>{n} / стр.</option>
            ))}
          </select>
          <button
            disabled={isLoading}
            className="btn-rose px-6 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Искать лоты
          </button>
        </form>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-sm font-bold text-[var(--rose-700)]">
            <Loader2 className="w-5 h-5 animate-spin" /> Аукционист листает каталоги…
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-[#f3c3bb] bg-[#fdf0ed] p-4 text-xs text-[#9a4a3e] flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p>{error}</p>
              <button
                onClick={() => void search(result?.page ?? 1)}
                className="px-3 py-1.5 rounded-xl bg-[#c05e7d] text-white font-bold"
              >
                Повторить
              </button>
            </div>
          </div>
        )}

        {!isLoading && !error && result && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-soft)]">
              <span className="flex flex-wrap items-center gap-1.5">
                По запросу <strong className="text-[var(--plum)]">«{result.query}»</strong> найдено{" "}
                <strong className="text-[var(--rose-700)]">{result.total.toLocaleString("en-US")}</strong> лотов
                <span className="chip !text-[10px]">{result.scope === "past" ? "Прошедшие аукционы" : "Текущие и предстоящие"}</span>
                {result.category && <span className="chip !text-[10px]">{INVALUABLE_CATEGORIES.find((item) => item.ref === result.category)?.label}</span>}
              </span>
            </div>

            {!result.items.length ? (
              <div className="text-center py-16 border-2 border-dashed border-[var(--rose-200)] rounded-3xl text-xs text-[var(--ink-soft)] px-4">
                Ничего не найдено — попробуйте английское слово (invaluable ищет по-английски).
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {result.items.map((lot) => (
                  <button
                    key={lot.ref}
                    onClick={() => void openLot(lot)}
                    className="group card-boudoir p-3 text-left hover:-translate-y-1 transition-transform flex flex-col"
                  >
                    <div className="relative aspect-square bg-[var(--rose-100)] rounded-xl overflow-hidden border border-[var(--border)] flex items-center justify-center">
                      {lot.images[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl(lot.images[0].medium)}
                          alt={lot.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="text-center text-[var(--ink-soft)] px-2">
                          <ImageOff className="w-6 h-6 mx-auto mb-1" />
                          <span className="text-[9px] font-bold">без фото</span>
                        </div>
                      )}
                      {lot.images.length > 1 && (
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[rgba(74,42,56,.85)] text-white text-[9px] font-bold">
                          {lot.images.length} фото
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 flex-1">
                      <h2 className="text-xs font-bold text-[var(--plum)] line-clamp-2 leading-snug group-hover:text-[var(--rose-700)]">
                        {lot.title}
                      </h2>
                      {lot.estimate && (
                        <p className="text-[11px] font-extrabold text-[var(--rose-700)]">
                          Эстимейт: {lot.estimate}
                        </p>
                      )}
                      {lot.priceLabel && (
                        <p className="text-[10px] text-[var(--ink-soft)] font-bold">Цена: {lot.priceLabel}</p>
                      )}
                      {lot.house && (
                        <p className="text-[10px] text-[var(--ink-soft)] line-clamp-1 mt-auto pt-1">{lot.house}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-center items-center gap-3 pt-4">
              <button
                onClick={() => void search(result.page - 1)}
                disabled={result.page <= 1 || isLoading}
                className="btn-ghost-rose p-2.5 rounded-xl disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-[var(--plum)]">
                Страница {result.page} из {result.totalPages.toLocaleString("en-US")}
              </span>
              <button
                onClick={() => void search(result.page + 1)}
                disabled={!result.hasNextPage || isLoading}
                className="btn-rose p-2.5 rounded-xl disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </>
        )}
      </main>

      {(detail || isLoadingDetail) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[rgba(58,32,44,.85)] backdrop-blur-md"
          onClick={() => setDetail(null)}
        >
          <div
            className="card-boudoir max-w-4xl w-full max-h-[94vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[rgba(253,247,241,.96)]">
              <h3 className="font-display text-sm sm:text-base font-bold truncate pr-3">
                {detail?.title || "Загрузка…"}
              </h3>
              <button onClick={() => setDetail(null)} className="p-2 rounded-xl hover:bg-[var(--rose-100)] shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {detail && detail.images.length > 0 && (
                <div className="space-y-2">
                  <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--rose-100)] flex items-center justify-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={mediaUrl(detail.images[Math.min(activeImage, detail.images.length - 1)].large)}
                      alt={detail.title}
                      className="max-h-[52vh] w-full object-contain"
                    />
                  </div>
                  {detail.images.length > 1 && (
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {detail.images.map((photo, idx) => (
                        <button
                          key={photo.large}
                          onClick={() => setActiveImage(idx)}
                          className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 ${
                            idx === activeImage ? "border-[var(--rose-500)]" : "border-transparent"
                          }`}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={mediaUrl(photo.thumb)} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <a
                    href={mediaUrl(detail.images[Math.min(activeImage, detail.images.length - 1)].large, true)}
                    className="btn-rose inline-flex px-4 py-2 rounded-xl text-xs font-extrabold items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Скачать фото в полном размере
                  </a>
                </div>
              )}

              {detail && (
                <>
                  <dl className="grid sm:grid-cols-2 gap-3 text-xs text-[var(--plum-soft)]">
                    {detail.estimate && <Field label="Эстимейт" value={detail.estimate} />}
                    {detail.priceLabel && <Field label="Цена / ставка" value={detail.priceLabel} />}
                    {detail.house && <Field label="Аукционный дом" value={detail.house} />}
                    {detail.lotNumber && <Field label="Лот" value={detail.lotNumber} />}
                    {detail.bidCount != null && <Field label="Ставок" value={String(detail.bidCount)} />}
                    {formatDate(detail.eventDate) && <Field label="Торги" value={formatDate(detail.eventDate) as string} />}
                    {detail.categories.length > 0 && <Field label="Категории" value={detail.categories.join(", ")} />}
                  </dl>

                  {detail.description && (
                    <div>
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] mb-1">
                        Описание лота
                      </h4>
                      <p className="text-xs text-[var(--plum-soft)] leading-relaxed whitespace-pre-line">
                        {detail.description}
                      </p>
                    </div>
                  )}

                  <a
                    href={detail.lotUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--rose-700)]"
                  >
                    Открыть лот и сделать ставку <ExternalLink className="w-3 h-3" />
                  </a>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase font-bold tracking-wide text-[var(--ink-soft)]">{label}</dt>
      <dd className="font-bold text-[var(--plum)] break-words">{value}</dd>
    </div>
  );
}
