"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Landmark, Search, Loader2, ChevronLeft, ChevronRight,
  ExternalLink, Download, ImageOff, AlertTriangle, ShieldCheck, X,
  Calendar, Filter, FileText,
} from "lucide-react";
import { DDB_SECTORS, DDB_YEAR_PRESETS } from "@/lib/ddb";

interface DdbItem {
  id: string; title: string; sector: string; objectType: string | null;
  provider: string | null; dataprovider: string | null; license: string | null;
  year: number | null; yearTo: number | null; dateLabel: string | null;
  description: string | null; place: string | null; technique: string | null;
  imageUrl: string | null; imageFallbackUrl: string | null; pdfUrl: string | null;
  itemUrl: string; hasImage: boolean;
}
interface DdbFacet { field: string; values: Array<{ value: string; count: number }> }
interface DdbResult {
  items: DdbItem[]; total: number; page: number; rows: number;
  totalPages: number; hasNextPage: boolean; sector: string | null;
  objectType: string | null; yearFrom: number | null; yearTo: number | null;
  facets: DdbFacet[];
}
interface DdbBinary {
  ref: string; license: string | null; mimetype: string | null;
  localPath: string | null; fallbackUrl: string | null;
}
interface DdbDetail {
  id: string; title: string; subtitle: string | null; provider: string | null;
  rights: string | null; metadataRights: string | null; description: string | null;
  dateLabel: string | null; imageUrl: string | null; imageFallbackUrl: string | null;
  pdfUrl: string | null; binaries: DdbBinary[]; itemUrl: string;
}

const sectorLabel = (id: string | null) =>
  DDB_SECTORS.find((s) => s.id === id)?.label ?? id ?? "все спарты";

/** Source first, DDB-hosted IIIF fallback second (needed e.g. for DHM 403 images). */
function mediaUrl(url: string, fallback?: string | null, referer?: string, download = false) {
  const params = new URLSearchParams({ url });
  if (fallback) params.set("fallback", fallback);
  if (referer) params.set("referer", referer);
  if (download) params.set("download", "1");
  return `/api/ddb/media?${params.toString()}`;
}

