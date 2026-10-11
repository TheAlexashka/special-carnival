"use client";

import React from "react";
import Link from "next/link";
import {
  PawPrint,
  Smartphone,
  Loader2,
  History,
  ImageIcon,
  Library,
  Landmark,
  Globe,
  Building2,
  Camera,
  Gavel,
  Archive,
} from "lucide-react";

interface HeaderProps {
  onOpenGuide: () => void;
  activeDownloadsCount: number;
  historyCount: number;
  onScrollToActive: () => void;
  onScrollToHistory: () => void;
}

const SECTIONS = [
  { href: "/portraits", label: "Госкаталог", icon: ImageIcon },
  { href: "/dokumen", label: "dokumen.pub", icon: Library },
  { href: "/europeana", label: "Europeana", icon: Globe },
  { href: "/ddb", label: "DDB", icon: Landmark },
  { href: "/berlin", label: "Музеи Берлина", icon: Landmark },
  { href: "/klassik", label: "Klassik Weimar", icon: Building2 },
  { href: "/bpk", label: "bpk-Fotoarchiv", icon: Camera },
  { href: "/invaluable", label: "Invaluable", icon: Gavel },
  { href: "/rct", label: "Royal Collection", icon: Landmark },
  { href: "/szukajwarchiwach", label: "Szukaj w Archiwach", icon: Archive },
];

export function Header({ onOpenGuide, activeDownloadsCount, historyCount, onScrollToActive, onScrollToHistory }: HeaderProps) {
  return (
    <header className="w-full border-b border-[var(--border)] bg-[rgba(253,247,241,0.94)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5 shrink-0">
          <span className="w-9 h-9 rounded-2xl btn-rose flex items-center justify-center">
            <PawPrint className="w-4.5 h-4.5" />
          </span>
          <span className="leading-tight">
            <span className="font-display text-lg font-bold italic text-[var(--plum)] block">Клубок</span>
            <span className="text-[10px] text-[var(--ink-soft)] hidden sm:block">книги и коллекции в один клик</span>
          </span>
        </Link>

        <div className="header-actions flex items-center gap-1.5 overflow-x-auto min-w-0">
          {activeDownloadsCount > 0 && (
            <button onClick={onScrollToActive} className="chip shrink-0 !py-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              {activeDownloadsCount} в работе
            </button>
          )}
          <button
            onClick={onScrollToHistory}
            className="btn-ghost-rose shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">История</span>
            {historyCount > 0 && <span>· {historyCount}</span>}
          </button>
          <button
            onClick={onOpenGuide}
            className="btn-ghost-rose shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1"
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Android</span>
          </button>
        </div>
      </div>

      <nav className="border-t border-[var(--border)]">
        <div className="header-actions max-w-6xl mx-auto px-4 sm:px-6 py-2 flex items-center gap-1.5 overflow-x-auto">
          {SECTIONS.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="tile-rose shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5"
            >
              <Icon className="w-3.5 h-3.5 text-[var(--rose-600)]" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
