"use client";

import React, { useEffect, useState } from "react";
import {
  X,
  Download,
  ExternalLink,
  Loader2,
  Building2,
  Hash,
  Calendar,
  MapPin,
  Layers,
  AlertTriangle,
  Archive,
} from "lucide-react";
import type { GkExhibitDetail } from "@/lib/goskatalog/types";
import { buildExhibitDeepLink } from "@/lib/goskatalog/client";

export function ExhibitModal({ id, onClose }: { id: number; onClose: () => void }) {
  const [exhibit, setExhibit] = useState<GkExhibitDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [isZipping, setIsZipping] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    fetch(`/api/goskatalog/exhibit/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) {
          setExhibit(data.exhibit);
        } else {
          setError(data.error || "Карточка недоступна");
        }
      })
      .catch((err) => !cancelled && setError(String(err)))
      .finally(() => !cancelled && setIsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const downloadAllAsZip = async () => {
    if (!exhibit || !exhibit.images.length) return;
    setIsZipping(true);
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      await Promise.all(
        exhibit.images.map(async (img, idx) => {
          const res = await fetch(`/api/goskatalog/image?id=${img.id}&original=1`);
          const blob = await res.blob();
          zip.file(`${idx + 1}.jpg`, blob);
        })
      );
      const content = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(content);
      const a = document.createElement("a");
      a.href = url;
      a.download = `goskatalog_${exhibit.id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Не удалось собрать архив: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[rgba(58,32,44,0.78)] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="card-boudoir w-full max-w-3xl max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 border-b border-[var(--border)] bg-[rgba(253,247,241,0.95)] backdrop-blur">
          <h3 className="font-display text-sm font-bold text-[var(--plum)] truncate pr-3">
            {exhibit?.title || "Карточка экспоната"}
          </h3>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-[var(--rose-100)] text-[var(--ink-soft)] shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-16 text-[var(--rose-700)] text-sm font-bold">
              <Loader2 className="w-5 h-5 animate-spin" /> Загружаем карточку с Госкаталога…
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-2xl border border-[#e7c9a9] bg-[#fdf3e4] p-4 text-xs text-[#7a5a2e] flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#b4812f]" />
              <div className="space-y-2">
                <p>{error}</p>
                <a
                  href={buildExhibitDeepLink(id)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#b4812f] text-white font-bold text-[11px]"
                >
                  Открыть карточку на goskatalog.ru <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {!isLoading && exhibit && (
            <>
              {/* Image gallery */}
              <div className="space-y-2">
                <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-[var(--rose-100)] border border-[var(--border)] flex items-center justify-center">
                  {exhibit.images[activeImage] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/goskatalog/image?id=${exhibit.images[activeImage].id}&original=1`}
                      alt={exhibit.title}
                      className="max-w-full max-h-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-[var(--ink-soft)] font-bold">Фото недоступно</span>
                  )}
                </div>
                {exhibit.images.length > 1 && (
                  <div className="flex gap-1.5 overflow-x-auto pb-1">
                    {exhibit.images.map((img, idx) => (
                      <button
                        key={img.id}
                        onClick={() => setActiveImage(idx)}
                        className={`shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 ${
                          idx === activeImage ? "border-[var(--rose-500)]" : "border-transparent"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={`/api/goskatalog/image?id=${img.id}`} alt="" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Metadata */}
              <div className="grid sm:grid-cols-2 gap-3 text-xs text-[var(--plum-soft)]">
                {exhibit.museum?.name && (
                  <Field icon={<Building2 className="w-3.5 h-3.5" />} label="Музей" value={exhibit.museum.name} />
                )}
                {exhibit.categoryName && (
                  <Field icon={<Layers className="w-3.5 h-3.5" />} label="Категория" value={exhibit.categoryName} />
                )}
                {(exhibit.gikNumber || exhibit.invNumber) && (
                  <Field
                    icon={<Hash className="w-3.5 h-3.5" />}
                    label="Номер по ГИК / инв."
                    value={[exhibit.gikNumber, exhibit.invNumber].filter(Boolean).join(" / ")}
                  />
                )}
                {exhibit.periodStr && (
                  <Field icon={<Calendar className="w-3.5 h-3.5" />} label="Период создания" value={exhibit.periodStr} />
                )}
                {exhibit.productionPlace && (
                  <Field icon={<MapPin className="w-3.5 h-3.5" />} label="Место создания" value={exhibit.productionPlace} />
                )}
                {exhibit.dimensions && <Field label="Размер" value={exhibit.dimensions} />}
                {exhibit.technologies?.length ? (
                  <Field label="Материал, техника" value={exhibit.technologies.join(", ")} />
                ) : null}
              </div>

              {exhibit.description && (
                <div className="space-y-1.5">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--ink-soft)]">
                    Описание
                  </h4>
                  <p className="text-xs text-[var(--plum-soft)] leading-relaxed whitespace-pre-line">
                    {exhibit.description}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
                {exhibit.images[activeImage] && (
                  <a
                    href={`/api/goskatalog/image?id=${exhibit.images[activeImage].id}&original=1&download=1&filename=goskatalog_${exhibit.id}_${activeImage + 1}.jpg`}
                    className="btn-rose px-4 py-2.5 rounded-2xl font-extrabold text-xs flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" /> Скачать фото
                  </a>
                )}
                {exhibit.images.length > 1 && (
                  <button
                    onClick={downloadAllAsZip}
                    disabled={isZipping}
                    className="btn-ghost-rose px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 disabled:opacity-60"
                  >
                    {isZipping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />}
                    Скачать все ({exhibit.images.length}) архивом
                  </button>
                )}
                <a
                  href={exhibit.deepLink}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-2xl font-bold text-xs flex items-center gap-1.5 text-[var(--rose-700)] hover:bg-[var(--rose-100)] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Открыть на goskatalog.ru
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-1.5">
      {icon && <span className="text-[var(--ink-soft)] shrink-0 mt-0.5">{icon}</span>}
      <div>
        <span className="text-[var(--ink-soft)] block text-[10px] uppercase font-bold tracking-wide">{label}</span>
        <span className="font-bold text-[var(--plum)]">{value}</span>
      </div>
    </div>
  );
}
