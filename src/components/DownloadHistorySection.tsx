"use client";

import React, { useState } from "react";
import type { DownloadProgress } from "@/lib/types";
import { History, Download, Trash2, FileText, Archive, Share2, Clock, ExternalLink, Loader2, AlertTriangle, CheckCircle2, RotateCcw, Check } from "lucide-react";
import { formatFileSize, formatDate } from "@/lib/utils";
import { KittenSleep, YarnProgress } from "./mascot";

interface Props {
  history: DownloadProgress[];
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
  onReDownload?: (item: DownloadProgress) => void;
  isLoading?: boolean;
}

export function DownloadHistorySection({ history, onClearHistory, onDeleteHistoryItem, onReDownload, isLoading = false }: Props) {
  const [searchTerm, setSearchTerm] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const filtered = history.filter((item) => `${item.title} ${item.libraryName}`.toLowerCase().includes(searchTerm.toLowerCase()));
  const share = async (item: DownloadProgress) => {
    if (!item.fileUrl) return;
    const url = window.location.origin + item.fileUrl;
    if (navigator.share) { try { await navigator.share({ title: item.title, url }); } catch { /* cancelled */ } }
    else { try { await navigator.clipboard.writeText(url); setCopiedId(item.jobId); setTimeout(() => setCopiedId(null), 2000); } catch { alert(`Ссылка: ${url}`); } }
  };

  return (
    <section id="download-history" className="card-boudoir p-4 sm:p-6 space-y-4 scroll-mt-20">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2"><History className="w-5 h-5 text-[var(--rose-600)]" /><h3 className="font-display text-lg sm:text-xl font-bold">История загрузок</h3><span className="chip">{history.length}</span>{isLoading && <Loader2 className="w-4 h-4 animate-spin" />}</div>
        <div className="flex items-center gap-2">{history.length > 3 && <input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Поиск по истории…" className="input-boudoir px-3 py-1.5 rounded-xl text-xs w-44" />}{history.length > 0 && <button onClick={onClearHistory} className="text-xs text-[var(--ink-soft)] hover:text-[#b04a3c] flex items-center gap-1 px-2.5 py-1.5"><Trash2 className="w-3.5 h-3.5" /><span className="hidden sm:inline">Очистить</span></button>}</div>
      </div>
      <p className="text-xs text-[var(--plum-soft)]/85">Всё, что вы уже просили у котёнка, лежит здесь. Готовый файл можно <strong className="text-[var(--rose-700)]">скачать снова</strong> без повторной обработки.</p>
      {!history.length ? (
        <div className="flex flex-col items-center justify-center py-6 text-center gap-2 border-2 border-dashed border-[var(--rose-200)] rounded-3xl bg-[rgba(253,231,224,.35)]"><KittenSleep /><p className="font-display text-sm font-bold">Котёнок пока дремлет — история пуста</p><p className="text-xs text-[var(--ink-soft)] max-w-sm">Вставьте ссылку выше — готовая книга поселится здесь.</p></div>
      ) : !filtered.length ? <div className="text-center py-6 text-xs text-[var(--ink-soft)]">По запросу «{searchTerm}» котёнок ничего не нашёл</div> : (
        <div className="divide-y divide-[var(--border)]">
          {filtered.map((item) => {
            const completed = item.status === "completed";
            const processing = item.status === "processing" || item.status === "pending";
            const failed = item.status === "failed";
            return <article key={item.jobId} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 group">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="p-2.5 rounded-2xl bg-[var(--rose-100)] border border-[var(--rose-200)] shrink-0 text-[var(--rose-600)]">{item.format === "zip" ? <Archive className="w-4 h-4" /> : <FileText className="w-4 h-4" />}</div>
                <div className="space-y-1 min-w-0 flex-1"><h4 className="text-xs sm:text-sm font-bold line-clamp-2">{item.title}</h4><div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--ink-soft)]"><strong className="text-[var(--rose-700)]">{item.libraryName}</strong><span>·</span><span>{item.totalPages} стр.</span><span className="uppercase font-extrabold">{item.format}</span>{item.fileSize ? <><span>·</span><strong className="text-[#4c7a58]">{formatFileSize(item.fileSize)}</strong></> : null}<span>·</span><span className="flex gap-1"><Clock className="w-3 h-3" />{formatDate(item.createdAt)}</span></div>
                  {completed && <span className="text-[11px] font-extrabold text-[#4c7a58] flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" />Готово — ждёт на полочке</span>}
                  {processing && <><span className="text-[11px] font-bold text-[var(--rose-700)] flex items-center gap-1"><Loader2 className="w-3.5 h-3.5 animate-spin" />Обрабатывается: {item.currentPage}/{item.totalPages}</span><div className="max-w-xs pt-1"><YarnProgress percent={item.progressPercent} /></div></>}
                  {failed && <span className="text-[11px] font-bold text-[#b04a3c] flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />Ошибка: {item.errorMessage?.slice(0, 80) || "клубок запутался"}</span>}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0 self-end sm:self-center">
                {completed && item.fileUrl && <><a href={item.fileUrl} download={item.fileName || undefined} className="btn-rose px-3 py-2 rounded-2xl font-extrabold text-xs flex gap-1.5"><Download className="w-3.5 h-3.5" />Скачать снова</a><button onClick={() => share(item)} className="btn-ghost-rose px-2.5 py-2 rounded-2xl text-xs flex gap-1">{copiedId === item.jobId ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}</button></>}
                {failed && onReDownload && <button onClick={() => onReDownload(item)} className="btn-ghost-rose px-3 py-2 rounded-2xl text-xs flex gap-1"><RotateCcw className="w-3.5 h-3.5" />Повторить</button>}
                {(item as unknown as { url?: string }).url && (
                  <a
                    href={(item as unknown as { url?: string }).url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-[var(--ink-soft)] hover:text-[var(--rose-700)] transition-colors"
                    title="Открыть оригинал в библиотеке"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                <button onClick={() => onDeleteHistoryItem(item.jobId)} className="p-2 text-[var(--ink-soft)] hover:text-[#b04a3c]" title="Удалить"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
