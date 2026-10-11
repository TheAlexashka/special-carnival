"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Globe,
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
} from "lucide-react";
import { EUROPEANA_TYPES } from "@/lib/europeana";

interface EuropeanaItem {
  id: string;
  title: string;
  creators: string[];
  descriptions: string[];
  countries: string[];
  dataProvider: string | null;
  provider: string | null;
  type: string | null;
  rights: string | null;
  previewUrl: string | null;
  objectUrl: string | null;
  shownAtUrl: string | null;
  noDistribute: boolean;
  europeanaUrl: string;
}

interface SearchResult {
  items: EuropeanaItem[];
  total: number;
  page: number;
  rows: number;
  totalPages: number;
  hasNextPage: boolean;
  query: string;
  providerCounts: Array<{ value: string; count: number }>;
  usedKey: string;
}

interface EuropeanaFile {
  url: string;
  mimetype: string | null;
  rights: string | null;
}

interface RecordDetail {
  id: string;
  title: string | null;
  dates: string[];
  descriptions: string[];
  creators: string[];
  subjects: string[];
  types: string[];
  countries: string[];
  languages: string[];
  dataProvider: string | null;
  rights: string | null;
  objectUrl: string | null;
  shownAtUrl: string | null;
  files: EuropeanaFile[];
  europeanaUrl: string;
}

