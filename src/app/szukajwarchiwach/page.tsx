"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Archive,
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
  FileText,
  Calendar,
  Building2,
  Maximize2,
} from "lucide-react";
import { SZWA_TYPES, SZWA_ARCHIVES, type SzwaItem, type SzwaSearchResult } from "@/lib/szwa";

const mediaUrl = (url: string | null, download = false) => {
  if (!url) return "";
  return `/api/europeana/media?url=${encodeURIComponent(url)}${download ? "&download=1" : ""}`;
};

export default function SzukajWArchiwachPage() {
  const [query, setQuery] = useState("Warszawa");
  const [type, setType] = useState("IMAGE");
  const [archive, setArchive] = useState("all");
  const [onlyWithScans, setOnlyWithScans] = useState(true);
  const [rows, setRows] = useState(24);

  const [result, setResult] = useState<SzwaSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal
  const [detail, setDetail] = useState<SzwaItem | null>(null);
  const [isFullView, setIsFullView] = useState(false);

  const search = useCallback(
    async (
      targetPage: number,
      q = query,
      t = type,
      arch = archive,
      scans = onlyWithScans,
      pageRows = rows
    ) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          q,
          page: String(targetPage),
          rows: String(pageRows),
          onlyWithScans: scans ? "1" : "0",
        });
        if (t) params.set("type", t);
        if (arch && arch !== "all") params.set("archive", arch);

        const res = await fetch(`/api/szwa/search?${params.toString()}`, {
          signal: AbortSignal.timeout(45_000),
        });
        const text = await res.text();
        let data: { success?: boolean; error?: string; result?: SzwaSearchResult };
        try {
          data = JSON.parse(text) as typeof data;
        } catch {
          throw new Error(`Сервер вернул не-JSON (HTTP ${res.status}). Обновите страницу и повторите.`);
        }
        if (!res.ok || !data.success || !data.result) {
          throw new Error(data.error || "Архивный поиск не вернул результаты");
        }
        setResult(data.result);
      } catch (err: unknown) {
        setError(
          err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")
            ? "Архивный индекс отвечает слишком долго — попробуйте ещё раз."
            : err instanceof Error
            ? err.message
            : String(err)
        );
      } finally {
        setIsLoading(false);
      }
    },
    [query, type, archive, onlyWithScans, rows]
  );

  useEffect(() => {
    void search(1, "Warszawa", "IMAGE", "all", true, 24);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openItem = (item: SzwaItem) => {
    setDetail(item);
  };

  const activeImageUrl = detail?.objectUrl || detail?.previewUrl || null;
  const fileName = detail ? `${(detail.title || "archiwalny-skan").replace(/[\\/:*?"<>|]/g, "_")}.jpg` : "archiwalny-skan.jpg";

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(253,247,241,.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)] shrink-0">
            <ArrowLeft className="w-4 h-4" /> Клубок
          </Link>
          <h1 className="font-display text-base sm:text-xl font-bold text-[var(--plum)] flex items-center gap-2 truncate">
            <Archive className="w-5 h-5 text-[var(--rose-600)]" />
            Szukaj w Archiwach (Польские архивы)
          </h1>
          <a
            href="https://www.szukajwarchiwach.gov.pl/ru/strona_glowna"
            target="_blank"
            rel="noreferrer"
            className="chip hidden sm:inline-flex"
          >
            szukajwarchiwach.gov.pl
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3.5 text-xs text-[var(--plum-soft)] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Поиск по оцифрованным материалам Государственных архивов Польши (Национальный цифровой архив NAC,
            Главный архив древних актов AGAD, архивы Варшавы, Кракова, Познани и др.). Находите старинные фотографии,
            метрические книги, карты, рукописи и скачивайте сканы в высоком разрешении.
          </p>
        </div>

        {/* Filter / Search Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void search(1);
          }}
          className="card-boudoir p-3 sm:p-4 space-y-3"
        >
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--rose-500)]" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Warszawa, Kraków, портрет, метрика, mapa, zamek…"
                className="input-boudoir w-full pl-10 pr-3 py-3 rounded-2xl text-sm"
              />
            </div>
            <select
              value={type}
              onChange={(e) => {
                const next = e.target.value;
                setType(next);
                void search(1, query, next, archive, onlyWithScans, rows);
              }}
              className="input-boudoir px-3 py-3 rounded-2xl text-xs sm:w-52"
              title="Тип документа"
            >
              <option value="">Все типы</option>
              {SZWA_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <select
              value={archive}
              onChange={(e) => {
                const next = e.target.value;
                setArchive(next);
                void search(1, query, type, next, onlyWithScans, rows);
              }}
              className="input-boudoir px-3 py-3 rounded-2xl text-xs sm:w-56"
              title="Архив"
            >
              {SZWA_ARCHIVES.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <label className="flex items-center gap-2 text-xs font-bold text-[var(--plum-soft)] cursor-pointer">
              <input
                type="checkbox"
                checked={onlyWithScans}
                onChange={(e) => {
                  const next = e.target.checked;
                  setOnlyWithScans(next);
                  void search(1, query, type, archive, next, rows);
                }}
                className="w-3.5 h-3.5 accent-[#c05e7d]"
              />
              только со сканами
            </label>

            <div className="flex items-center gap-2">
              <select
                value={rows}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  setRows(next);
                  void search(1, query, type, archive, onlyWithScans, next);
                }}
                className="input-boudoir px-2.5 py-1.5 rounded-xl text-xs"
              >
                {[12, 24, 36, 48].map((n) => (
                  <option key={n} value={n}>
                    {n} / стр.
                  </option>
                ))}
              </select>
              <button
                disabled={isLoading}
                className="btn-rose px-6 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Искать в архивах
              </button>
            </div>
          </div>
        </form>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-sm font-bold text-[var(--rose-700)]">
            <Loader2 className="w-5 h-5 animate-spin" /> Листаем государственные архивы Польши…
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
                По запросу <strong className="text-[var(--plum)]">«{result.query}»</strong> найдено{" "}
                <strong className="text-[var(--rose-700)]">{result.total.toLocaleString("pl-PL")}</strong> архивных документов
              </span>
              <a
                href={`https://www.szukajwarchiwach.gov.pl/en/strona_glowna?q=${encodeURIComponent(result.query)}`}
                target="_blank"
                rel="noreferrer"
                className="font-bold text-[var(--rose-700)] flex items-center gap-1"
              >
                Открыть поиск на szukajwarchiwach.gov.pl <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {!result.items.length ? (
              <div className="text-center py-16 border-2 border-dashed border-[var(--rose-200)] rounded-3xl text-xs text-[var(--ink-soft)] px-4">
                Ничего не найдено. Попробуйте польское написание населенного пункта (например, Kraków, Lwów, Wilno, Warszawa) или снимите часть ограничений.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {result.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => openItem(item)}
                    className="group card-boudoir p-3 text-left hover:-translate-y-1 transition-transform flex flex-col"
                  >
                    <div className="relative aspect-square bg-[var(--rose-100)] rounded-xl overflow-hidden border border-[var(--border)] flex items-center justify-center">
                      {item.previewUrl || item.objectUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={mediaUrl(item.previewUrl || item.objectUrl)}
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
                      {item.dates[0] && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[rgba(74,42,56,.85)] text-white text-[9px] font-bold">
                          {item.dates[0]}
                        </span>
                      )}
                      {item.objectUrl && (
                        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-[rgba(74,42,56,.85)] text-white text-[9px] font-bold flex items-center gap-1">
                          <Download className="w-2.5 h-2.5" /> Скан
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 flex-1">
                      <h2 className="text-xs font-bold text-[var(--plum)] line-clamp-2 leading-snug group-hover:text-[var(--rose-700)]">
                        {item.title}
                      </h2>
                      {item.dataProvider && (
                        <p className="text-[10px] text-[var(--rose-700)] font-bold line-clamp-1">
                          {item.dataProvider}
                        </p>
                      )}
                      {item.descriptions[0] && (
                        <p className="text-[10px] text-[var(--ink-soft)] line-clamp-2 leading-relaxed">
                          {item.descriptions[0]}
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
                Страница {result.page} из {Math.min(result.totalPages, 1000).toLocaleString("pl-PL")}
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

      {/* Item Details Modal */}
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
                  {detail.title || "Архивный документ"}
                </h3>
                {detail.dataProvider && (
                  <p className="text-[10px] text-[var(--rose-700)] font-bold">{detail.dataProvider}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {activeImageUrl && (
                  <button
                    type="button"
                    onClick={() => setIsFullView(true)}
                    className="btn-ghost-rose p-2 rounded-xl text-xs font-bold flex items-center gap-1"
                    title="На весь экран"
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
                      src={mediaUrl(activeImageUrl)}
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

                  <div className="flex flex-wrap gap-2 items-center">
                    <a
                      href={mediaUrl(activeImageUrl, true)}
                      download={fileName}
                      className="btn-rose px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2"
                    >
                      <Download className="w-4 h-4" /> Скачать цифровой скан (JPG)
                    </a>
                    {detail.shownAtUrl && (
                      <a
                        href={detail.shownAtUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost-rose px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Карточка в архиве-источнике
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Metadata */}
              <dl className="grid sm:grid-cols-2 gap-3 text-xs text-[var(--plum-soft)]">
                {detail.dataProvider && (
                  <Field icon={<Building2 className="w-3.5 h-3.5" />} label="Архив" value={detail.dataProvider} />
                )}
                {detail.dates.length > 0 && (
                  <Field icon={<Calendar className="w-3.5 h-3.5" />} label="Датировка / Год" value={detail.dates.join(", ")} />
                )}
                {detail.creators.length > 0 && (
                  <Field label="Создатель / Автор" value={detail.creators.join("; ")} />
                )}
                {detail.type && (
                  <Field icon={<FileText className="w-3.5 h-3.5" />} label="Тип материала" value={detail.type} />
                )}
                {detail.rights && (
                  <Field label="Права / Лицензия" value={detail.rights} />
                )}
              </dl>

              {detail.descriptions.length > 0 && (
                <div className="space-y-1">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                    Описание единицы хранения
                  </h4>
                  <div className="text-xs text-[var(--plum-soft)] leading-relaxed space-y-2 bg-white/70 p-3.5 rounded-2xl border border-[var(--border)]">
                    {detail.descriptions.map((desc, idx) => (
                      <p key={idx}>{desc}</p>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-1 border-t border-[var(--border)]">
                <a
                  href={detail.szwaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--rose-700)] hover:underline"
                >
                  Искать на официальном портале szukajwarchiwach.gov.pl <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Lightbox */}
      {isFullView && activeImageUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-black/95 backdrop-blur-md"
          onClick={() => setIsFullView(false)}
        >
          <button
            type="button"
            onClick={() => setIsFullView(false)}
            className="absolute top-4 right-4 p-2 rounded-2xl bg-white/20 hover:bg-white/30 text-white z-10"
            aria-label="Закрыть"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-[95vw] max-h-[92vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl(activeImageUrl)}
              alt={detail?.title || "Полный скан"}
              className="max-h-[84vh] max-w-full object-contain rounded-lg shadow-2xl"
            />
            <div className="flex gap-2">
              <a
                href={mediaUrl(activeImageUrl, true)}
                download={fileName}
                className="btn-rose px-5 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Скачать скан
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
