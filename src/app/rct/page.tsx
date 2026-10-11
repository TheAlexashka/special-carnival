"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Crown,
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
  Maximize2,
  Calendar,
  MapPin,
  Tag,
  Hash,
} from "lucide-react";

interface RctItem {
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

interface RctResult {
  items: RctItem[];
  total: number;
  page: number;
  rows: number;
  totalPages: number;
  hasNextPage: boolean;
  query: string;
  onlyWithImages: boolean;
}

interface RctDetail extends RctItem {
  libraryName?: string;
  author?: string;
  year?: string;
  totalPages?: number;
  pages?: Array<{
    index: number;
    id?: string | number;
    label: string;
    thumbnailUrl: string;
    originalUrl: string;
    hdUrl: string;
    mobileUrl: string;
  }>;
  metaRaw?: Record<string, unknown>;
}

const imageProxy = (url: string | null, download = false) => {
  if (!url) return "";
  return `/api/rct/media?url=${encodeURIComponent(url)}${download ? "&download=1" : ""}`;
};

export default function RctPage() {
  const [query, setQuery] = useState("portrait");
  const [rows, setRows] = useState(24);
  const [onlyImages, setOnlyImages] = useState(true);
  const [result, setResult] = useState<RctResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail modal state
  const [detail, setDetail] = useState<RctDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isFullView, setIsFullView] = useState(false);

