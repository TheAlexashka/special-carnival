"use client";

import React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";

export function ConnectivityNotice({
  deepLink,
  warning,
  upstreamUrl,
}: {
  deepLink: string;
  warning?: string;
  upstreamUrl?: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e7c9a9] bg-[#fdf3e4] p-4 text-xs text-[#7a5a2e] flex items-start gap-3">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#b4812f]" />
      <div className="space-y-2">
        <p className="leading-relaxed">
          <strong>Прямой доступ к Госкаталогу закрыт, и резервный пул тоже не прошёл.</strong>{" "}
          Сервер сначала пробует обратиться напрямую, а при отказе автоматически подбирает
          российские посредники — сейчас их не осталось живых. Ваш браузер с обычного IP обычно
          не блокируется, поэтому откройте такой же поиск напрямую на сайте.
        </p>
        {warning && <p className="text-[11px] text-[#9a7b4a] break-words">Техническая причина: {warning}</p>}
        {upstreamUrl && (
          <p className="text-[10px] text-[#9a7b4a]/80 break-all font-mono leading-relaxed">
            Запрос к каталогу: {upstreamUrl}
          </p>
        )}
        <a
          href={deepLink}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#b4812f] text-white font-bold text-[11px]"
        >
          Открыть этот поиск на goskatalog.ru <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}
