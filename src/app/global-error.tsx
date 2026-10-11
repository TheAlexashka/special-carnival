"use client";

import React from "react";

/**
 * Глобальная граница ошибок: последняя линия защиты, если упал корневой
 * layout. Показываем русское сообщение и кнопку полной перезагрузки.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fdf7f1",
          color: "#4a2a38",
          fontFamily: "Nunito, system-ui, -apple-system, Segoe UI, sans-serif",
          padding: 24,
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            background: "rgba(255,252,249,0.95)",
            border: "1px solid #efdcd6",
            borderRadius: 24,
            padding: 28,
            textAlign: "center",
            boxShadow: "0 10px 34px rgba(192,94,125,0.16)",
          }}
        >
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 10px" }}>
            Страница не смогла загрузиться
          </h1>
          <p style={{ fontSize: 13, lineHeight: 1.6, margin: "0 0 18px", color: "#6d3d4d" }}>
            Приложение, скорее всего, перезапустилось. Перезагрузите страницу — обычно
            всё сразу возвращается в норму.
          </p>
          <p
            style={{
              fontSize: 11,
              lineHeight: 1.5,
              margin: "0 0 18px",
              padding: 12,
              borderRadius: 14,
              background: "#fdf0ed",
              border: "1px solid #f3c3bb",
              color: "#9a4a3e",
              wordBreak: "break-word",
            }}
          >
            {error?.message || "неизвестная ошибка"}
            {error?.digest ? ` · код ${error.digest}` : ""}
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{
                padding: "12px 20px",
                borderRadius: 16,
                border: "none",
                cursor: "pointer",
                fontWeight: 800,
                fontSize: 13,
                color: "#fff7f3",
                background: "linear-gradient(135deg,#d67d94,#b64e6f 55%,#a03f60)",
              }}
            >
              Попробовать снова
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "12px 20px",
                borderRadius: 16,
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 13,
                color: "#a84a68",
                background: "#fff",
                border: "1.5px solid #eeb3ae",
              }}
            >
              Полная перезагрузка
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
