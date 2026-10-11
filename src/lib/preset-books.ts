export interface PresetBook {
  id: string;
  url: string;
  title: string;
  category: string;
  source: string;
  libraryType:
    | "prlib"
    | "shpl"
    | "historyrussia"
    | "unatlib"
    | "gwar"
    | "archive"
    | "cyberleninka"
    | "iiif"
    | "dokumen"
    | "sbc"
    | "rct";
  description: string;
  tag: string;
  pagesApprox: number;
  badgeColor: string;
}

export const PRESET_BOOKS: PresetBook[] = [
  {
    id: "prlib-const",
    url: "https://www.prlib.ru/item/420931",
    title: "Конституция Российской Федерации (Официальное издание)",
    category: "Государственность и право",
    source: "Президентская библиотека им. Б.Н. Ельцина",
    libraryType: "prlib",
    description: "Официальный текст Конституции РФ с изменениями и комментариями.",
    tag: "Топ выбор",
    pagesApprox: 65,
    badgeColor: "bg-blue-600",
  },
  {
    id: "prlib-peter",
    url: "https://www.prlib.ru/item/331483",
    title: "Устав воинский сухопутный Петра I (1716 г.)",
    category: "Военная история",
    source: "Президентская библиотека им. Б.Н. Ельцина",
    libraryType: "prlib",
    description: "Свод военных законов Российской империи, учрежденный Петром I.",
    tag: "Раритет",
    pagesApprox: 120,
    badgeColor: "bg-amber-600",
  },
  {
    id: "prlib-atlas",
    url: "https://www.prlib.ru/item/360454",
    title: "Атлас Российской Империи (1745 г.)",
    category: "Карты и география",
    source: "Президентская библиотека им. Б.Н. Ельцина",
    libraryType: "prlib",
    description: "Первый официальный географический атлас Российской империи.",
    tag: "Иллюстрации",
    pagesApprox: 30,
    badgeColor: "bg-emerald-600",
  },
  {
    id: "shpl-housing",
    url: "http://elib.shpl.ru/ru/nodes/16533",
    title: "Жилищное строительство в городских поселениях РСФСР (1927 г.)",
    category: "Статистика и быт",
    source: "ГПИБ России (Историческая библиотека)",
    libraryType: "shpl",
    description: "Статистико-экономический сборник о строительстве и жилье первых лет СССР.",
    tag: "История XX в.",
    pagesApprox: 66,
    badgeColor: "bg-purple-600",
  },
  {
    id: "shpl-speransky",
    url: "http://elib.shpl.ru/ru/nodes/22092",
    title: "М. М. Сперанский (1809–1909): Биографический очерк",
    category: "Биографии",
    source: "ГПИБ России (Историческая библиотека)",
    libraryType: "shpl",
    description: "Очерк о жизни и реформаторской деятельности графа Сперанского.",
    tag: "Биографии",
    pagesApprox: 166,
    badgeColor: "bg-indigo-600",
  },
  {
    id: "history-gko",
    url: "http://docs.historyrussia.org/ru/nodes/139435",
    title: "Постановления Государственного Комитета Обороны (1941–1945)",
    category: "Архивные документы",
    source: "Электронная библиотека исторических документов (РИО)",
    libraryType: "historyrussia",
    description: "Оригинальные архивные протоколы и распоряжения времен ВОВ.",
    tag: "Архив ВОВ",
    pagesApprox: 45,
    badgeColor: "bg-rose-600",
  },
  {
    id: "archive-sherlock",
    url: "https://archive.org/details/adventuresofsher00doyl",
    title: "Adventures of Sherlock Holmes (Conan Doyle)",
    category: "Мировая классика",
    source: "Internet Archive (chrome читалка BookReader)",
    libraryType: "archive",
    description: "Та самая читалка с кнопкой Download: готовый PDF общественного достояния.",
    tag: "Новый порог",
    pagesApprox: 350,
    badgeColor: "bg-rose-400",
  },
  {
    id: "cyber-openscience",
    url: "https://cyberleninka.ru/article/n/vozmozhnye-puti-razvitiya-otkrytoy-nauki-v-rossii",
    title: "Возможные пути развития открытой науки в России",
    category: "Наука об открытой науке",
    source: "CyberLeninka — научные статьи",
    libraryType: "cyberleninka",
    description: "Статья в открытом доступе: PDF отдаётся прямо со страницы-читалки.",
    tag: "Открытый доступ",
    pagesApprox: 9,
    badgeColor: "bg-pink-500",
  },
  {
    id: "mdz-iiif",
    url: "https://www.digitale-sammlungen.de/en/view/bsb10073040",
    title: "Handbibliothek für angehende Chemiker und Pharmazeuten (MDZ)",
    category: "Старопечатные книги",
    source: "MDZ — Баварская государственная библиотека (через IIIF)",
    libraryType: "iiif",
    description: "Проверка универсального IIIF-детектора: манифест находится сам, 84 страницы.",
    tag: "IIIF",
    pagesApprox: 84,
    badgeColor: "bg-violet-500",
  },
  {
    id: "dokumen-python",
    url: "https://dokumen.pub/download/mastering-python-design-patterns-2nbsped-9781788837484.html",
    title: "Mastering Python Design Patterns [2 ed.]",
    category: "Программирование",
    source: "Dokumen.pub — открытая библиотека PDF",
    libraryType: "dokumen",
    description:
      "Новый источник: книга целиком одним PDF, страница распознаётся по кнопке DOWNLOAD FILE.",
    tag: "Dokumen.pub",
    pagesApprox: 231,
    badgeColor: "bg-teal-600",
  },
  {
    id: "sbc-warszawska",
    url: "https://www.sbc.org.pl/en/dlibra/publication/96882/edition/91298",
    title: "Biblioteka Warszawska, 1877, T. 4",
    category: "Историческая периодика",
    source: "Silesian Digital Library — Biblioteka Śląska",
    libraryType: "sbc",
    description: "Открытое издание dLibra. PDF скачивается целиком из метаданных страницы.",
    tag: "SBC · PDF",
    pagesApprox: 1,
    badgeColor: "bg-blue-700",
  },
  {
    id: "rct-andrea-odoni",
    url: "https://www.rct.uk/collection/405776/andrea-odoni",
    title: "Andrea Odoni — Lorenzo Lotto",
    category: "Королевская коллекция",
    source: "Royal Collection Trust",
    libraryType: "rct",
    description: "Портрет XVI века: официальная карточка, описание и изображение высокого разрешения.",
    tag: "Royal Collection",
    pagesApprox: 1,
    badgeColor: "bg-rose-600",
  },
];
