"use client";

import React, { useState } from "react";
import type { BookMetadata } from "@/lib/types";
import { FileText, Archive, Check, Calendar, User, Layers, Smartphone, Eye, ExternalLink, Building2, PawPrint, Loader2 } from "lucide-react";
import { parsePageRange } from "@/lib/page-utils";
import { KittenRun, YarnProgress } from "./mascot";

interface BookInspectorCardProps {
  metadata: BookMetadata;
  onStartDownload: (options: { pageRange: string; quality: "original" | "hd" | "mobile"; format: "pdf" | "zip" }) => void;
  onOpenReader: () => void;
  isStarting: boolean;
}

export function BookInspectorCard({ metadata, onStartDownload, onOpenReader, isStarting }: BookInspectorCardProps) {
  const [rangeMode, setRangeMode] = useState<"all" | "custom" | "first10" | "first25">("all");
  const [customRange, setCustomRange] = useState("");
  const [quality, setQuality] = useState<"original" | "hd" | "mobile">("hd");
  const [format, setFormat] = useState<"pdf" | "zip">("pdf");
  const isDirectPdf = Boolean(metadata.directPdfUrl);
  const effectiveRange = rangeMode === "first10" ? `1-${Math.min(10, metadata.totalPages)}` : rangeMode === "first25" ? `1-${Math.min(25, metadata.totalPages)}` : rangeMode === "custom" ? customRange.trim() || "all" : "all";
  const selectedPagesCount = parsePageRange(effectiveRange, metadata.totalPages).length;

  return (
    <section className="card-boudoir p-4 sm:p-6 space-y-6 text-[var(--plum)]">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
        <PawPrint className="w-3.5 h-3.5 text-[var(--rose-500)]" />Котёнок принёс карточку книги — проверьте подписку
      </div>
      <div className="flex flex-col md:flex-row gap-5 items-start">
        <div className="relative group w-32 sm:w-40 h-44 sm:h-56 rounded-2xl overflow-hidden bg-[var(--rose-100)] border border-[var(--border)] shrink-0 shadow-md flex items-center justify-center">
          {metadata.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/proxy-image?url=${encodeURIComponent(metadata.coverUrl)}&referer=${encodeURIComponent(metadata.url)}`} alt={metadata.title} className="w-full h-full object-contain bg-white p-1" onError={(event) => { event.currentTarget.style.display = "none"; }} />
          ) : <div className="text-center text-[var(--ink-soft)]"><PawPrint className="w-9 h-9 mx-auto mb-2 text-[var(--rose-300)]" /><span className="text-[11px] font-bold">Обложка<br />отдыхает</span></div>}
          {!isDirectPdf && metadata.pages.length > 0 && (
            <button onClick={onOpenReader} className="absolute inset-0 bg-[rgba(74,42,56,.55)] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-rose-50 text-xs font-bold gap-1.5"><Eye className="w-6 h-6" />Полистать в читалке</button>
          )}
        </div>
        <div className="flex-1 space-y-3 min-w-0">
          <div className="flex flex-wrap gap-2"><span className="chip">{metadata.libraryName}</span><span className="chip !bg-white"><Layers className="w-3 h-3" />{isDirectPdf ? "готовый PDF целиком" : `${metadata.totalPages} страниц`}</span></div>
          <h2 className="font-display text-lg sm:text-2xl font-bold leading-snug">{metadata.title}</h2>
          <div className="grid sm:grid-cols-2 gap-2 text-xs text-[var(--plum-soft)]">
            {metadata.author && <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-[var(--ink-soft)]" /><span>Автор:</span><strong className="truncate">{metadata.author}</strong></div>}
            {metadata.year && <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-[var(--ink-soft)]" /><span>Год:</span><strong>{metadata.year}</strong></div>}
            {metadata.publisher && <div className="flex items-center gap-1.5 sm:col-span-2"><Building2 className="w-3.5 h-3.5 text-[var(--ink-soft)]" /><span>Издательство:</span><strong className="truncate">{metadata.publisher}</strong></div>}
          </div>
          {metadata.description && <p className="text-xs text-[var(--plum-soft)]/80 line-clamp-3 leading-relaxed">{metadata.description}</p>}
          <a href={metadata.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[var(--rose-700)] font-bold">Оригинал на сайте библиотеки <ExternalLink className="w-3 h-3" /></a>
        </div>
      </div>

      <hr className="border-0 border-t border-[var(--border)]" />
      <div className="grid md:grid-cols-3 gap-5">
        <div className="space-y-2.5">
          <label className="text-[11px] font-extrabold uppercase tracking-wider flex justify-between"><span>Страницы книги</span>{!isDirectPdf && <span className="text-[var(--rose-700)] lowercase">{selectedPagesCount} из {metadata.totalPages}</span>}</label>
          {isDirectPdf ? <InfoText>Эта библиотека отдаёт книгу <strong>одним готовым PDF</strong> — выбирать страницы не нужно.</InfoText> : (
            <>
              <div className="grid grid-cols-2 gap-1.5">
                <Option active={rangeMode === "all"} onClick={() => setRangeMode("all")}>Все ({metadata.totalPages})</Option>
                <Option active={rangeMode === "first10"} onClick={() => setRangeMode("first10")}>Первые 10 стр.</Option>
                <Option active={rangeMode === "first25"} onClick={() => setRangeMode("first25")}>Первые 25 стр.</Option>
                <Option active={rangeMode === "custom"} onClick={() => setRangeMode("custom")}>Свой диапазон</Option>
              </div>
              {rangeMode === "custom" && <input value={customRange} onChange={(event) => setCustomRange(event.target.value)} placeholder="1-15 или 1,3,7-12" className="input-boudoir w-full px-3 py-2 rounded-xl text-xs" />}
            </>
          )}
        </div>

        <div className="space-y-2.5">
          <label className="text-[11px] font-extrabold uppercase tracking-wider block">Формат загрузки</label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setFormat("pdf")} className={`p-3 rounded-2xl flex flex-col items-center text-center tile-rose ${format === "pdf" || isDirectPdf ? "is-active" : ""}`}><FileText className="w-5 h-5" /><span className="text-xs font-extrabold">PDF книга</span><span className="text-[10px] text-[var(--ink-soft)]">Единый файл</span></button>
            <button type="button" onClick={() => setFormat("zip")} disabled={isDirectPdf} className={`p-3 rounded-2xl flex flex-col items-center text-center tile-rose disabled:opacity-40 ${format === "zip" && !isDirectPdf ? "is-active" : ""}`}><Archive className="w-5 h-5" /><span className="text-xs font-extrabold">ZIP архив</span><span className="text-[10px] text-[var(--ink-soft)]">Папка со сканами</span></button>
          </div>
        </div>

        <div className="space-y-2.5">
          <label className="text-[11px] font-extrabold uppercase tracking-wider block">Качество и размер</label>
          {isDirectPdf ? <InfoText>Качество — <strong>как у источника</strong>.</InfoText> : (
            <div className="space-y-1.5">
              <Quality active={quality === "hd"} onClick={() => setQuality("hd")} title="HD (рекомендуется)" note="Чёткий текст, средний размер" />
              <Quality active={quality === "mobile"} onClick={() => setQuality("mobile")} title="Компактное" note="Быстро качается на телефоне" icon={<Smartphone className="w-3 h-3" />} />
              <Quality active={quality === "original"} onClick={() => setQuality("original")} title="Оригинальные сканы" note="Самый большой файл" />
            </div>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <button onClick={() => onStartDownload({ pageRange: effectiveRange, quality, format: isDirectPdf ? "pdf" : format })} disabled={isStarting || selectedPagesCount === 0} className="btn-rose w-full px-6 py-4 rounded-2xl font-extrabold text-sm sm:text-base flex items-center justify-center gap-2.5">
          {isStarting ? <><Loader2 className="w-5 h-5 animate-spin" />Котёнок побежал за книгой…</> : <><PawPrint className="w-5 h-5" />{isDirectPdf ? "Скачать готовый PDF" : `Собрать ${selectedPagesCount} страниц в ${format.toUpperCase()}`}</>}
        </button>
        {isStarting && <div><div className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)]"><KittenRun />Задание передано на сервер — следите за клубочком ниже…</div><YarnProgress percent={6} caption={<>Котёнок тянет ниточку</>} /></div>}
      </div>
    </section>
  );
}

function Option({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`px-2.5 py-2 rounded-xl text-xs font-semibold tile-rose ${active ? "is-active" : ""}`}>{children}</button>;
}
function InfoText({ children }: { children: React.ReactNode }) {
  return <div className="p-3 rounded-xl bg-[var(--rose-100)] border border-[var(--rose-200)] text-xs text-[var(--plum-soft)] leading-relaxed">{children}</div>;
}
function Quality({ active, onClick, title, note, icon }: { active: boolean; onClick: () => void; title: string; note: string; icon?: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between text-xs tile-rose ${active ? "is-active" : ""}`}><div><span className="font-extrabold flex items-center gap-1">{icon}{title}</span><span className="text-[10px] text-[var(--ink-soft)] font-normal">{note}</span></div>{active && <Check className="w-4 h-4" />}</button>;
}
