"use client";

import React from "react";
import { PRESET_BOOKS, type PresetBook } from "@/lib/preset-books";
import { Layers, ArrowRight, PawPrint } from "lucide-react";

interface PresetGallerySectionProps {
  onSelectBook: (preset: PresetBook) => void;
  isLoading: boolean;
}

export function PresetGallerySection({ onSelectBook, isLoading }: PresetGallerySectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="font-display text-xl sm:text-2xl font-bold text-[var(--plum)] flex items-center gap-2">
          <PawPrint className="w-5 h-5 text-[var(--rose-500)]" />
          <span>Витрина будуара — книги для пробы</span>
        </h3>
        <p className="text-xs text-[var(--ink-soft)] mt-1">
          Нажмите на любую книгу — котёнок моментально проверит её и предложит скачать
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {PRESET_BOOKS.map((book) => (
          <div
            key={book.id}
            onClick={() => !isLoading && onSelectBook(book)}
            className="group card-boudoir p-4 sm:p-5 cursor-pointer transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(192,94,125,0.22)] flex flex-col justify-between space-y-3"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="chip !text-[10px]">
                  <span className={`w-2 h-2 rounded-full ${book.badgeColor}`} />
                  {book.tag}
                </span>
                <span className="chip !bg-white">
                  <Layers className="w-3 h-3 text-[var(--rose-500)]" />~{book.pagesApprox} стр.
                </span>
              </div>

              <h4 className="font-display text-sm font-bold text-[var(--plum)] group-hover:text-[var(--rose-700)] transition-colors leading-snug line-clamp-2">
                {book.title}
              </h4>

              <p className="text-xs text-[var(--plum-soft)]/75 line-clamp-2 leading-relaxed">
                {book.description}
              </p>
            </div>

            <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between text-xs">
              <span className="text-[11px] text-[var(--ink-soft)] truncate max-w-[170px]">
                {book.category}
              </span>
              <span className="font-extrabold text-[var(--rose-700)] group-hover:translate-x-1 transition-transform flex items-center gap-1">
                <span>Позвать</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
