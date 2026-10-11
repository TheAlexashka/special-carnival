"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Header } from "@/components/Header";
import { UrlInputSection } from "@/components/UrlInputSection";
import { BookInspectorCard } from "@/components/BookInspectorCard";
import { ActiveDownloadsSection } from "@/components/ActiveDownloadsSection";
import { BookReaderModal } from "@/components/BookReaderModal";
import { AndroidGuideModal } from "@/components/AndroidGuideModal";
import { DownloadHistorySection } from "@/components/DownloadHistorySection";
import { PresetGallerySection } from "@/components/PresetGallerySection";
import { SupportedLibrariesSection } from "@/components/SupportedLibrariesSection";
import { BookMetadata, DownloadProgress } from "@/lib/types";
import { PresetBook } from "@/lib/preset-books";
import { PawPrint } from "lucide-react";

export default function Home() {
  const [url, setUrl] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [inspectError, setInspectError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<BookMetadata | null>(null);
  const [isStartingDownload, setIsStartingDownload] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState<DownloadProgress[]>([]);
  const [history, setHistory] = useState<DownloadProgress[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isReaderOpen, setIsReaderOpen] = useState(false);

  const activeDownloadsRef = useRef(activeDownloads);
  activeDownloadsRef.current = activeDownloads;
  const historyRef = useRef(history);
  historyRef.current = history;

  const loadHistory = useCallback(async (restoreActive = false) => {
    try {
      setIsHistoryLoading(true);
      const res = await fetch("/api/download/history");
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.history)) {
          setHistory(data.history);
          if (restoreActive) {
            const unfinished = (data.history as DownloadProgress[]).filter(
              (job) => job.status === "pending" || job.status === "processing"
            );
            if (unfinished.length > 0) {
              setActiveDownloads((previous) => {
                const existingIds = new Set(previous.map((item) => item.jobId));
                return [...unfinished.filter((item) => !existingIds.has(item.jobId)), ...previous];
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn("Failed to fetch history:", error);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory(true);
  }, [loadHistory]);

  // Переход из раздела поиска dokumen.pub: /?dokumen=<ссылка на книгу>.
  // Читаем через window.location, чтобы не требовать Suspense-обёртку.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const incoming = params.get("dokumen") || params.get("smb") || params.get("rosdok");
    if (!incoming) return;
    setUrl(incoming);
    void handleInspect(incoming);
    // очищаем адрес, чтобы повторный рендер не запускал инспекцию снова
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInspect = async (targetUrl?: string) => {
    const rawUrl = (targetUrl || url).trim();
    if (!rawUrl) return;
    setIsInspecting(true);
    setInspectError(null);
    try {
      const res = await fetch("/api/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: rawUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Не удалось получить метаданные книги");
      setMetadata(data.data);
    } catch (error: unknown) {
      setInspectError(error instanceof Error ? error.message : String(error));
      setMetadata(null);
    } finally {
      setIsInspecting(false);
    }
  };

  const handleStartDownload = async (options: {
    pageRange: string;
    quality: "original" | "hd" | "mobile";
    format: "pdf" | "zip";
  }) => {
    if (!metadata) return;
    setIsStartingDownload(true);
    try {
      const res = await fetch("/api/download/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: metadata.url,
          pageRange: options.pageRange,
          quality: options.quality,
          format: options.format,
          customTitle: metadata.title,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Ошибка запуска скачивания");
      const newJob: DownloadProgress = {
        jobId: data.jobId,
        url: metadata.url,
        status: "pending",
        progressPercent: 5,
        currentPage: 0,
        totalPages: data.selectedPagesCount || metadata.totalPages,
        title: metadata.title,
        libraryName: metadata.libraryName,
        coverUrl: metadata.coverUrl,
        format: options.format,
        quality: options.quality,
        createdAt: new Date().toISOString(),
      };
      setActiveDownloads((previous) => [newJob, ...previous]);
      loadHistory(false);
      setTimeout(() => document.getElementById("active-downloads")?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch (error: unknown) {
      alert(`Ошибка: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsStartingDownload(false);
    }
  };

  useEffect(() => {
    const hasUnfinishedJobs =
      activeDownloads.some((job) => job.status === "pending" || job.status === "processing") ||
      history.some((job) => job.status === "pending" || job.status === "processing");
    if (!hasUnfinishedJobs) return;

    const interval = setInterval(async () => {
      const currentList = activeDownloadsRef.current;
      const currentHistory = historyRef.current;
      const unfinishedIds = new Set<string>();
      for (const job of [...currentList, ...currentHistory]) {
        if (job.status === "pending" || job.status === "processing") unfinishedIds.add(job.jobId);
      }
      if (!unfinishedIds.size) return;
      const statusCache = new Map<string, DownloadProgress>();
      await Promise.all(Array.from(unfinishedIds).map(async (jobId) => {
        try {
          const res = await fetch(`/api/download/status/${jobId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.job) statusCache.set(jobId, data.job);
          }
        } catch (error) {
          console.warn(`Failed to poll status for ${jobId}:`, error);
        }
      }));
      if (!statusCache.size) return;
      setActiveDownloads(currentList.map((job) => ({ ...job, ...(statusCache.get(job.jobId) || {}) })));
      setHistory(currentHistory.map((job) => ({ ...job, ...(statusCache.get(job.jobId) || {}) })));
      if (Array.from(statusCache.values()).some((job) => job.status === "completed" || job.status === "failed")) {
        loadHistory(false);
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [activeDownloads, history, loadHistory]);

  const handleSelectPreset = (preset: PresetBook) => {
    setUrl(preset.url);
    handleInspect(preset.url);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleReDownload = (item: DownloadProgress) => {
    const sourceUrl = (item as unknown as { url?: string }).url;
    if (sourceUrl) {
      setUrl(sourceUrl);
      handleInspect(sourceUrl);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      alert("Исходная ссылка не найдена для этой записи");
    }
  };

  const handleClearHistory = async () => {
    if (confirm("Точно выгнать все книги с полочки и очистить историю? Файлы тоже удалятся.")) {
      try {
        await fetch("/api/download/history", { method: "DELETE" });
        setHistory([]);
        setActiveDownloads((previous) => previous.filter((job) => job.status === "pending" || job.status === "processing"));
      } catch (error) {
        console.error("Failed to clear history:", error);
      }
    }
  };

  const handleDeleteHistoryItem = async (id: string) => {
    try {
      await fetch(`/api/download/history?id=${id}`, { method: "DELETE" });
      setHistory((previous) => previous.filter((item) => item.jobId !== id));
      setActiveDownloads((previous) => previous.filter((item) => item.jobId !== id));
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  const activeCount = activeDownloads.filter((job) => job.status === "processing" || job.status === "pending").length;

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        onOpenGuide={() => setIsGuideOpen(true)}
        activeDownloadsCount={activeCount}
        historyCount={history.length}
        onScrollToActive={() => document.getElementById("active-downloads")?.scrollIntoView({ behavior: "smooth" })}
        onScrollToHistory={() => document.getElementById("download-history")?.scrollIntoView({ behavior: "smooth" })}
      />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-10 sm:space-y-14">
        <UrlInputSection url={url} setUrl={setUrl} onInspect={handleInspect} isLoading={isInspecting} error={inspectError} />
        {metadata && (
          <BookInspectorCard metadata={metadata} onStartDownload={handleStartDownload} onOpenReader={() => setIsReaderOpen(true)} isStarting={isStartingDownload} />
        )}
        <ActiveDownloadsSection downloads={activeDownloads} onOpenReader={() => setIsReaderOpen(true)} />
        <DownloadHistorySection history={history} onClearHistory={handleClearHistory} onDeleteHistoryItem={handleDeleteHistoryItem} onReDownload={handleReDownload} isLoading={isHistoryLoading} />
        <PresetGallerySection onSelectBook={handleSelectPreset} isLoading={isInspecting} />
        <SupportedLibrariesSection />
      </main>
      <footer className="border-t border-[var(--border)] bg-[rgba(253,247,241,0.9)] py-8 text-center text-xs text-[var(--ink-soft)]">
        <div className="max-w-4xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2"><PawPrint className="w-4 h-4 text-[var(--rose-500)]" /><span className="font-display font-bold italic text-[var(--plum)]">Клубок</span><span>—</span><span>будуарный помощник читательницы</span></div>
          <div className="flex items-center gap-3"><span>на исходнике elib-dl</span><span>·</span><span>муррмяу с любовью к книгам</span></div>
        </div>
      </footer>
      {metadata && <BookReaderModal isOpen={isReaderOpen} onClose={() => setIsReaderOpen(false)} metadata={metadata} />}
      <AndroidGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </div>
  );
}