  const search = useCallback(
    async (targetPage: number, q = query, pageRows = rows, images = onlyImages) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q,
          page: String(targetPage),
          rows: String(pageRows),
          onlyImages: images ? "1" : "0",
        });
        const res = await fetch(`/api/rct/search?${params.toString()}`, {
          signal: AbortSignal.timeout(45_000),
        });
        const text = await res.text();
        let data: { success?: boolean; error?: string; result?: RctResult };
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          throw new Error(`Сервер вернул не-JSON (HTTP ${res.status}). Обновите страницу и повторите.`);
        }
        if (!res.ok || !data.success || !data.result) {
          throw new Error(data.error || "Royal Collection Trust не вернул результаты");
        }
        setResult(data.result);
      } catch (err: unknown) {
        setError(
          err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")
            ? "Каталог RCT отвечает слишком долго — попробуйте ещё раз."
            : err instanceof Error
            ? err.message
            : String(err)
        );
      } finally {
        setIsLoading(false);
      }
    },
    [query, rows, onlyImages]
  );

  useEffect(() => {
    void search(1, "portrait", 24, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openObject = useCallback(async (item: RctItem) => {
    // Immediately set modal content with what we already have from search
    setDetail({
      ...item,
      pages: item.imageUrl
        ? [
            {
              index: 1,
              id: item.inventoryNumber || item.id,
              label: item.title,
              thumbnailUrl: item.thumbnailUrl || item.imageUrl,
              originalUrl: item.imageUrl,
              hdUrl: item.imageUrl,
              mobileUrl: item.thumbnailUrl || item.imageUrl,
            },
          ]
        : [],
    });

    // Optionally fetch richer details in the background
    const identity = item.inventoryNumber || String(item.id);
    if (identity) {
      setIsLoadingDetail(true);
      try {
        const res = await fetch(`/api/rct/object/${encodeURIComponent(identity)}`);
        const data = await res.json();
        if (data.success && data.object) {
          setDetail((prev) => (prev ? { ...prev, ...data.object } : data.object));
        }
      } catch {
        // base detail is already displayed
      } finally {
        setIsLoadingDetail(false);
      }
    }
  }, []);

  const activeImageUrl = detail?.imageUrl || detail?.thumbnailUrl || detail?.pages?.[0]?.originalUrl || null;
  const fileName = detail ? `${(detail.title || detail.inventoryNumber || "rct-exhibit").replace(/[\\/:*?"<>|]/g, "_")}.jpg` : "rct-exhibit.jpg";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(253,247,241,.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)] shrink-0">
            <ArrowLeft className="w-4 h-4" /> Клубок
          </Link>
          <h1 className="font-display text-base sm:text-xl font-bold text-[var(--plum)] flex items-center gap-2 truncate">
            <Crown className="w-5 h-5 text-[var(--rose-600)]" />
            Royal Collection Trust
          </h1>
          <a
            href="https://www.rct.uk/collection/search"
            target="_blank"
            rel="noreferrer"
            className="chip hidden sm:inline-flex"
          >
            rct.uk
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3.5 text-xs text-[var(--plum-soft)] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Официальный онлайн-каталог Британской Королевской коллекции (300 000+ экспонатов).
            Поиск работает напрямую через открытый API каталога: находим живопись, рисунки, мебель,
            фотографии, показываем описание и открываем оригинальные фотографии в высоком разрешении.
          </p>
        </div>

        {/* Search bar */}
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
              placeholder="portrait, Leonardo, Fabergé, Queen Victoria, RCIN 405776…"
              className="input-boudoir w-full pl-10 pr-3 py-3 rounded-2xl text-sm"
            />
          </div>
          <label className="input-boudoir px-3 py-3 rounded-2xl text-xs flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyImages}
              onChange={(e) => {
                const next = e.target.checked;
                setOnlyImages(next);
                void search(1, query, rows, next);
              }}
              className="w-3.5 h-3.5 accent-[#c05e7d]"
            />
            только с фото
          </label>
          <select
            value={rows}
            onChange={(e) => {
              const next = Number(e.target.value);
              setRows(next);
              void search(1, query, next, onlyImages);
            }}
            className="input-boudoir px-3 py-3 rounded-2xl text-xs sm:w-32"
          >
            {[12, 24, 36, 48].map((n) => (
              <option key={n} value={n}>
                {n} / стр.
              </option>
            ))}
          </select>
          <button
            disabled={isLoading}
            className="btn-rose px-6 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Искать в RCT
          </button>
        </form>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-sm font-bold text-[var(--rose-700)]">
            <Loader2 className="w-5 h-5 animate-spin" /> Перебираем сокровища Королевской коллекции…
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
              <span>
                По запросу <strong className="text-[var(--plum)]">«{result.query || "все объекты"}»</strong> найдено{" "}
                <strong className="text-[var(--rose-700)]">{result.total.toLocaleString("en-GB")}</strong> предметов
              </span>
              <a
                href={`https://www.rct.uk/collection/search?query=${encodeURIComponent(result.query)}`}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[var(--rose-700)] flex items-center gap-1"
              >
                Открыть на rct.uk <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {!result.items.length ? (
              <div className="text-center py-16 border-2 border-dashed border-[var(--rose-200)] rounded-3xl text-xs text-[var(--ink-soft)] px-4">
                Ничего не найдено — попробуйте английское слово, фамилию мастера (например, Leonardo, Rembrandt, Gainsborough) или номер RCIN.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {result.items.map((item) => (
                  <button
                    key={`${item.id}-${item.inventoryNumber || item.title}`}
                    onClick={() => void openObject(item)}
                    className="group card-boudoir p-3 text-left hover:-translate-y-1 transition-transform flex flex-col"
                  >
                    <div className="relative aspect-square bg-[var(--rose-100)] rounded-xl overflow-hidden border border-[var(--border)] flex items-center justify-center">
                      {item.imageUrl || item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={imageProxy(item.thumbnailUrl || item.imageUrl)}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
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
                      {item.inventoryNumber && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[rgba(74,42,56,.85)] text-white text-[9px] font-bold">
                          {item.inventoryNumber}
                        </span>
                      )}
                      {item.imageUrl && (
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[rgba(74,42,56,.85)] text-white text-[9px] font-bold flex items-center gap-1">
                          <Download className="w-2.5 h-2.5" /> High-Res
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 flex-1">
                      <h2 className="text-xs font-bold text-[var(--plum)] line-clamp-2 leading-snug group-hover:text-[var(--rose-700)]">
                        {item.title}
                      </h2>
                      {item.creator && (
                        <p className="text-[10px] text-[var(--rose-700)] font-bold line-clamp-1">{item.creator}</p>
                      )}
                      {item.creationDate && (
                        <p className="text-[10px] text-[var(--ink-soft)]">{item.creationDate}</p>
                      )}
                      {item.description && (
                        <p className="text-[10px] text-[var(--ink-soft)] line-clamp-2 leading-relaxed">
                          {item.description}
                        </p>
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
                Страница {result.page} из {result.totalPages.toLocaleString("en-GB")}
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

      {/* Exhibit Detail Modal */}
      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[rgba(58,32,44,.85)] backdrop-blur-md"
          onClick={() => {
            setDetail(null);
            setIsFullView(false);
          }}
        >
          <div
            className="card-boudoir max-w-4xl w-full max-h-[94vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[rgba(253,247,241,.96)]">
              <div className="min-w-0 pr-3">
                <h3 className="font-display text-sm sm:text-base font-bold truncate text-[var(--plum)]">
                  {detail.title || "Экспонат Royal Collection"}
                </h3>
                {detail.inventoryNumber && (
                  <p className="text-[10px] text-[var(--rose-700)] font-bold">{detail.inventoryNumber}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeImageUrl && (
                  <button
                    type="button"
                    onClick={() => setIsFullView(true)}
                    className="btn-ghost-rose p-2 rounded-xl text-xs font-bold flex items-center gap-1"
                    title="Открыть изображение на весь экран"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDetail(null);
                    setIsFullView(false);
                  }}
                  className="p-2 rounded-xl hover:bg-[var(--rose-100)] text-[var(--ink-soft)]"
                  aria-label="Закрыть"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-6 space-y-5">
              {activeImageUrl && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--rose-100)] flex items-center justify-center group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imageProxy(activeImageUrl)}
                      alt={detail.title}
                      className="max-h-[55vh] w-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setIsFullView(true)}
                      className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold gap-1.5"
                    >
                      <Maximize2 className="w-5 h-5" /> Увеличить на весь экран
                    </button>
                  </div>

                  {/* Big action bar */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <a
                      href={imageProxy(activeImageUrl, true)}
                      download={fileName}
                      className="btn-rose px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Скачать фото в высоком разрешении (JPG)
                    </a>
                    <a
                      href={activeImageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost-rose px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> Прямой файл у источника
                    </a>
                  </div>
                </div>
              )}

              {/* Metadata attributes */}
              <dl className="grid sm:grid-cols-2 gap-3 text-xs text-[var(--plum-soft)]">
                {detail.inventoryNumber && (
                  <Field icon={<Hash className="w-3.5 h-3.5" />} label="Инвентарный номер" value={detail.inventoryNumber} />
                )}
                {detail.creator && (
                  <Field label="Создатель / Автор" value={detail.creator} />
                )}
                {detail.creationDate && (
                  <Field icon={<Calendar className="w-3.5 h-3.5" />} label="Датировка" value={detail.creationDate} />
                )}
                {detail.type && (
                  <Field icon={<Tag className="w-3.5 h-3.5" />} label="Тип объекта" value={detail.type} />
                )}
                {detail.location && (
                  <Field icon={<MapPin className="w-3.5 h-3.5" />} label="Местонахождение" value={detail.location} />
                )}
              </dl>

              {/* Description */}
              {detail.description && (
                <div className="space-y-1">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                    Описание
                  </h4>
                  <p className="text-xs text-[var(--plum-soft)] leading-relaxed whitespace-pre-line bg-white/70 p-3.5 rounded-2xl border border-[var(--border)]">
                    {detail.description}
                  </p>
                </div>
              )}

              {/* Rights notice */}
              <div className="rounded-xl border border-[var(--border)] bg-white/60 p-3 text-[10px] text-[var(--ink-soft)] leading-relaxed">
                Королевская коллекция Великобритании (Royal Collection Trust). Все оригинальные фото отдаются в исходном качестве.
                Перед коммерческим использованием ознакомьтесь с условиями на Picture Library (rct.uk/about/picture-library).
              </div>

              {/* Link out */}
              <div>
                <a
                  href={detail.itemUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--rose-700)] hover:underline"
                >
                  Открыть карточку на официальном сайте rct.uk <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Image Lightbox */}
      {isFullView && activeImageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-md"
          onClick={() => setIsFullView(false)}
        >
          <button
            type="button"
            onClick={() => setIsFullView(false)}
            className="absolute top-4 right-4 p-2 rounded-2xl bg-white/20 hover:bg-white/30 text-white z-10"
            aria-label="Закрыть полноэкранный режим"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-[95vw] max-h-[92vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageProxy(activeImageUrl)}
              alt={detail?.title || "Полное изображение"}
              className="max-h-[84vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
            <div className="flex gap-2">
              <a
                href={imageProxy(activeImageUrl, true)}
                download={fileName}
                className="btn-rose px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Скачать оригинал
              </a>
              <button
                type="button"
                onClick={() => setIsFullView(false)}
                className="px-4 py-2.5 rounded-xl bg-white/20 text-white font-bold text-xs"
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 bg-white/70 p-3 rounded-xl border border-[var(--border)]">
      {icon && <span className="text-[var(--rose-600)] mt-0.5 shrink-0">{icon}</span>}
      <div className="min-w-0">
        <dt className="text-[10px] uppercase font-bold tracking-wide text-[var(--ink-soft)]">{label}</dt>
        <dd className="font-bold text-[var(--plum)] break-words">{value}</dd>
      </div>
    </div>
  );
}
