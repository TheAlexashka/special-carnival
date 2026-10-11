"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
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
  Filter,
  Maximize2,
} from "lucide-react";

interface KlassikPhoto {
  id: string;
  title: string;
  date: string | null;
  creators: string[];
  collection: string | null;
  thumbnailUrl: string;
  fullImageUrl: string | null;
  objectUrl: string;
}

interface KlassikResult {
  items: KlassikPhoto[];
  total: number;
  page: number;
  rows: number;
  totalPages: number;
  hasNextPage: boolean;
  query: string;
  onlyImages: boolean;
}

interface KlassikFacets {
  creators: string[];
  collections: string[];
  dates: string[];
}

interface KlassikObject {
  title: string;
  totalPages: number;
  pages: Array<{ index: number; originalUrl: string; thumbnailUrl: string; label: string }>;
  objectId: string;
  manifestUrl: string;
}

export default function KlassikPage() {
  const [query, setQuery] = useState("portrait");
  const [creator, setCreator] = useState("");
  const [collection, setCollection] = useState("");
  const [date, setDate] = useState("");
  const [onlyImages, setOnlyImages] = useState(true);
  const [rows, setRows] = useState(30);
  const [showFilters, setShowFilters] = useState(false);

  const [result, setResult] = useState<KlassikResult | null>(null);
  const [facets, setFacets] = useState<KlassikFacets | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<KlassikPhoto | null>(null);

  const search = useCallback(
    async (targetPage: number, overrides?: Record<string, string | boolean | number>) => {
      const pick = <T,>(key: string, fallback: T): T =>
        (overrides?.[key] as T | undefined) ?? fallback;

      const params = new URLSearchParams({
        q: String(pick("query", query)),
        creator: String(pick("creator", creator)),
        collection: String(pick("collection", collection)),
        date: String(pick("date", date)),
        onlyImages: pick("onlyImages", onlyImages) ? "1" : "0",
        page: String(targetPage),
        rows: String(pick("rows", rows)),
        facets: "1",
      });

      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/klassik/search?${params.toString()}`, {
          signal: AbortSignal.timeout(45_000),
        });
        const text = await res.text();
        let data: { success?: boolean; error?: string; result?: KlassikResult; facets?: KlassikFacets };
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          throw new Error(`Сервер вернул не-JSON (HTTP ${res.status}). Обновите страницу и повторите.`);
        }
        if (!res.ok || !data.success || !data.result) {
          throw new Error(data.error || "Klassik Stiftung не вернула результаты");
        }
        setResult(data.result);
        if (data.facets) setFacets(data.facets);
      } catch (err: unknown) {
        setError(
          err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")
            ? "Klassik Stiftung отвечает слишком долго — попробуйте ещё раз."
            : err instanceof Error
            ? err.message
            : String(err)
        );
      } finally {
        setIsLoading(false);
      }
    },
    [query, creator, collection, date, onlyImages, rows]
  );

  useEffect(() => {
    void search(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFacet = (key: "creator" | "collection" | "date", value: string) => {
    const setter = key === "creator" ? setCreator : key === "collection" ? setCollection : setDate;
    const current = key === "creator" ? creator : key === "collection" ? collection : date;
    const next = current === value ? "" : value;
    setter(next);
    void search(1, { [key]: next });
  };

  const openOriginal = (photo: KlassikPhoto) => {
    if (!photo.fullImageUrl) return;
    window.open(
      `/api/proxy-image?url=${encodeURIComponent(photo.fullImageUrl)}&download=1`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(253,247,241,.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)] shrink-0">
            <ArrowLeft className="w-4 h-4" /> Клубок
          </Link>
          <h1 className="font-display text-base sm:text-xl font-bold text-[var(--plum)] flex items-center gap-2 truncate">
            <Building2 className="w-5 h-5 text-[var(--rose-600)]" />
            Klassik Stiftung Weimar
          </h1>
          <a
            href="https://suche.klassik-stiftung.de/"
            target="_blank"
            rel="noreferrer"
            className="chip hidden sm:inline-flex"
          >
            suche.klassik-stiftung.de
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3.5 text-xs text-[var(--plum-soft)] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Официальные коллекции Klassik Stiftung Weimar (Goethe, Schiller, Гердер, музеи и
            библиотека). Поиск идёт через открытый поисковый бэкенд самого сайта, изображения —
            через их IIIF-сервис: превью показываем, а по клику скачиваем оригинал
            (<strong>full/full</strong>).
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search(1);
          }}
          className="card-boudoir p-3 sm:p-4 space-y-4"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--rose-500)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="portrait, Goethe, Schiller, Handschrift…"
                className="input-boudoir w-full pl-10 pr-3 py-3 rounded-2xl text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className="btn-ghost-rose px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5"
            >
              <Filter className="w-3.5 h-3.5" /> Фильтры
            </button>
            <button
              disabled={isLoading}
              className="btn-rose px-6 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Искать
            </button>
          </div>

          {showFilters && (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end pt-1">
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] block">
                  Автор / лицо
                </label>
                <input
                  value={creator}
                  onChange={(e) => setCreator(e.target.value)}
                  placeholder="Goethe"
                  className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] block">
                  Коллекция
                </label>
                <input
                  value={collection}
                  onChange={(e) => setCollection(e.target.value)}
                  placeholder="Goethe- und Schiller-Archiv"
                  className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] block">
                  Дата / период
                </label>
                <input
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  placeholder="1860"
                  className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--plum-soft)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyImages}
                    onChange={(e) => {
                      setOnlyImages(e.target.checked);
                      void search(1, { onlyImages: e.target.checked });
                    }}
                    className="w-3.5 h-3.5 accent-[#c05e7d]"
                  />
                  только с изображением
                </label>
                <select
                  value={rows}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setRows(next);
                    void search(1, { rows: next });
                  }}
                  className="input-boudoir px-2 py-2 rounded-xl text-xs"
                >
                  {[10, 30, 60].map((n) => (
                    <option key={n} value={n}>
                      {n} / стр.
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {facets && (facets.creators.length > 0 || facets.collections.length > 0) && (
            <div className="space-y-2 pt-1">
              {facets.creators.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                    Авторы (из выдачи)
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {facets.creators.slice(0, 14).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleFacet("creator", name)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold tile-rose ${
                          creator === name ? "is-active" : ""
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {facets.collections.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                    Коллекции
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {facets.collections.slice(0, 14).map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleFacet("collection", name)}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold tile-rose ${
                          collection === name ? "is-active" : ""
                        }`}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </form>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-sm font-bold text-[var(--rose-700)]">
            <Loader2 className="w-5 h-5 animate-spin" /> Смотрим фонды Веймара…
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
                <strong className="text-[var(--plum)]">{result.total.toLocaleString("de-DE")}</strong> объектов
                {creator && <span className="chip !text-[10px] ml-1.5">{creator}</span>}
                {collection && <span className="chip !text-[10px] ml-1.5">{collection}</span>}
                {date && <span className="chip !text-[10px] ml-1.5">{date}</span>}
                {result.onlyImages && <span className="chip !text-[10px] ml-1.5">с изображением</span>}
              </span>
              <select
                value={rows}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setRows(next);
                  void search(1, { rows: next });
                }}
                className="input-boudoir px-2 py-1.5 rounded-lg text-[11px]"
              >
                {[10, 30, 60].map((n) => (
                  <option key={n} value={n}>
                    {n} / стр.
                  </option>
                ))}
              </select>
            </div>

            {!result.items.length ? (
              <div className="text-center py-16 border-2 border-dashed border-[var(--rose-200)] rounded-3xl text-xs text-[var(--ink-soft)] px-4">
                Ничего не найдено. Снимите часть фильтров или поищите немецкое слово.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {result.items.map((photo) => (
                  <div key={photo.id} className="card-boudoir p-3 flex flex-col space-y-2">
                    <button
                      onClick={() => setPreview(photo)}
                      className="relative aspect-square bg-[var(--rose-100)] rounded-xl overflow-hidden border border-[var(--border)] flex items-center justify-center group"
                    >
                      {photo.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`/api/proxy-image?url=${encodeURIComponent(photo.thumbnailUrl)}`}
                          alt={photo.title}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <ImageOff className="w-7 h-7 text-[var(--ink-soft)]" />
                      )}
                      {photo.date && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[rgba(74,42,56,.85)] text-white text-[9px] font-bold">
                          {photo.date}
                        </span>
                      )}
                      <span className="absolute inset-0 bg-[rgba(74,42,56,.45)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-6 h-6" />
                      </span>
                    </button>

                    <div className="space-y-1 flex-1">
                      <h2 className="text-xs font-bold text-[var(--plum)] line-clamp-2 leading-snug">
                        {photo.title}
                      </h2>
                      {photo.creators.length > 0 && (
                        <p className="text-[10px] text-[var(--rose-700)] font-bold line-clamp-1">
                          {photo.creators.join(", ")}
                        </p>
                      )}
                      {photo.collection && (
                        <p className="text-[10px] text-[var(--ink-soft)] line-clamp-1">{photo.collection}</p>
                      )}
                    </div>

                    <div className="flex gap-1.5">
                      <a
                        href={
                          photo.fullImageUrl
                            ? `/api/proxy-image?url=${encodeURIComponent(photo.fullImageUrl)}&download=1`
                            : photo.objectUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="btn-rose flex-1 px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3" /> оригинал
                      </a>
                      <a
                        href={photo.objectUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost-rose px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center"
                        title="Открыть на сайте"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
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
                Страница {result.page} из {result.totalPages.toLocaleString("de-DE")}
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

      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[rgba(58,32,44,.85)] backdrop-blur-md"
          onClick={() => setPreview(null)}
        >
          <div className="max-w-5xl w-full max-h-[94vh] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="rounded-2xl overflow-hidden bg-black/40 flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/proxy-image?url=${encodeURIComponent(preview.fullImageUrl || preview.thumbnailUrl)}`}
                alt={preview.title}
                className="max-h-[74vh] w-full object-contain"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-50">
              <div className="min-w-0">
                <p className="font-bold truncate">{preview.title}</p>
                <p className="opacity-80 truncate">
                  {preview.creators.join(", ")}
                  {preview.date ? ` · ${preview.date}` : ""}
                </p>
              </div>
              <div className="flex gap-2 shrink-0">
                {preview.fullImageUrl && (
                  <a
                    href={`/api/proxy-image?url=${encodeURIComponent(preview.fullImageUrl)}&download=1`}
                    className="px-3 py-2 rounded-xl bg-white text-[var(--plum)] font-bold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Скачать оригинал
                  </a>
                )}
                <a
                  href={preview.objectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded-xl bg-[rgba(255,255,255,.2)] text-white font-bold flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> На сайте
                </a>
                <button onClick={() => setPreview(null)} className="px-3 py-2 rounded-xl bg-[rgba(255,255,255,.2)] text-white font-bold">
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
