"use client";

import React, { useState } from "react";
import { Search, Clipboard, X, AlertCircle, Loader2, PawPrint, ArrowRight } from "lucide-react";
import { detectLibraryType, getLibraryDisplayName } from "@/lib/parsers";
import { PRESET_BOOKS, PresetBook } from "@/lib/preset-books";
import { KittenChase, KittenRun } from "./mascot";

interface UrlInputSectionProps {
  url: string;
  setUrl: (url: string) => void;
  onInspect: (targetUrl?: string) => void;
  isLoading: boolean;
  error?: string | null;
}

export function UrlInputSection({
  url,
  setUrl,
  onInspect,
  isLoading,
  error,
}: UrlInputSectionProps) {
  const [pasteSuccess, setPasteSuccess] = useState(false);

  const detectedLib = url.trim() ? detectLibraryType(url) : null;
  const detectedLibName = detectedLib ? getLibraryDisplayName(detectedLib) : null;

  const handlePaste = async () => {
    try {
      if (navigator?.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          setUrl(text.trim());
          setPasteSuccess(true);
          setTimeout(() => setPasteSuccess(false), 2000);
          onInspect(text.trim());
        }
      }
    } catch {
      // clipboard blocked — user can paste manually
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onInspect();
  };

  const handleSelectPreset = (preset: PresetBook) => {
    setUrl(preset.url);
    onInspect(preset.url);
  };

  return (
    <section className="w-full">
      <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] gap-6 items-center">
        {/* Left: headline + form */}
        <div className="space-y-4 order-2 lg:order-1">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="chip">
                <PawPrint className="w-3 h-3" /> будуар читателя открыт
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-5xl font-extrabold text-[var(--plum)] leading-[1.08] tracking-tight">
              Котёнок распутает
              <br />
              <span className="italic text-[var(--rose-600)]">клубок страниц</span>
              <br />в готовый PDF
            </h1>
            <p className="text-sm sm:text-base text-[var(--plum-soft)]/85 max-w-xl leading-relaxed">
              Вставьте ссылку на книгу из{" "}
              <span className="font-bold text-[var(--rose-700)]">prlib.ru</span>,{" "}
              <span className="font-bold text-[var(--rose-700)]">elib.shpl.ru</span>,{" "}
              <span className="font-bold text-[var(--rose-700)]">archive.org</span>,{" "}
              <span className="font-bold text-[var(--rose-700)]">dokumen.pub</span>,{" "}
              <span className="font-bold text-[var(--rose-700)]">RosDok</span>,{" "}
              <span className="font-bold text-[var(--rose-700)]">SMB Berlin</span>,{" "}
              <span className="font-bold text-[var(--rose-700)]">MDZ</span> или любой{" "}
              <span className="font-bold text-[var(--rose-700)]">IIIF-библиотеки</span> — и файл
              прибежит прямо на телефон. Без терминала и Python.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="card-boudoir p-3 sm:p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="w-4.5 h-4.5 w-5 h-5 text-[var(--rose-500)]" />
                </div>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.prlib.ru/item/420931 …"
                  className="input-boudoir w-full pl-11 pr-24 sm:pr-20 py-3.5 rounded-2xl text-sm sm:text-base"
                  disabled={isLoading}
                />
                <div className="absolute inset-y-0 right-0 pr-2 flex items-center space-x-1">
                  {url && (
                    <button
                      type="button"
                      onClick={() => setUrl("")}
                      className="p-1.5 rounded-lg text-[var(--ink-soft)] hover:text-[var(--plum)] hover:bg-[var(--rose-100)] transition-colors"
                      title="Очистить"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handlePaste}
                    className="px-2.5 py-1.5 rounded-xl btn-ghost-rose text-xs font-bold flex items-center gap-1 transition-colors"
                    title="Вставить из буфера"
                  >
                    <Clipboard className="w-3.5 h-3.5" />
                    <span className="hidden xs:inline">
                      {pasteSuccess ? "Вставлено!" : "Вставить"}
                    </span>
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={!url.trim() || isLoading}
                className="btn-rose w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-2 shrink-0 transition-all"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Рыщем…</span>
                  </>
                ) : (
                  <>
                    <span>Позвать котёнка</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Detection */}
            {detectedLibName && !error && (
              <div className="flex items-center gap-2 text-xs text-[var(--plum-soft)] pt-0.5">
                <span className="w-2 h-2 rounded-full bg-[var(--sage)] animate-pulse" />
                <span>Кот почуял источник:</span>
                <span className="chip">{detectedLibName}</span>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="p-3 rounded-2xl bg-[#fdf0ed] border border-[#f3c3bb] text-[#9a4a3e] text-xs sm:text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Котёнок споткнулся:</strong> {error}
                </div>
              </div>
            )}

            {/* Loading row: running kitten */}
            {isLoading && (
              <div className="flex items-center gap-2.5 text-xs font-bold text-[var(--rose-700)] pt-1">
                <KittenRun />
                <span>Котёнок обнюхивает книгу: считает страницы и обложку…</span>
              </div>
            )}
          </form>

          {/* Quick presets */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[var(--ink-soft)]">
              <PawPrint className="w-3 h-3" />
              <span>Любимые полочки для пробы:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESET_BOOKS.slice(0, 4).map((book) => (
                <button
                  key={book.id}
                  onClick={() => handleSelectPreset(book)}
                  disabled={isLoading}
                  className="text-xs px-3 py-1.5 rounded-full tile-rose transition-all flex items-center gap-1.5 text-left disabled:opacity-50"
                >
                  <span className={`w-2 h-2 rounded-full ${book.badgeColor}`} />
                  <span className="truncate max-w-[200px] sm:max-w-xs">{book.title}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: hero kitten */}
        <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
          <div className="relative">
            <div className="absolute -inset-4 rounded-full bg-[radial-gradient(circle,rgba(232,131,160,0.22),transparent_70%)] blur-xl" />
            <KittenChase className="kitten-chase relative drop-shadow-[0_18px_30px_rgba(190,126,140,0.18)]" />
            <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--ink-soft)]">
              клубок · клубок · клубок
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
