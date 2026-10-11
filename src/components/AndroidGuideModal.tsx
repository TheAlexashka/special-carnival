"use client";

import React from "react";
import { X, Globe, Copy, CheckCircle, Share2, FileText, PawPrint, Smartphone } from "lucide-react";
import { KittenChase } from "./mascot";

export function AndroidGuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  if (!isOpen) return null;
  const steps = [
    ["Откройте сайт библиотеки на телефоне", "Зайдите в браузере на prlib.ru, elib.shpl.ru, archive.org или cyberleninka.ru и найдите книгу.", Globe],
    ["Скопируйте ссылку на книгу", "Нажмите на адресную строку или кнопку «Поделиться» и скопируйте адрес книги.", Copy],
    ["Позовите котёнка", "Вставьте ссылку на нашей странице. Котёнок определит название, обложку и количество страниц.", PawPrint],
    ["Выберите формат и качество", "Всю книгу или нужные страницы; компактное качество удобно для мобильного интернета.", FileText],
    ["Заберите PDF из «Загрузок»", "Следите за клубочком-прогрессом, затем скачайте файл или отправьте его через кнопку «Поделиться».", Share2],
  ] as const;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[rgba(58,32,44,.78)] backdrop-blur-sm" onClick={onClose}>
      <div className="card-boudoir max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--rose-100)] flex items-center gap-4">
          <div className="w-24 shrink-0"><KittenChase /></div>
          <div className="flex-1"><h3 className="font-display text-base sm:text-xl font-bold">Как приручить книгу на Android</h3><p className="text-xs text-[var(--plum-soft)]/80 mt-1">Без компьютера, терминала и Python — только телефон и мурлычущий котёнок.</p></div>
          <button onClick={onClose} className="p-2 rounded-xl text-[var(--ink-soft)] hover:bg-white/70"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 sm:p-6 overflow-y-auto space-y-3">
          <div className="rounded-2xl bg-[var(--rose-100)] border border-[var(--rose-200)] p-3.5 text-xs flex gap-2.5"><Smartphone className="w-4 h-4 shrink-0" /><span>Вся обработка идёт на сервере: телефону останется только нажать «Скачать».</span></div>
          {steps.map(([title, description, Icon], index) => <div key={title} className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/70 border border-[var(--border)]"><div className="w-8 h-8 rounded-xl btn-rose font-extrabold text-sm flex items-center justify-center shrink-0">{index + 1}</div><div><h4 className="text-sm font-extrabold flex items-center gap-1.5"><Icon className="w-3.5 h-3.5 text-[var(--rose-600)]" />{title}</h4><p className="text-xs text-[var(--plum-soft)]/85 leading-relaxed mt-1">{description}</p></div></div>)}
          <div className="p-3 rounded-2xl bg-[#f7f1e2] border border-[#e7d9b7] text-xs text-[#7a6236]"><strong className="flex items-center gap-1.5"><PawPrint className="w-3.5 h-3.5" />Совет котёнка:</strong><p className="mt-1">Если интернет медленный — выбирайте «Компактное» качество или скачивайте книгу по частям.</p></div>
        </div>
        <div className="p-4 border-t border-[var(--border)] bg-white/60"><button onClick={onClose} className="btn-rose w-full py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4" />Всё понятно, зову котёнка!</button></div>
      </div>
    </div>
  );
}
