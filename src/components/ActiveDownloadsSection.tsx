"use client";

import React from "react";
import type { DownloadProgress } from "@/lib/types";
import { Download, Share2, CheckCircle2, AlertTriangle, Loader2, RefreshCw, PawPrint, Check, ExternalLink } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import { YarnProgress, KittenRun } from "./mascot";

interface ActiveDownloadsSectionProps {
  downloads: DownloadProgress[];
  onOpenReader?: (job: DownloadProgress) => void;
  onRetry?: (job: DownloadProgress) => void;
}

export function ActiveDownloadsSection({ downloads, onRetry }: ActiveDownloadsSectionProps) {
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  if (!downloads.length) return null;

  const handleShare = async (job: DownloadProgress) => {
    if (!job.fileUrl) return;
    const fullUrl = window.location.origin + job.fileUrl;
    if (navigator.share) {
      try { await navigator.share({ title: job.title, text: `Книга «${job.title}» из библиотеки`, url: fullUrl }); } catch { /* cancelled */ }
    } else {
      try { await navigator.clipboard.writeText(fullUrl); setCopiedId(job.jobId); setTimeout(() => setCopiedId(null), 2000); } catch { alert(`Ссылка: ${fullUrl}`); }
    }
  };

  return (
    <section id="active-downloads" className="space-y-4 scroll-mt-20">
      <h3 className="font-display text-xl font-bold flex items-center gap-2"><KittenRun className="!w-9" />Котёнок в погоне <span className="chip">{downloads.length}</span></h3>
      <div className="space-y-3">
        {downloads.map((job) => {
          const processing = job.status === "processing" || job.status === "pending";
          const completed = job.status === "completed";
          const failed = job.status === "failed";
          return (
            <article key={job.jobId} className="card-boudoir p-4 sm:p-5" style={{ borderColor: completed ? "rgba(127,163,136,.55)" : failed ? "#f3c3bb" : "var(--rose-200)" }}>
              <div className="flex flex-col sm:flex-row gap-4 items-start justify-between">
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="chip">{job.libraryName}</span><span className="chip !bg-white uppercase">{job.format}</span><span className="text-[11px] text-[var(--ink-soft)] font-semibold">{job.quality === "original" ? "Оригинал" : job.quality === "mobile" ? "Компакт" : "HD"}</span></div>
                  <h4 className="font-display text-base sm:text-lg font-bold line-clamp-2">{job.title}</h4>
                  {processing && <span className="text-xs text-[var(--rose-700)] flex items-center gap-1.5 font-bold"><Loader2 className="w-3.5 h-3.5 animate-spin" />Котёнок несёт страницы: {job.currentPage} из {job.totalPages}</span>}
                  {completed && <span className="text-xs text-[#4c7a58] flex items-center gap-1.5 font-extrabold"><CheckCircle2 className="w-4 h-4" />Готово • {formatFileSize(job.fileSize)}</span>}
                  {failed && <span className="text-xs text-[#b04a3c] flex items-center gap-1.5 font-bold"><AlertTriangle className="w-4 h-4" />Ошибка: {job.errorMessage || "клубок запутался"}</span>}
                </div>
                <div className="flex flex-wrap sm:flex-col gap-2 w-full sm:w-auto shrink-0">
                  {completed && job.fileUrl && <><a href={job.fileUrl} download={job.fileName || undefined} className="btn-rose flex-1 px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center justify-center gap-2"><Download className="w-4 h-4" />Скачать {job.format.toUpperCase()}</a><button onClick={() => handleShare(job)} className="btn-ghost-rose px-3 py-2 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5">{copiedId === job.jobId ? <Check className="w-3.5 h-3.5" /> : <Share2 className="w-3.5 h-3.5" />}{copiedId === job.jobId ? "Скопировано!" : "Поделиться"}</button></>}
                  {failed && onRetry && <button onClick={() => onRetry(job)} className="btn-ghost-rose px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5" />Повторить</button>}
                  {failed && job.url && (
                    <a
                      href={job.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-ghost-rose px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Открыть источник и скачать в браузере
                    </a>
                  )}
                </div>
              </div>
              {processing && <div className="mt-3"><YarnProgress percent={job.progressPercent} caption={<><PawPrint className="w-3 h-3" />{job.progressPercent >= 85 ? "Котёнок сматывает клубок в документ…" : "Ниточка тянется от библиотеки к нам…"}</>} /></div>}
            </article>
          );
        })}
      </div>
    </section>
  );
}