export default function EuropeanaPage() {
  const [query, setQuery] = useState("portrait");
  const [type, setType] = useState("IMAGE");
  const [provider, setProvider] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [newestFirst, setNewestFirst] = useState(false);
  const [rows, setRows] = useState(24);
  const [showFilters, setShowFilters] = useState(true);

  const [result, setResult] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<RecordDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const search = useCallback(
    async (targetPage: number, overrides?: Record<string, string | boolean | number>) => {
      const pick = <T,>(key: string, fallback: T): T =>
        (overrides?.[key] as T | undefined) ?? fallback;

      const params = new URLSearchParams({
        q: String(pick("query", query)),
        type: String(pick("type", type)),
        provider: String(pick("provider", provider)),
        yearFrom: String(pick("yearFrom", yearFrom)),
        yearTo: String(pick("yearTo", yearTo)),
        onlyOpen: pick("onlyOpen", onlyOpen) ? "1" : "0",
        newestFirst: pick("newestFirst", newestFirst) ? "1" : "0",
        page: String(targetPage),
        rows: String(pick("rows", rows)),
      });

      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/europeana/search?${params.toString()}`, {
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
          throw new Error(data.error || "Europeana не вернула результаты");
        }
        setResult(data.result);
      } catch (err: unknown) {
        setError(
          err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")
            ? "Europeana отвечает слишком долго — попробуйте ещё раз."
            : err instanceof Error
            ? err.message
            : String(err)
        );
      } finally {
        setIsLoading(false);
      }
    },
    [query, type, provider, yearFrom, yearTo, onlyOpen, newestFirst, rows]
  );

  useEffect(() => {
    void search(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openItem = useCallback(async (item: EuropeanaItem) => {
    setIsLoadingDetail(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/europeana/record/${encodeURIComponent(item.id)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setDetail({ ...data.record, title: data.record.title || item.title });
    } catch (err: unknown) {
      // Запись недоступна — показываем то, что уже есть в выдаче.
      setDetail({
        id: item.id,
        title: item.title,
        dates: [],
        descriptions: item.descriptions,
        creators: item.creators,
        subjects: [],
        types: item.type ? [item.type] : [],
        countries: item.countries,
        languages: [],
        dataProvider: item.dataProvider,
        rights: item.rights,
        objectUrl: item.objectUrl,
        shownAtUrl: item.shownAtUrl,
        files: item.objectUrl ? [{ url: item.objectUrl, mimetype: null, rights: item.rights }] : [],
        europeanaUrl: item.europeanaUrl,
      });
      setError(err instanceof Error ? `Часть сведений не загрузилась: ${err.message}` : null);
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
            <Globe className="w-5 h-5 text-[var(--rose-600)]" />
            Europeana
          </h1>
          <a
            href="https://www.europeana.eu/"
            target="_blank"
            rel="noreferrer"
            className="chip hidden sm:inline-flex"
          >
            europeana.eu
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3.5 text-xs text-[var(--plum-soft)] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Официальный Search/Record API Europeana: 50+ млн объектов от тысяч учреждений
            Европы. Фильтры — тип, открытый доступ, годы и провайдер. Скачиваем файл, на который
            ссылается сама Europeana (edmIsShownBy / edmObject); там, где партнёр запретил раздачу
            превью, показываем только ссылку на карточку.
            {result && (
              <>
                {" "}
                Ключ API: <strong className="text-[var(--plum)]">{result.usedKey}</strong>.
              </>
            )}
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
                placeholder="portrait, Kaiser, Karte, Mozart…"
                className="input-boudoir w-full pl-10 pr-3 py-3 rounded-2xl text-sm"
              />
            </div>
            <select
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                void search(1, { type: e.target.value });
              }}
              className="input-boudoir px-3 py-3 rounded-2xl text-xs sm:w-52"
              title="Тип объекта — встроенный фильтр Europeana"
            >
              <option value="">Любой тип</option>
              {EUROPEANA_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
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
                  Год — с
                </label>
                <input
                  value={yearFrom}
                  onChange={(e) => setYearFrom(e.target.value)}
                  placeholder="1800"
                  inputMode="numeric"
                  className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] block">
                  Год — по
                </label>
                <input
                  value={yearTo}
                  onChange={(e) => setYearTo(e.target.value)}
                  placeholder="1899"
                  inputMode="numeric"
                  className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] block">
                  Провайдер (точное имя)
                </label>
                <input
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  placeholder="Deutsche Fotothek"
                  className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--plum-soft)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={onlyOpen}
                    onChange={(e) => {
                      setOnlyOpen(e.target.checked);
                      void search(1, { onlyOpen: e.target.checked });
                    }}
                    className="w-3.5 h-3.5 accent-[#c05e7d]"
                  />
                  только открытый доступ
                </label>
                <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--plum-soft)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newestFirst}
                    onChange={(e) => {
                      setNewestFirst(e.target.checked);
                      void search(1, { newestFirst: e.target.checked });
                    }}
                    className="w-3.5 h-3.5 accent-[#c05e7d]"
                  />
                  сначала новые
                </label>
              </div>
            </div>
          )}

          {result && result.providerCounts.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                Уточнить по провайдеру (из текущей выдачи)
              </span>
              <div className="flex flex-wrap gap-1.5">
                {result.providerCounts.map((entry) => (
                  <button
                    key={entry.value}
                    type="button"
                    onClick={() => {
                      const next = provider === entry.value ? "" : entry.value;
                      setProvider(next);
                      void search(1, { provider: next });
                    }}
                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold tile-rose flex items-center gap-1.5 ${
                      provider === entry.value ? "is-active" : ""
                    }`}
                  >
                    {entry.value}
                    <span className="text-[9px] opacity-70">{entry.count}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-sm font-bold text-[var(--rose-700)]">
            <Loader2 className="w-5 h-5 animate-spin" /> Europeana перебирает 50 миллионов объектов…
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
                {type && <span className="chip !text-[10px] ml-1.5">{type}</span>}
                {provider && <span className="chip !text-[10px] ml-1.5">{provider}</span>}
                {(yearFrom || yearTo) && (
                  <span className="chip !text-[10px] ml-1.5">
                    {yearFrom || "…"}–{yearTo || "…"}
                  </span>
                )}
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
                {[12, 24, 36, 48].map((n) => (
                  <option key={n} value={n}>
                    {n} / стр.
                  </option>
                ))}
              </select>
            </div>

            {!result.items.length ? (
              <div className="text-center py-16 border-2 border-dashed border-[var(--rose-200)] rounded-3xl text-xs text-[var(--ink-soft)] px-4">
                Ничего не найдено. Снимите часть фильтров или поищите другое слово (Europeana лучше
                ищет по немецким/французским названиям).
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                {result.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => void openItem(item)}
                    className="group card-boudoir p-3 text-left hover:-translate-y-1 transition-transform flex flex-col"
                  >
                    <div className="relative aspect-square bg-[var(--rose-100)] rounded-xl overflow-hidden border border-[var(--border)] flex items-center justify-center">
                      {item.previewUrl && !item.noDistribute ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.previewUrl}
                          alt={item.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="text-center text-[var(--ink-soft)] px-2">
                          <ImageOff className="w-6 h-6 mx-auto mb-1" />
                          <span className="text-[9px] font-bold">
                            {item.noDistribute ? "превью нельзя раздавать" : "без превью"}
                          </span>
                        </div>
                      )}
                      {item.type && (
                        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[rgba(74,42,56,.85)] text-white text-[9px] font-bold">
                          {item.type}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 flex-1">
                      <h2 className="text-xs font-bold text-[var(--plum)] line-clamp-2 leading-snug group-hover:text-[var(--rose-700)]">
                        {item.title}
                      </h2>
                      {item.creators[0] && (
                        <p className="text-[10px] text-[var(--rose-700)] font-bold line-clamp-1">{item.creators[0]}</p>
                      )}
                      {item.descriptions[0] && (
                        <p className="text-[10px] text-[var(--ink-soft)] line-clamp-2 leading-relaxed">
                          {item.descriptions[0]}
                        </p>
                      )}
                      {item.dataProvider && (
                        <p className="text-[10px] text-[var(--ink-soft)] line-clamp-1 mt-auto pt-1">
                          {item.dataProvider}
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
                Страница {result.page} из {Math.min(result.totalPages, 1000).toLocaleString("de-DE")}
                {result.totalPages > 1000 ? " (Europeana отдаёт первые 1000)" : ""}
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
              {isLoadingDetail && (
                <div className="flex items-center justify-center py-16 gap-2 text-sm font-bold text-[var(--rose-700)]">
                  <Loader2 className="w-5 h-5 animate-spin" /> Достаём карточку…
                </div>
              )}

              {detail && (
                <>
                  {detail.objectUrl && (
                    <div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--rose-100)] flex items-center justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/europeana/media?url=${encodeURIComponent(detail.objectUrl)}`}
                        alt={detail.title || ""}
                        className="max-h-[52vh] w-full object-contain"
                      />
                    </div>
                  )}

                  <dl className="grid sm:grid-cols-2 gap-3 text-xs text-[var(--plum-soft)]">
                    {detail.dates.length > 0 && <Field label="Дата создания" value={detail.dates.join("; ")} />}
                    {detail.creators.length > 0 && <Field label="Автор" value={detail.creators.join("; ")} />}
                    {detail.types.length > 0 && <Field label="Тип" value={detail.types.join("; ")} />}
                    {detail.dataProvider && <Field label="Учреждение" value={detail.dataProvider} />}
                    {detail.countries.length > 0 && <Field label="Страна" value={detail.countries.join(", ")} />}
                    {detail.rights && <Field label="Права" value={detail.rights} />}
                  </dl>

                  {detail.descriptions.length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] mb-1">
                        Описание
                      </h4>
                      <div className="text-xs text-[var(--plum-soft)] leading-relaxed space-y-1.5">
                        {detail.descriptions.slice(0, 3).map((text) => (
                          <p key={text}>{text}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.files.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                        Файлы у партнёра ({detail.files.length})
                      </h4>
                      {detail.files.map((file) => (
                        <div
                          key={file.url}
                          className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 border border-[var(--border)] px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="text-[10px] text-[var(--ink-soft)] truncate">
                              {file.mimetype || "медиа"}
                              {file.rights ? ` · ${file.rights}` : ""}
                            </p>
                            <p className="text-[10px] text-[var(--plum-soft)] break-all leading-tight">{file.url}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <a
                              href={`/api/europeana/media?url=${encodeURIComponent(file.url)}&download=1`}
                              className="btn-rose px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" /> Скачать
                            </a>
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="btn-ghost-rose px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1"
                            >
                              <ExternalLink className="w-3 h-3" /> Источник
                            </a>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3 pt-1">
                    <a
                      href={detail.europeanaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-bold text-[var(--rose-700)] flex items-center gap-1.5"
                    >
                      Открыть на Europeana <ExternalLink className="w-3 h-3" />
                    </a>
                    {detail.shownAtUrl && (
                      <a
                        href={detail.shownAtUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs font-bold text-[var(--rose-700)] flex items-center gap-1.5"
                      >
                        Карточка у партнёра <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
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