export default function DdbPage() {
  const [query, setQuery] = useState("porträt");
  const [sector, setSector] = useState("");
  const [objectType, setObjectType] = useState("");
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");
  const [onlyImages, setOnlyImages] = useState(true);
  const [rows, setRows] = useState(24);
  const [showFilters, setShowFilters] = useState(true);
  const [result, setResult] = useState<DdbResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<DdbDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const search = useCallback(async (targetPage: number, overrides?: Record<string, string | number | boolean>) => {
    const pick = <T,>(key: string, fallback: T): T => (overrides?.[key] as T | undefined) ?? fallback;
    const q = String(pick("query", query));
    const sec = String(pick("sector", sector));
    const obj = String(pick("objectType", objectType));
    const yFrom = String(pick("yearFrom", yearFrom));
    const yTo = String(pick("yearTo", yearTo));
    const images = Boolean(pick("onlyImages", onlyImages));
    const pageRows = Number(pick("rows", rows));

    setIsLoading(true);
    setError(null);
    const params = new URLSearchParams({
      q, sector: sec, objectType: obj, yearFrom: yFrom, yearTo: yTo,
      onlyImages: images ? "1" : "0", page: String(targetPage), rows: String(pageRows),
    });
    try {
      const res = await fetch(`/api/ddb/search?${params.toString()}`, { signal: AbortSignal.timeout(75_000) });
      const text = await res.text();
      let data: { success?: boolean; error?: string; result?: DdbResult };
      try { data = JSON.parse(text) as typeof data; }
      catch { throw new Error(`Сервер вернул не-JSON (HTTP ${res.status}). Обновите страницу и повторите.`); }
      if (!res.ok || !data.success || !data.result) throw new Error(data.error || "DDB не вернул результаты");
      setResult(data.result);
    } catch (err: unknown) {
      setError(err instanceof DOMException && (err.name === "TimeoutError" || err.name === "AbortError")
        ? "DDB отвечает слишком долго — попробуйте ещё раз или уменьшите число результатов."
        : err instanceof Error ? err.message : String(err));
    } finally { setIsLoading(false); }
  }, [query, sector, objectType, yearFrom, yearTo, onlyImages, rows]);

  useEffect(() => { void search(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const openItem = useCallback(async (id: string) => {
    setIsLoadingDetail(true); setDetail(null);
    try {
      const res = await fetch(`/api/ddb/item/${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setDetail(data.item as DdbDetail);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally { setIsLoadingDetail(false); }
  }, []);

  const objectTypeFacet = result?.facets?.find((facet) => facet.field === "objecttype_fct")?.values ?? [];
  const clearObjectType = () => { setObjectType(""); void search(1, { objectType: "" }); };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(253,247,241,.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)] shrink-0"><ArrowLeft className="w-4 h-4"/> Клубок</Link>
          <h1 className="font-display text-base sm:text-xl font-bold text-[var(--plum)] flex items-center gap-2 truncate"><Landmark className="w-5 h-5 text-[var(--rose-600)]"/>Deutsche Digitale Bibliothek</h1>
          <a href="https://www.deutsche-digitale-bibliothek.de/" target="_blank" rel="noreferrer" className="chip hidden sm:inline-flex">ddb.de</a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-5">
        <div className="rounded-2xl border border-[var(--border)] bg-white/70 p-3.5 text-xs text-[var(--plum-soft)] flex items-start gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5"/>
          <p className="leading-relaxed">Официальный публичный API DDB: поиск, живые категории, даты создания и цифровые копии. Если учреждение закрывает прямую ссылку на фотографию, пробуем IIIF-копию, хранящуюся у самой DDB.</p>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void search(1); }} className="card-boudoir p-3 sm:p-4 space-y-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1"><Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--rose-500)]"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="porträt, Berlin, Handschrift, Karte…" className="input-boudoir w-full pl-10 pr-3 py-3 rounded-2xl text-sm"/></div>
            <select value={sector} onChange={(event) => { setSector(event.target.value); void search(1, { sector: event.target.value }); }} className="input-boudoir px-3 py-3 rounded-2xl text-xs sm:w-56" title="Сектор DDB">
              <option value="">Все спарты</option>{DDB_SECTORS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <button type="button" onClick={() => setShowFilters((value) => !value)} className="btn-ghost-rose px-3 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5"><Filter className="w-3.5 h-3.5"/>Фильтры</button>
            <button disabled={isLoading} className="btn-rose px-6 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 disabled:opacity-60">{isLoading ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}Искать</button>
          </div>
          {showFilters && <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--plum-soft)]">Категория (фасеты DDB)</span>{objectType && <button type="button" onClick={clearObjectType} className="text-[11px] font-bold text-[var(--rose-700)] hover:underline">снять</button>}</div>
              {objectTypeFacet.length ? <div className="flex flex-wrap gap-1.5">{objectTypeFacet.slice(0, 18).map((item) => <button key={item.value} type="button" onClick={() => { const next = objectType === item.value ? "" : item.value; setObjectType(next); void search(1, { objectType: next }); }} className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold tile-rose flex items-center gap-1.5 ${objectType === item.value ? "is-active" : ""}`}>{item.value}<span className="text-[9px] opacity-70">{item.count.toLocaleString("de-DE")}</span></button>)}</div> : <p className="text-[11px] text-[var(--ink-soft)]">Нажмите «Искать» — категории появятся из текущей выдачи.</p>}
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
              <div className="space-y-1"><label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] flex items-center gap-1"><Calendar className="w-3 h-3"/>Год — с</label><input value={yearFrom} onChange={(event) => setYearFrom(event.target.value)} placeholder="1800" inputMode="numeric" className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"/></div>
              <div className="space-y-1"><label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">Год — по</label><input value={yearTo} onChange={(event) => setYearTo(event.target.value)} placeholder="1899" inputMode="numeric" className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"/></div>
              <div className="space-y-1"><label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] block">Быстрый выбор</label><select onChange={(event) => { const preset = DDB_YEAR_PRESETS[Number(event.target.value)]; if (!preset) { setYearFrom(""); setYearTo(""); return; } setYearFrom(String(preset.from)); setYearTo(String(preset.to)); void search(1, { yearFrom: String(preset.from), yearTo: String(preset.to) }); }} className="input-boudoir w-full px-2 py-2 rounded-xl text-xs" defaultValue=""><option value="">— период —</option>{DDB_YEAR_PRESETS.map((preset, index) => <option key={preset.label} value={index}>{preset.label}</option>)}</select></div>
              <div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-[11px] font-bold text-[var(--plum-soft)] cursor-pointer"><input type="checkbox" checked={onlyImages} onChange={(event) => { setOnlyImages(event.target.checked); void search(1, { onlyImages: event.target.checked }); }} className="w-3.5 h-3.5 accent-[#c05e7d]"/>только с цифровой копией</label><select value={rows} onChange={(event) => { const next = Number(event.target.value); setRows(next); void search(1, { rows: next }); }} className="input-boudoir px-2 py-2 rounded-xl text-xs">{[12,24,36,48].map((count) => <option key={count} value={count}>{count} / стр.</option>)}</select></div>
            </div>
          </div>}
        </form>

        {isLoading && <div className="flex items-center justify-center py-16 gap-2 text-sm font-bold text-[var(--rose-700)]"><Loader2 className="w-5 h-5 animate-spin"/>Роемся в немецких коллекциях…</div>}
        {!isLoading && error && <div className="rounded-2xl border border-[#f3c3bb] bg-[#fdf0ed] p-4 text-xs text-[#9a4a3e] flex items-start gap-2.5"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5"/><div className="space-y-2"><p>{error}</p><button onClick={() => void search(result?.page ?? 1)} className="px-3 py-1.5 rounded-xl bg-[#c05e7d] text-white font-bold">Повторить</button></div></div>}

        {!isLoading && !error && result && <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--ink-soft)]"><span className="flex flex-wrap items-center gap-1.5"><strong className="text-[var(--plum)]">{result.total.toLocaleString("de-DE")}</strong> объектов <span className="chip !text-[10px]">{sectorLabel(result.sector)}</span>{result.objectType && <span className="chip !text-[10px]">{result.objectType}</span>}{(result.yearFrom || result.yearTo) && <span className="chip !text-[10px]">{result.yearFrom ?? "…"}–{result.yearTo ?? "…"}</span>}</span><a href={`https://www.deutsche-digitale-bibliothek.de/searchresults?query=${encodeURIComponent(query)}`} target="_blank" rel="noreferrer" className="font-bold text-[var(--rose-700)] flex items-center gap-1">Открыть на ddb.de <ExternalLink className="w-3 h-3"/></a></div>
          {!result.items.length ? <div className="text-center py-16 border-2 border-dashed border-[var(--rose-200)] rounded-3xl text-xs text-[var(--ink-soft)] px-4">Пусто. Снимите часть фильтров или поищите более общее слово.</div> : <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">{result.items.map((item) => <button key={item.id} onClick={() => void openItem(item.id)} className="group card-boudoir p-3 text-left hover:-translate-y-1 transition-transform flex flex-col"><div className="relative aspect-square bg-[var(--rose-100)] rounded-xl overflow-hidden border border-[var(--border)] flex items-center justify-center">{item.imageUrl ? <img src={mediaUrl(item.imageUrl,item.imageFallbackUrl,item.itemUrl)} alt={item.title} loading="lazy" className="w-full h-full object-cover" onError={(event) => { event.currentTarget.style.display="none"; }}/> : <div className="text-center text-[var(--ink-soft)] px-2">{item.pdfUrl?<FileText className="w-6 h-6 mx-auto mb-1 text-[var(--rose-600)]"/>:<ImageOff className="w-6 h-6 mx-auto mb-1"/>}<span className="text-[9px] font-bold">{item.pdfUrl?"PDF-скан":"без цифровой копии"}</span></div>}{item.dateLabel&&<span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-[rgba(74,42,56,.85)] text-white text-[9px] font-bold">{item.dateLabel}</span>}</div><div className="mt-2 space-y-1 flex-1"><h2 className="text-xs font-bold text-[var(--plum)] line-clamp-2 leading-snug group-hover:text-[var(--rose-700)]">{item.title}</h2><p className="text-[10px] text-[var(--rose-700)] font-bold">{item.objectType||"—"}</p>{item.description&&<p className="text-[10px] text-[var(--ink-soft)] line-clamp-2 leading-relaxed">{item.description}</p>}{item.provider&&<p className="text-[10px] text-[var(--ink-soft)] line-clamp-1 pt-1">{item.provider}</p>}</div></button>)}</div>}
          <div className="flex justify-center items-center gap-3 pt-4"><button onClick={() => void search(result.page-1)} disabled={result.page<=1||isLoading} className="btn-ghost-rose p-2.5 rounded-xl disabled:opacity-40"><ChevronLeft className="w-4 h-4"/></button><span className="text-xs font-bold text-[var(--plum)]">Страница {result.page} из {result.totalPages.toLocaleString("de-DE")}</span><button onClick={() => void search(result.page+1)} disabled={!result.hasNextPage||isLoading} className="btn-rose p-2.5 rounded-xl disabled:opacity-40"><ChevronRight className="w-4 h-4"/></button></div>
        </>}
      </main>

      {(detail||isLoadingDetail)&&<div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[rgba(58,32,44,.85)] backdrop-blur-md" onClick={()=>setDetail(null)}><div className="card-boudoir max-w-4xl w-full max-h-[94vh] overflow-y-auto" onClick={(event)=>event.stopPropagation()}><div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[rgba(253,247,241,.96)]"><h3 className="font-display text-sm sm:text-base font-bold truncate pr-3">{detail?.title||"Загрузка…"}</h3><button onClick={()=>setDetail(null)} className="p-2 rounded-xl hover:bg-[var(--rose-100)] shrink-0"><X className="w-4 h-4"/></button></div><div className="p-4 sm:p-6 space-y-4">{isLoadingDetail&&<div className="flex items-center justify-center py-16 gap-2 text-sm font-bold text-[var(--rose-700)]"><Loader2 className="w-5 h-5 animate-spin"/>Готовим карточку…</div>}{detail&&<>
        {detail.imageUrl&&<div className="rounded-2xl overflow-hidden border border-[var(--border)] bg-[var(--rose-100)] flex items-center justify-center"><img src={mediaUrl(detail.imageUrl,detail.imageFallbackUrl,detail.itemUrl)} alt={detail.title} className="max-h-[54vh] w-full object-contain"/></div>}
        {!detail.imageUrl&&detail.pdfUrl&&<a href={mediaUrl(detail.pdfUrl,null,detail.itemUrl,true)} className="rounded-2xl border border-[var(--border)] bg-white/70 p-4 text-xs font-bold text-[var(--plum)] flex items-center justify-between gap-3"><span className="flex items-center gap-2"><FileText className="w-4 h-4 text-[var(--rose-600)]"/>У объекта PDF-скан</span><span className="btn-rose px-3 py-1.5 rounded-lg text-[11px]">Скачать PDF</span></a>}
        <dl className="grid sm:grid-cols-2 gap-3 text-xs text-[var(--plum-soft)]">{detail.dateLabel&&<Field label="Год создания" value={detail.dateLabel}/ >}{detail.subtitle&&<Field label="Тип" value={detail.subtitle}/ >}{detail.provider&&<Field label="Провайдер" value={detail.provider}/ >}{detail.rights&&<Field label="Права" value={detail.rights}/ >}{detail.metadataRights&&<Field label="Права на метаданные" value={detail.metadataRights}/ >}</dl>
        {detail.description&&<div><h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] mb-1">Описание</h4><p className="text-xs text-[var(--plum-soft)] leading-relaxed whitespace-pre-line">{detail.description}</p></div>}
        {detail.binaries.length>0&&<div className="space-y-2"><h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">Цифровые копии у источника ({detail.binaries.length})</h4>{detail.binaries.map((binary)=><div key={binary.ref||binary.localPath} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/70 border border-[var(--border)] px-3 py-2"><div className="min-w-0"><p className="text-[10px] text-[var(--ink-soft)] truncate">{binary.mimetype||"медиа"}{binary.license?` · ${binary.license}`:""}</p>{binary.localPath&&<p className="text-[10px] text-[var(--plum-soft)] break-all leading-tight">{binary.localPath}</p>}</div>{binary.localPath&&<div className="flex gap-2 shrink-0"><a href={mediaUrl(binary.localPath,binary.fallbackUrl,detail.itemUrl,true)} className="btn-rose px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1"><Download className="w-3 h-3"/>Скачать</a><a href={binary.localPath} target="_blank" rel="noreferrer" className="btn-ghost-rose px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1"><ExternalLink className="w-3 h-3"/>Источник</a></div>}</div>)}</div>}
        <a href={detail.itemUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--rose-700)]">Открыть карточку на ddb.de <ExternalLink className="w-3 h-3"/></a>
      </>}</div></div></div>}
    </div>
  );
}

function Field({label,value}:{label:string;value:string}) { return <div><dt className="text-[10px] uppercase font-bold tracking-wide text-[var(--ink-soft)]">{label}</dt><dd className="font-bold text-[var(--plum)] break-words">{value}</dd></div>; }
