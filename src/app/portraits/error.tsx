"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RotateCw, ExternalLink, PawPrint } from "lucide-react";

/**
 * Граница ошибок раздела «Портреты Госкаталога».
 *
 * Без неё любая ошибка рендера показывала бы стандартную английскую заглушку
 * Next.js («This page couldn't load»). Здесь — понятное сообщение по-русски,
 * кнопка повтора и запасная ссылка на сам Госкаталог, которая работает всегда,
 * потому что открывается в браузере пользователя напрямую.
 */
export default function PortraitsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Portraits section error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-12">
      <div className="card-boudoir max-w-lg w-full p-6 sm:p-8 space-y-5 text-center">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-[var(--rose-100)] border border-[var(--rose-200)] flex items-center justify-center">
          <AlertTriangle className="w-7 h-7 text-[var(--rose-600)]" />
        </div>

        <div className="space-y-2">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--plum)]">
            Раздел не смог открыться
          </h1>
          <p className="text-xs sm:text-sm text-[var(--plum-soft)] leading-relaxed">
            Обычно это означает, что приложение только что перезапустилось и страница
            осталась от предыдущей сборки. Нажмите «Обновить раздел» — чаще всего этого
            достаточно.
          </p>
        </div>

        <div className="rounded-2xl bg-[#fdf0ed] border border-[#f3c3bb] px-3.5 py-3 text-[11px] text-[#9a4a3e] text-left break-words">
          <strong>Что произошло:</strong> {error.message || "неизвестная ошибка"}
          {error.digest && <span className="opacity-70"> · код {error.digest}</span>}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={reset}
            className="btn-rose flex-1 px-4 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2"
          >
            <RotateCw className="w-4 h-4" /> Обновить раздел
          </button>
          <a
            href="https://goskatalog.ru/portal/#/collections"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost-rose flex-1 px-4 py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2"
          >
            <ExternalLink className="w-4 h-4" /> Госкаталог напрямую
          </a>
        </div>

        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--rose-700)] hover:underline"
        >
          <PawPrint className="w-3.5 h-3.5" /> Вернуться к клубочку книг
        </a>
      </div>
    </main>
  );
}
