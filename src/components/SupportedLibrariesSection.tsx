"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Smartphone,
  ChevronDown,
  Zap,
  HelpCircle,
  PawPrint,
  Cat,
  ExternalLink,
  ArrowRight,
  Image as ImageIcon,
  Library,
  Landmark,
  Globe,
  Building2,
  Camera,
  Gavel,
  Archive,
} from "lucide-react";

/** Разделы с собственным поиском — продублированы внизу страницы для удобства. */
const sections = [
  { href: "/portraits", title: "Портреты Госкаталога", text: "Музейный фонд РФ: фильтры, пресеты, карточки экспонатов.", icon: ImageIcon },
  { href: "/dokumen", title: "Каталог dokumen.pub", text: "Свой каталог книг и глубокий поиск по архивному индексу.", icon: Library },
  { href: "/europeana", title: "Europeana", text: "50+ млн объектов Европы: тип, годы, открытые лицензии.", icon: Globe },
  { href: "/ddb", title: "Deutsche Digitale Bibliothek", text: "Живые фасеты категорий, годы создания, цифровые копии.", icon: Landmark },
  { href: "/berlin", title: "Музеи Берлина", text: "SMB Collections Online — открытые оригиналы JPG.", icon: Landmark },
  { href: "/klassik", title: "Klassik Stiftung Weimar", text: "Гёте, Шиллер и музеи Веймара через IIIF.", icon: Building2 },
  { href: "/bpk", title: "bpk-Fotoarchiv", text: "Портфели фотографов, превью с водяным знаком.", icon: Camera },
  { href: "/invaluable", title: "Invaluable", text: "Аукционные лоты: поиск, фото, эстимейт и цены.", icon: Gavel },
  { href: "/rct", title: "Royal Collection Trust", text: "Королевская коллекция: поиск, сведения и открытые изображения.", icon: Landmark },
  { href: "/szukajwarchiwach", title: "Szukaj w Archiwach", text: "Государственные архивы Польши (NAC, AGAD): сканы, метрики, документы.", icon: Archive },
] as const;

