"use client";

import React, { useState, useEffect, useCallback } from "react";
import type { BookMetadata } from "@/lib/types";
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Sun, Moon, BookOpen, Loader2, CloudFog } from "lucide-react";
import { KittenRun } from "./mascot";

export function BookReaderModal({ isOpen, onClose, metadata, initialPage = 1 }: { isOpen: boolean; onClose: () => void; metadata: BookMetadata; initialPage?: number }) {
  const [currentPageIndex, setCurrentPageIndex] = useState(initialPage);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [themeMode, setThemeMode] = useState<"dark" | "sepia" | "light">("sepia");
  const [isImageLoading, setIsImageLoading] = useState(true);
  const total = metadata.totalPages;
  const goPage = useCallback((index: number) => {
    const clamped = Math.max(1, Math.min(total, index));
    setCurrentPageIndex((current) => {
      if (current !== clamped) setIsImageLoading(true);
      return clamped;
    });
  }, [total]);

  useEffect(() => { setCurrentPageIndex(initialPage); }, [initialPage]);
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") goPage(currentPageIndex - 1);
      if (event.key === "ArrowRight") goPage(currentPageIndex + 1);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, currentPageIndex, onClose, goPage]);

  if (!isOpen) return null;
  const currentPage = metadata.pages[currentPageIndex - 1];
  const imageUrl = currentPage ? `/api/proxy-image?url=${encodeURIComponent(currentPage.hdUrl || currentPage.originalUrl)}&referer=${encodeURIComponent(metadata.url)}` : "";
  const theme = themeMode === "sepia" ? "bg-[#f6ecd9] text-[#433422]" : themeMode === "light" ? "bg-[#fdf7f1] text-[var(--plum)]" : "bg-[#2a1a22] text-rose-50";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[rgba(58,32,44,.85)] backdrop-blur-md" onClick={onClose}>
      <div className="h-14 bg-[rgba(253,247,241,.94)] border-b border-[var(--border)] px-3 sm:px-6 flex items-center justify-between shrink-0" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 min-w-0"><BookOpen className="w-5 h-5 text-[var(--rose-600)] shrink-0" /><div className="min-w-0"><h3 className="font-display text-xs sm:text-sm font-bold truncate max-w-[200px] sm:max-w-md">{metadata.title}</h3><p className="text-[10px] text-[var(--ink-soft)] hidden sm:block">{metadata.libraryName}</p></div></div>
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="flex items-center bg-white rounded-xl p-0.5 border border-[var(--border)]">
            <button onClick={() => setThemeMode("dark")} className={`p-1.5 rounded-lg ${themeMode === "dark" ? "bg-[#3a202c] text-rose-100" : "text-[var(--ink-soft)]"}`} title="Вечерняя"><Moon className="w-3.5 h-3.5" /></button>
            <button onClick={() => setThemeMode("sepia")} className={`p-1.5 rounded-lg ${themeMode === "sepia" ? "bg-amber-100 text-amber-900" : "text-[var(--ink-soft)]"}`} title="Сепия"><span className="w-3.5 h-3.5 flex items-center justify-center font-bold text-[10px]">S</span></button>
            <button onClick={() => setThemeMode("light")} className={`p-1.5 rounded-lg ${themeMode === "light" ? "shadow text-[var(--plum)]" : "text-[var(--ink-soft)]"}`} title="Дневная"><Sun className="w-3.5 h-3.5" /></button>
          </div>
          <div className="hidden sm:flex items-center bg-white rounded-xl p-0.5 border border-[var(--border)]"><button onClick={() => setZoomLevel((value) => Math.max(.75, value - .25))} className="p-1.5"><ZoomOut className="w-3.5 h-3.5" /></button><button onClick={() => setZoomLevel(1)} className="w-10 text-[10px] font-bold">{Math.round(zoomLevel * 100)}%</button><button onClick={() => setZoomLevel((value) => Math.min(3, value + .25))} className="p-1.5"><ZoomIn className="w-3.5 h-3.5" /></button></div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--rose-100)]"><X className="w-5 h-5" /></button>
        </div>
      </div>
      <div className={`flex-1 overflow-auto flex items-center justify-center p-3 sm:p-6 ${theme}`} onClick={(event) => event.stopPropagation()}>
        {currentPage ? <div className="relative max-w-full max-h-full flex items-center justify-center">{isImageLoading && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-[var(--rose-700)]"><KittenRun className="!w-16" /><span className="text-xs font-bold flex gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" />Котёнок тащит страницу…</span></div>}
          {/* eslint-disable-next-line @next/next/no-img-element */}<img src={imageUrl} alt={`Страница ${currentPageIndex}`} onLoad={() => setIsImageLoading(false)} onError={() => setIsImageLoading(false)} className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" style={{ width: zoomLevel === 1 ? "auto" : `${zoomLevel * 100}%`, height: zoomLevel === 1 ? "100%" : "auto" }} />
        </div> : <div className="text-center opacity-80"><CloudFog className="w-10 h-10 mx-auto" /><p className="text-sm font-bold mt-2">Страница не найдена</p></div>}
      </div>
      <div className="h-16 bg-[rgba(253,247,241,.94)] border-t border-[var(--border)] px-3 sm:px-6 flex items-center gap-3 shrink-0" onClick={(event) => event.stopPropagation()}>
        <button onClick={() => goPage(currentPageIndex - 1)} disabled={currentPageIndex <= 1} className="btn-ghost-rose p-2.5 rounded-2xl disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
        <div className="flex-1 flex flex-col items-center"><input type="range" min={1} max={total} value={currentPageIndex} onChange={(event) => goPage(Number(event.target.value))} className="w-full accent-[#c05e7d]" /><span className="text-[10px] font-bold text-[var(--ink-soft)]">страница {currentPageIndex} из {total}</span></div>
        <button onClick={() => goPage(currentPageIndex + 1)} disabled={currentPageIndex >= total} className="btn-rose p-2.5 rounded-2xl disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
}
