"use client";

import React from "react";
import { Hash, Type, AlignLeft, ImageIcon, Search, Sparkles, RotateCcw } from "lucide-react";
import { GK_CATEGORIES, GK_PAGE_SIZE_OPTIONS, PORTRAIT_PRESET_KEYWORDS } from "@/lib/goskatalog/constants";
import type { GkMuseum, TextMatchMode } from "@/lib/goskatalog/types";
import { MuseumPicker } from "./MuseumPicker";

export interface FilterState {
  code: string;
  title: string;
  titleMode: TextMatchMode;
  description: string;
  descriptionMode: TextMatchMode;
  museums: GkMuseum[];
  categoryIds: string[];
  onlyWithPhoto: boolean;
  pageSize: number;
}

interface FilterPanelProps {
  state: FilterState;
  onChange: (next: FilterState) => void;
  onSubmit: () => void;
  onReset: () => void;
  isLoading: boolean;
}

const MODE_OPTIONS: { value: TextMatchMode; label: string }[] = [
  { value: "any", label: "включает любое" },
  { value: "all", label: "включает все" },
  { value: "none", label: "исключает" },
];

function ModeToggle({
  value,
  onChange,
}: {
  value: TextMatchMode;
  onChange: (v: TextMatchMode) => void;
}) {
  return (
    <div className="flex gap-1">
      {MODE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-2 py-1 rounded-lg text-[10px] font-bold tile-rose ${value === opt.value ? "is-active" : ""}`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export function FilterPanel({ state, onChange, onSubmit, onReset, isLoading }: FilterPanelProps) {
  const set = <K extends keyof FilterState>(key: K, value: FilterState[K]) => onChange({ ...state, [key]: value });

  const toggleCategory = (id: string) => {
    const has = state.categoryIds.includes(id);
    set("categoryIds", has ? state.categoryIds.filter((c) => c !== id) : [...state.categoryIds, id]);
  };

  const applyPortraitPreset = () => {
    onChange({
      ...state,
      title: PORTRAIT_PRESET_KEYWORDS.join(" "),
      titleMode: "any",
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="card-boudoir p-4 sm:p-5 space-y-5"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-sm font-bold text-[var(--plum)] flex items-center gap-1.5">
          <Search className="w-4 h-4 text-[var(--rose-600)]" /> Фильтры поиска
        </h3>
        <button
          type="button"
          onClick={applyPortraitPreset}
          className="text-[11px] font-bold text-[var(--rose-700)] flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-[var(--rose-100)]"
        >
          <Sparkles className="w-3 h-3" /> Пресет «Портреты»
        </button>
      </div>

      {/* Code */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--plum-soft)] flex items-center gap-1.5">
          <Hash className="w-3 h-3" /> Шифр / номер по ГИК / инв. номер
        </label>
        <input
          type="text"
          value={state.code}
          onChange={(e) => set("code", e.target.value)}
          placeholder="например: ГИМ ОФ-12345"
          className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
        />
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--plum-soft)] flex items-center gap-1.5">
          <Type className="w-3 h-3" /> Поиск по заголовку
        </label>
        <input
          type="text"
          value={state.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="слова через пробел: портрет, автопортрет…"
          className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
        />
        <ModeToggle value={state.titleMode} onChange={(v) => set("titleMode", v)} />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--plum-soft)] flex items-center gap-1.5">
          <AlignLeft className="w-3 h-3" /> Поиск по описанию
        </label>
        <input
          type="text"
          value={state.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="например: мундир, эполеты, дворянин"
          className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
        />
        <ModeToggle value={state.descriptionMode} onChange={(v) => set("descriptionMode", v)} />
      </div>

      {/* Museums */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--plum-soft)] block">
          Музей
        </label>
        <MuseumPicker selected={state.museums} onChange={(museums) => set("museums", museums)} />
      </div>

      {/* Categories */}
      <div className="space-y-1.5">
        <label className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--plum-soft)] block">
          Категория предмета
        </label>
        <div className="flex flex-wrap gap-1.5">
          {GK_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggleCategory(cat.id)}
              className={`px-2.5 py-1.5 rounded-xl text-[11px] font-semibold tile-rose ${
                state.categoryIds.includes(cat.id) ? "is-active" : ""
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Photo + page size */}
      <div className="grid grid-cols-2 gap-3">
        <label className="flex items-center gap-2 text-xs font-bold text-[var(--plum-soft)] cursor-pointer">
          <input
            type="checkbox"
            checked={state.onlyWithPhoto}
            onChange={(e) => set("onlyWithPhoto", e.target.checked)}
            className="w-4 h-4 accent-[#c05e7d]"
          />
          <ImageIcon className="w-3.5 h-3.5" /> только с фото
        </label>

        <div className="space-y-1">
          <label className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)] block">
            На странице
          </label>
          <select
            value={state.pageSize}
            onChange={(e) => set("pageSize", Number(e.target.value))}
            className="input-boudoir w-full px-2 py-1.5 rounded-lg text-xs"
          >
            {GK_PAGE_SIZE_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} экспонатов
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isLoading}
          className="btn-rose flex-1 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-1.5 disabled:opacity-60"
        >
          <Search className="w-3.5 h-3.5" /> Искать
        </button>
        <button
          type="button"
          onClick={onReset}
          className="btn-ghost-rose px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Сброс
        </button>
      </div>
    </form>
  );
}
