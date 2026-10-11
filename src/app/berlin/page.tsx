"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Search,
  Loader2,
  Landmark,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  ImageIcon,
  Download,
  Info,
} from "lucide-react";

interface SmbItem {
  objectId: string;
  title: string;
  thumbnailUrl?: string;
  objectUrl: string;
  objectType?: string;
  collection?: string;
}

interface SmbResult {
  items: SmbItem[];
  query: string;
  page: number;
  total: number | null;
  totalPages: number | null;
  hasNextPage: boolean;
}

export default function BerlinCollectionsPage() {
  const [query, setQuery] = useState("portrait");
  const [result, setResult] = useState<SmbResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (targetPage: number, q = query) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/smb/search?q=${encodeURIComponent(q)}&page=${targetPage}`, {
        signal: AbortSignal.timeout(45_000),
      });
      const text = await res.text();
      let data: { success?: boolean; error?: string; result?: SmbResult };
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Сервер вернул не-JSON (HTTP ${res.status}); обновите страницу и повторите поиск.`);
      }
      if (!res.ok || !data.success || !data.result) throw new Error(data.error || "SMB не вернул результаты");
      setResult(data.result);
    } catch (err: unknown) {
      setError(
        err instanceof DOMException && err.name === "TimeoutError"
          ? "SMB Collections Online отвечает слишком долго — попробуйте ещё раз."
          : err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setIsLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void search(1, "portrait");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openObject = (item: SmbItem) => {
    window.location.href = `/?smb=${encodeURIComponent(item.objectUrl)}`;
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(253,247,241,.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)] shrink-0">
            <ArrowLeft className="w-4 h-4" /> Клубок
          </Link>
          <h1 className="font-display text-base sm:text-xl font-bold text-[var(--plum)] flex items-center gap-2 truncate">
            <Landmark className="w-5 h-5 text-[var(--rose-600)] shrink-0" />
            Staatliche Museen zu Berlin
          </h1>
          <span className="chip hidden sm:inline-flex">Collections Online</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3.5 text-xs text-[var(--plum-soft)] flex items-start gap-2.5">
          <Info className="w-4 h-4 text-[var(--rose-600)] shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            Официальные цифровые коллекции Staatliche Museen zu Berlin. Поиск работает через
            публичный серверный каталог SMB — без российского IP и без обходных прокси. Откройте
            объект, затем выберите PDF или ZIP: открытые original JPG соберутся на сервере.
            Лицензия и credit музея сохраняются в карточке источника.
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
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[var(--rose-500)]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="portrait, elephant, Buddha, Cat…"
              className="input-boudoir w-full pl-10 pr-3 py-3 rounded-2xl text-sm"
            />
          </div>
          <button disabled={isLoading} className="btn-rose px-6 py-3 rounded-2xl text-sm font-extrabold flex items-center justify-center gap-2 disabled:opacity-60">
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            Искать в SMB
          </button>
        </form>

        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-sm font-bold text-[var(--rose-700)]">
            <Loader2 className="w-5 h-5 animate-spin" /> Ищем в музеях Берлина…
          </div>
        )}

        {!isLoading && error && (
          <div className="rounded-2xl border border-[#f3c3bb] bg-[#fdf0ed] p-4 text-xs text-[#9a4a3e] space-y-2">
            <p>{error}</p>
            <button onClick={() => void search(result?.page || 1)} className="btn-rose px-3 py-2 rounded-xl text-[11px] font-bold">Повторить</button>
          </div>
        )}

        {!isLoading && !error && result && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-soft)]">
              <span>
                По запросу <strong className="text-[var(--plum)]">«{result.query}»</strong>
                {result.total != null ? <> найдено <strong className="text-[var(--rose-700)]">{result.total.toLocaleString("de-DE")}</strong> объектов</> : ""}
              </span>
              <a href={`https://search.smb.museum/en?q=${encodeURIComponent(result.query)}`} target="_blank" rel="noreferrer" className="font-bold text-[var(--rose-700)] flex items-center gap-1">
                Открыть на SMB <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            {!result.items.length ? (
              <div className="text-center py-16 border-2 border-dashed border-[var(--rose-200)] rounded-3xl text-xs text-[var(--ink-soft)]">Ничего не найдено — попробуйте немецкое или английское слово.</div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {result.items.map((item) => (
                  <button key={item.objectId} onClick={() => openObject(item)} className="group card-boudoir p-3 text-left hover:-translate-y-1 transition-transform">
                    <div className="relative aspect-square bg-[var(--rose-100)] rounded-xl overflow-hidden border border-[var(--border)] flex items-center justify-center">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbnailUrl} alt={item.title} className="w-full h-full object-contain group-hover:scale-105 transition-transform" loading="lazy" />
                      ) : <ImageIcon className="w-7 h-7 text-[var(--ink-soft)]" />}
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-[rgba(74,42,56,.82)] rounded-md text-white text-[9px] font-bold flex items-center gap-1"><Download className="w-2.5 h-2.5" /> JPG</span>
                    </div>
                    <div className="mt-2 space-y-1">
                      <h2 className="text-xs font-bold text-[var(--plum)] line-clamp-2 leading-snug group-hover:text-[var(--rose-700)]">{item.title}</h2>
                      {item.objectType && <p className="text-[10px] text-[var(--ink-soft)] line-clamp-1">{item.objectType}</p>}
                      {item.collection && <p className="text-[10px] text-[var(--ink-soft)] line-clamp-1">{item.collection}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex justify-center items-center gap-3 pt-4">
              <button onClick={() => void search(Math.max(1, result.page - 1))} disabled={result.page <= 1 || isLoading} className="btn-ghost-rose p-2.5 rounded-xl disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-xs font-bold text-[var(--plum)]">Страница {result.page}{result.totalPages ? ` из ${result.totalPages.toLocaleString("de-DE")}` : ""}</span>
              <button onClick={() => void search(result.page + 1)} disabled={!result.hasNextPage || isLoading} className="btn-rose p-2.5 rounded-xl disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
