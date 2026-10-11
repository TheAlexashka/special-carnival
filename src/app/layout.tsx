import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Клубок — уютный загрузчик книг из библиотек",
  description:
    "Будуарный сервис-котёнок: вставьте ссылку на открытую книгу с prlib.ru, elib.shpl.ru, archive.org или CyberLeninka — котёнок распутает клубок и соберёт готовый PDF прямо на ваш Android или ПК.",
  applicationName: "Клубок",
  keywords: [
    "prlib",
    "elib-dl",
    "неб",
    "archive.org",
    "cyberleninka",
    "скачать с prlib",
    "книги в pdf",
    "android",
  ],
  authors: [{ name: "Клубочный библиотекарь" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#fdf7f1",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,600&family=Nunito:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
