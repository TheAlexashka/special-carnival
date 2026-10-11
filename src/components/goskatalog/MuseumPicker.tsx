"use client";

import React, { useEffect, useRef, useState } from "react";
import { Building2, Search, X, Loader2 } from "lucide-react";
import type { GkMuseum } from "@/lib/goskatalog/types";

interface MuseumPickerProps {
  selected: GkMuseum[];
  onChange: (museums: GkMuseum[]) => void;
}

export function MuseumPicker({ selected, onChange }: MuseumPickerProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<GkMuseum[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [source, setSource] = useState<"live" | "fallback" | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/goskatalog/museums?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success) {
          setOptions(data.museums);
          setSource(data.source);
        }
      } catch {
        setOptions([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const toggleMuseum = (museum: GkMuseum) => {
    const exists = selected.some((m) => m.id === museum.id);
    if (exists) {
      onChange(selected.filter((m) => m.id !== museum.id));
    } else {
      onChange([...selected, museum]);
    }
  };

  const removeMuseum = (id: number) => onChange(selected.filter((m) => m.id !== id));

  return (
    <div className="space-y-2" ref={boxRef}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Building2 className="w-4 h-4 text-[var(--rose-500)]" />
        </div>
        <input
          type="text"
          value={query}
          onFocus={() => setIsOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          placeholder="Найти музей по названию…"
          className="input-boudoir w-full pl-9 pr-9 py-2.5 rounded-xl text-xs"
        />
        {isLoading && (
          <Loader2 className="w-3.5 h-3.5 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ink-soft)]" />
        )}

        {isOpen && (
          <div className="absolute z-20 mt-1.5 w-full max-h-56 overflow-y-auto card-boudoir p-1.5 space-y-0.5">
            {options.length === 0 && !isLoading && (
              <div className="px-2.5 py-2 text-xs text-[var(--ink-soft)]">Музеи не найдены</div>
            )}
            {options.map((museum) => {
              const isSelected = selected.some((m) => m.id === museum.id);
              return (
                <button
                  key={museum.id}
                  type="button"
                  onClick={() => toggleMuseum(museum)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center gap-1.5 transition-colors ${
                    isSelected ? "bg-[var(--rose-100)] text-[var(--rose-700)] font-bold" : "hover:bg-[var(--rose-100)]"
                  }`}
                >
                  <Search className="w-3 h-3 shrink-0 opacity-60" />
                  <span className="truncate">{museum.name}</span>
                </button>
              );
            })}
            {source === "fallback" && (
              <div className="px-2.5 pt-1.5 text-[10px] text-[var(--ink-soft)] border-t border-[var(--border)] mt-1">
                Живой список музеев недоступен — показаны популярные музеи из подборки
              </div>
            )}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((museum) => (
            <span
              key={museum.id}
              className="chip !bg-white text-[10px] max-w-full"
              title={museum.name}
            >
              <span className="truncate max-w-[180px]">{museum.name}</span>
              <button type="button" onClick={() => removeMuseum(museum.id)} className="shrink-0">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
