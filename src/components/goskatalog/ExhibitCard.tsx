"use client";

import React from "react";
import { ImageOff, Building2, Hash } from "lucide-react";
import type { GkExhibitSummary } from "@/lib/goskatalog/types";

export function ExhibitCard({ exhibit, onOpen }: { exhibit: GkExhibitSummary; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group card-boudoir p-3 text-left flex flex-col gap-2 hover:-translate-y-1 transition-transform"
    >
      <div className="relative w-full aspect-[3/4] rounded-xl overflow-hidden bg-[var(--rose-100)] border border-[var(--border)] flex items-center justify-center">
        {exhibit.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/goskatalog/image?id=${exhibit.images[0]?.id}`}
            alt={exhibit.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-[var(--ink-soft)]">
            <ImageOff className="w-7 h-7" />
            <span className="text-[10px] font-bold">без фото</span>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <h4 className="text-xs font-bold text-[var(--plum)] line-clamp-2 leading-snug group-hover:text-[var(--rose-700)]">
          {exhibit.title}
        </h4>
        {exhibit.museum?.name && (
          <p className="text-[10px] text-[var(--ink-soft)] flex items-center gap-1 truncate">
            <Building2 className="w-3 h-3 shrink-0" />
            <span className="truncate">{exhibit.museum.name}</span>
          </p>
        )}
        {(exhibit.gikNumber || exhibit.invNumber) && (
          <p className="text-[10px] text-[var(--ink-soft)] flex items-center gap-1 truncate">
            <Hash className="w-3 h-3 shrink-0" />
            <span className="truncate">{exhibit.gikNumber || exhibit.invNumber}</span>
          </p>
        )}
      </div>
    </button>
  );
}