const libraries = [
  ["Президентская библиотека", "prlib.ru", "https://www.prlib.ru", "Документы по истории и праву, карты и рукописи.", "Полная поддержка", ["PDF", "ZIP"]],
  ["ГПИБ России", "elib.shpl.ru", "https://elib.shpl.ru", "Дореволюционные и советские книги, журналы и газеты.", "Оригинал elib-dl", ["PDF", "ZIP"]],
  ["Internet Archive", "archive.org", "https://archive.org", "Миллионы книг общественного достояния.", "Новинка", ["Готовый PDF"]],
  ["Dokumen.pub", "dokumen.pub", "https://dokumen.pub", "Открытая библиотека PDF: книга забирается одним файлом. Есть отдельный раздел поиска словами — у сайта собственный поиск не работает, поэтому котёнок ведёт свой каталог и помечает книги с доступным файлом.", "Поиск словами", ["Готовый PDF"]],
  ["RosDok — Universität Rostock", "rosdok.uni-rostock.de", "https://rosdok.uni-rostock.de", "Открытый университетский репозиторий: IIIF-читалка и прямой PDF через официальную страницу Download.", "IIIF + PDF", ["PDF", "ZIP"]],
  ["Staatliche Museen zu Berlin", "search.smb.museum", "https://search.smb.museum", "Официальные цифровые коллекции Берлина: публичный поиск, original JPG и лицензия на карточке объекта.", "Фото", ["PDF", "ZIP"]],
  ["museum-digital", "*.museum-digital.de", "https://bawue.museum-digital.de", "Региональные музейные каталоги Германии: официальный JSON API, изображения и права на каждой карточке.", "Public API", ["PDF", "ZIP"]],
  ["bpk-Fotoarchiv", "bpk-fotoarchiv.de", "https://bpk-fotoarchiv.de", "Исторический фотоархив Staatsbibliothek zu Berlin: в разделе показываем и скачиваем превью с водяным знаком. Магазин bpk-Bildagentur закрыт 30.06.2026, high-res — только через учреждения из метаданных.", "Превью + вотермарка", ["JPG"]],
  ["Europeana", "europeana.eu", "https://www.europeana.eu", "50+ млн объектов тысяч европейских учреждений: фильтр по типу, открытой лицензии, годам и провайдеру; скачиваем файл, на который ссылается сама Europeana.", "Объекты и фото", ["JPG", "PDF", "ZIP"]],
  ["Klassik Stiftung Weimar", "suche.klassik-stiftung.de", "https://suche.klassik-stiftung.de", "Коллекции Гёте, Шиллера и музеев Веймара: поиск, фильтры, превью и оригиналы через IIIF (full/full).", "IIIF фото", ["JPG", "PDF", "ZIP"]],
  ["Любая IIIF-библиотека", "IIIF · manifest.json", "https://iiif.io", "MDZ, Gallica, e-codices, Wellcome, Бодлеан и сотни других.", "Универсально", ["PDF", "ZIP"]],
  ["MDZ — Баварская библиотека", "digitale-sammlungen.de", "https://www.digitale-sammlungen.de", "Инкунабулы, рукописи и старопечатные книги.", "Через IIIF", ["PDF", "ZIP"]],
  ["ONB — Австрийская национальная библиотека", "viewer.onb.ac.at", "https://viewer.onb.ac.at", "Открытый IIIF: вставьте ссылку на объект — котёнок соберёт страницы.", "Через IIIF", ["PDF", "ZIP"]],
  ["Silesian Digital Library", "sbc.org.pl", "https://www.sbc.org.pl", "Открытые цифровые издания dLibra с проверенной прямой PDF-ссылкой.", "dLibra PDF", ["PDF"]],
  ["Invaluable", "invaluable.com", "https://www.invaluable.com", "Аукционные лоты: фото, эстимейт, цены и описания. Есть отдельный раздел поиска.", "Аукционы", ["JPG"]],
  ["Royal Collection Trust", "rct.uk / col.rct.uk", "https://www.rct.uk/collection/search", "Поиск по открытой коллекции, описание объекта и полноразмерные фото.", "Search API", ["JPG"]],
  ["Silesian Digital Library", "sbc.org.pl", "https://www.sbc.org.pl", "Открытые цифровые издания dLibra. Проверенная прямая PDF-ссылка на редакцию.", "dLibra PDF", ["PDF"]],
  ["ЭБИД", "docs.historyrussia.org", "http://docs.historyrussia.org", "Архивные фонды и исторические документы.", "Архивы", ["PDF", "ZIP"]],
] as const;

const faqs = [
  ["Что такое IIIF и почему это волшебство?", "IIIF — международный стандарт сотен библиотек. В manifest.json хранится список страниц; котёнок читает его и собирает PDF. Поддерживаются Presentation API 2 и 3."],
  ["Как открыть скачанный PDF на Android?", "Файл попадёт в папку «Загрузки». Его можно открыть в ReadEra, Книгах Google или Acrobat, а также отправить через системное меню «Поделиться»."],
  ["Почему котёнок и клубок?", "Скачивание книги похоже на распутывание клубка: страница за страницей ниточка превращается в аккуратно смотанный PDF."],
  ["Что делать с книгой на 500 страниц?", "Выберите первые страницы, свой диапазон или качество «Компактное» — файл станет легче, а текст останется читаемым."],
] as const;

