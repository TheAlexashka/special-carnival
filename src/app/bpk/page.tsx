"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  Loader2,
  AlertTriangle,
  ExternalLink,
  Download,
  ShieldCheck,
  Info,
} from "lucide-react";
import { bpkProxyUrl, type BpkCollection, type BpkPhoto } from "@/lib/bpk";

export default function BpkPage() {
  const [collections, setCollections] = useState<BpkCollection[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<BpkCollection | null>(null);
  const [photos, setPhotos] = useState<BpkPhoto[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState<BpkPhoto | null>(null);

  useEffect(() => {
    void (async () => {
      setIsLoadingList(true);
      try {
        const res = await fetch("/api/bpk/collections");
        const data = await res.json();
        if (!data.success) throw new Error(data.error);
        setCollections(data.collections);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsLoadingList(false);
      }
    })();
  }, []);

  const openCollection = useCallback(async (collection: BpkCollection) => {
    setActive(collection);
    setPhotos([]);
    setIsLoadingPhotos(true);
    setError(null);
    try {
      const res = await fetch(`/api/bpk/photos?slug=${encodeURIComponent(collection.slug)}`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setPhotos(data.photos);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoadingPhotos(false);
    }
  }, []);

  const filtered = query.trim()
    ? collections.filter((c) => c.title.toLowerCase().includes(query.trim().toLowerCase()))
    : collections;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-[var(--border)] bg-[rgba(253,247,241,.9)] backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 text-xs font-bold text-[var(--rose-700)]">
            <ArrowLeft className="w-4 h-4" /> Клубок
          </Link>
          <h1 className="font-display text-base sm:text-xl font-bold text-[var(--plum)] flex items-center gap-2 truncate">
            <Camera className="w-5 h-5 text-[var(--rose-600)]" /> bpk-Fotoarchiv
          </h1>
          <a
            href="https://bpk-fotoarchiv.de/"
            target="_blank"
            rel="noreferrer"
            className="chip shrink-0"
          >
            официальный сайт
          </a>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="grid lg:grid-cols-[280px_1fr] gap-6 items-start">
          {/* Список портфелей */}
          <aside className="card-boudoir p-4 space-y-3 lg:sticky lg:top-24">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-[var(--sage)] shrink-0 mt-0.5" />
              <p className="text-[11px] text-[var(--plum-soft)] leading-relaxed">
                Показываем и скачиваем <strong>preview с водяным знаком</strong> — они публично
                доступны на сайте. High-res по условиям bpk выдаётся после регистрации/разрешения.
              </p>
              <p className="leading-relaxed pt-2 mt-2 border-t border-[var(--border)]">
                <strong>Про shop:</strong> bpk-Bildagentur прекратила работу 30.06.2026 — адрес
                bpk-bildagentur.de/shop ведёт на объявление о закрытии, а витрина picturemaxx для
                чужих адресов закрыта (403), поэтому вытащить оттуда ничего нельзя. Архив живёт на
                bpk-fotoarchiv.de (откуда и превью), а часть снимков SPK доступна через Europeana и
                DDB — там high-res забирается напрямую.
              </p>
            </div>

            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по фотовладельцам…"
                className="input-boudoir w-full px-3 py-2 rounded-xl text-xs"
              />
            </div>

            {isLoadingList ? (
              <div className="flex items-center gap-2 text-xs text-[var(--ink-soft)] py-4">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Загружаем портфели…
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto space-y-1">
                {filtered.map((collection) => (
                  <button
                    key={collection.slug}
                    onClick={() => void openCollection(collection)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      active?.slug === collection.slug
                        ? "bg-[var(--rose-100)] text-[var(--rose-700)] font-bold"
                        : "hover:bg-[var(--rose-100)]"
                    }`}
                  >
                    {collection.title}
                  </button>
                ))}
                {!filtered.length && <p className="text-xs text-[var(--ink-soft)] px-1">Ничего не найдено</p>}
              </div>
            )}

            <p className="text-[10px] text-[var(--ink-soft)] border-t border-[var(--border)] pt-2">
              Портфелей: {collections.length}
            </p>
          </aside>

          {/* Фото */}
          <section className="space-y-4 min-w-0">
            {error && (
              <div className="rounded-2xl border border-[#e7c9a9] bg-[#fdf3e4] p-4 text-xs text-[#7a5a2e] flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-2">
                  <p>{error}</p>
                  <a
                    href="https://bpk-fotoarchiv.de/"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#b4812f] text-white font-bold text-[11px]"
                  >
                    Открыть bpk напрямую <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}

            {!active && !isLoadingPhotos && (
              <div className="flex flex-col items-center justify-center py-20 gap-3 border-2 border-dashed border-[var(--rose-200)] rounded-3xl text-center px-4">
                <Camera className="w-10 h-10 text-[var(--rose-300)]" />
                <p className="font-display text-base font-bold text-[var(--plum)]">
                  Выберите фотовладельца слева
                </p>
                <p className="text-xs text-[var(--ink-soft)] max-w-md">
                  Здесь появятся превью его работ с водяным знаком — их можно листать и скачать.
                </p>
              </div>
            )}

            {isLoadingPhotos && (
              <div className="flex items-center justify-center py-20 gap-2 text-sm font-bold text-[var(--rose-700)]">
                <Loader2 className="w-5 h-5 animate-spin" /> Несём плёнку…
              </div>
            )}

            {active && !isLoadingPhotos && photos.length > 0 && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-lg font-bold text-[var(--plum)]">{active.title}</h2>
                    <p className="text-xs text-[var(--ink-soft)]">preview: {photos.length}</p>
                  </div>
                  <a
                    href={active.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-bold text-[var(--rose-700)] flex items-center gap-1"
                  >
                    Открыть на bpk <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="card-boudoir p-2 space-y-2">
                      <button
                        onClick={() => setOpened(photo)}
                        className="w-full aspect-square bg-[var(--rose-100)] rounded-xl overflow-hidden border border-[var(--border)]"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={bpkProxyUrl(photo, "thumb")}
                          alt={photo.caption || active.title}
                          loading="lazy"
                          className="w-full h-full object-cover"
                        />
                      </button>
                      {photo.caption && (
                        <p className="text-[10px] text-[var(--ink-soft)] line-clamp-2">{photo.caption}</p>
                      )}
                      <a
                        href={bpkProxyUrl(photo, "preview") + "&download=1"}
                        className="btn-ghost-rose w-full px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1"
                      >
                        <Download className="w-3 h-3" /> preview
                      </a>
                    </div>
                  ))}
                </div>

                <div className="rounded-2xl bg-[#f7f1e2] border border-[#e7d9b7] p-4 text-xs text-[#7a6236] flex items-start gap-2.5">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Скачанные файлы содержат водяной знак bpk. Использование — только для частных и
                    научных целей с полным Bildnachweis: <strong>{photos[0]?.credit}</strong>. Для
                    публикаций нужны отдельные права.
                  </p>
                </div>
              </>
            )}
          </section>
        </div>
      </main>

      {/* Просмотр фото */}
      {opened && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(58,32,44,.88)] backdrop-blur-md"
          onClick={() => setOpened(null)}
        >
          <div className="max-w-5xl max-h-[92vh] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={bpkProxyUrl(opened, "preview")}
              alt={opened.caption || active?.title}
              className="max-h-[78vh] max-w-full object-contain rounded-2xl shadow-2xl bg-black/40"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-rose-50">
              <span className="truncate max-w-[60%]">{opened.caption || active?.title}</span>
              <div className="flex gap-2">
                <a
                  href={bpkProxyUrl(opened, "preview") + "&download=1"}
                  className="px-3 py-2 rounded-xl bg-white text-[var(--plum)] font-bold flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" /> Скачать preview
                </a>
                <button onClick={() => setOpened(null)} className="px-3 py-2 rounded-xl bg-[rgba(255,255,255,.2)] text-white font-bold">
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