export function SupportedLibrariesSection() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  return (
    <section className="space-y-8">
      <div className="card-boudoir p-5 sm:p-7 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-[radial-gradient(circle,rgba(232,131,160,.25),transparent_70%)]" />
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between relative">
          <div className="space-y-3"><span className="chip"><Zap className="w-3 h-3" />эволюция elib-dl</span><h3 className="font-display text-xl sm:text-2xl font-bold">Никаких командных строк — только мурчание</h3><p className="text-xs sm:text-sm text-[var(--plum-soft)]/85 max-w-xl">Котёнок обрабатывает всё на сервере и отдаёт готовый файл прямо в браузер смартфона.</p></div>
          <div className="grid grid-cols-2 gap-3 w-full md:w-auto"><div className="rounded-2xl p-3 text-center bg-[#fdf0ed] border border-[#f3c3bb]"><div className="text-[11px] line-through">CLI скрипт</div><strong className="text-xs">Только на ПК</strong></div><div className="rounded-2xl p-3 text-center bg-[var(--rose-100)] border border-[var(--rose-200)]"><Cat className="w-5 h-5 mx-auto" /><strong className="text-xs">Android · ПК</strong></div></div>
        </div>
      </div>

      <div className="space-y-4"><h3 className="font-display text-lg font-bold flex items-center gap-2"><PawPrint className="w-5 h-5 text-[var(--rose-500)]" />Полочки, где уже охотится котёнок</h3><div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {libraries.map(([name, domain, url, description, badge, formats]) => <article key={domain} className="card-boudoir p-4 space-y-2"><div className="flex justify-between gap-2"><div><strong className="text-xs block">{name}</strong><span className="text-[10px] text-[var(--ink-soft)]">{domain}</span></div><span className="chip !text-[10px] h-fit">{badge}</span></div><p className="text-xs text-[var(--plum-soft)]/80 line-clamp-2">{description}</p><div className="flex gap-1">{formats.map((format) => <span key={format} className="text-[10px] px-1.5 py-0.5 rounded-md bg-[var(--rose-100)] text-[var(--rose-700)] font-bold">{format}</span>)}<a href={url} target="_blank" rel="noreferrer" className="ml-auto" aria-label={`Открыть ${name}`}><ExternalLink className="w-3.5 h-3.5" /></a></div></article>)}
      </div><div className="rounded-2xl border-2 border-dashed border-[var(--rose-200)] bg-[rgba(253,231,224,.4)] p-4 text-xs flex gap-2.5"><Smartphone className="w-4 h-4 shrink-0" /><span><strong>Про НЭБ:</strong> у книг общественного достояния официальный PDF можно скачать прямо в их читалке.</span></div></div>

      <div className="space-y-4">
        <div>
          <h3 className="font-display text-lg font-bold flex items-center gap-2">
            <Landmark className="w-5 h-5 text-[var(--rose-500)]" />Разделы с собственным поиском
          </h3>
          <p className="text-xs text-[var(--ink-soft)] mt-1">
            Там, где удобнее искать прямо здесь, а не копировать ссылку из браузера.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sections.map(({ href, title, text, icon: Icon }) => (
            <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl tile-rose px-3.5 py-3">
              <span className="w-9 h-9 rounded-xl bg-[var(--rose-100)] border border-[var(--rose-200)] flex items-center justify-center shrink-0">
                <Icon className="w-4 h-4 text-[var(--rose-600)]" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-extrabold text-[var(--plum)]">{title}</span>
                <span className="block text-[11px] text-[var(--ink-soft)] leading-snug">{text}</span>
              </span>
              <ArrowRight className="w-4 h-4 text-[var(--rose-500)] group-hover:translate-x-0.5 transition-transform shrink-0" />
            </Link>
          ))}
        </div>
      </div>

      <div className="space-y-4"><h3 className="font-display text-lg font-bold flex items-center gap-2"><HelpCircle className="w-5 h-5 text-[var(--rose-500)]" />Частые вопросы про клубочка</h3><div className="space-y-2">{faqs.map(([question, answer], index) => <div key={question} className="card-boudoir overflow-hidden"><button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="w-full p-4 text-left flex justify-between gap-3 text-sm font-extrabold">{question}<ChevronDown className={`w-4 h-4 shrink-0 transition-transform ${openFaq === index ? "rotate-180" : ""}`} /></button>{openFaq === index && <div className="px-4 pb-4 pt-2 text-xs text-[var(--plum-soft)] leading-relaxed border-t border-[var(--border)]">{answer}</div>}</div>)}</div></div>
    </section>
  );
}
