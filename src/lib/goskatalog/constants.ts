import type { GkCategory, GkMuseum } from "./types";

/**
 * Стандартный классификатор типов музейных предметов, единый для всех музеев,
 * сдающих данные в Госкаталог. Числовой typologyId указан только там, где он
 * подтверждён реальным ответом API (see README на goskatalog.ru/muzfo-rest) —
 * для остальных категорий фильтрация подстраховывается проверкой названия
 * раздела прямо в карточке экспоната, поэтому результат остаётся точным даже
 * без точного числового идентификатора.
 */
/**
 * Числовые typologyId взяты из официального справочника самого Госкаталога
 * (эндпоинт /muzfo-rest/rest/dicts, раздел "typology"), а не подобраны на глаз.
 * Названия тоже приведены к официальным — тогда и серверный фильтр
 * (typologyIds=…), и наша дополнительная проверка по названию раздела в карточке
 * работают точно.
 */
export const GK_CATEGORIES: GkCategory[] = [
  { id: "photo", label: "Фотографии и негативы", typologyId: 17 },
  { id: "painting", label: "Живопись", typologyId: 1 },
  { id: "graphics", label: "Графика", typologyId: 2 },
  { id: "sculpture", label: "Скульптура", typologyId: 3 },
  { id: "applied", label: "Предметы прикладного искусства, быта и этнографии", typologyId: 13 },
  { id: "numismatics", label: "Предметы нумизматики", typologyId: 5 },
  { id: "archaeology", label: "Предметы археологии", typologyId: 6 },
  { id: "weapons", label: "Оружие", typologyId: 8 },
  { id: "documents", label: "Документы", typologyId: 15 },
  { id: "rare-books", label: "Редкие книги", typologyId: 14 },
  { id: "printed", label: "Предметы печатной продукции", typologyId: 16 },
  { id: "equipment", label: "Предметы техники", typologyId: 11 },
  { id: "natural", label: "Предметы естественнонаучной коллекции", typologyId: 10 },
  { id: "mineral", label: "Предметы минералогической коллекции", typologyId: 18 },
  { id: "other", label: "Прочие", typologyId: 12 },
];

/** Подсказки для быстрого старта: ключевые слова, которые чаще всего встречаются в портретных карточках. */
export const PORTRAIT_PRESET_KEYWORDS = ["портрет", "автопортрет", "парсуна", "погрудный портрет"];

/**
 * Небольшой куратовский список крупных музеев для быстрого выбора без похода
 * к живому API (используется как подсказки и как резерв, если список музеев
 * с сервера временно недоступен).
 */
export const GK_POPULAR_MUSEUMS: GkMuseum[] = [
  { id: 2594, name: "Государственная Третьяковская галерея" },
  { id: 2593, name: "Государственный Русский музей" },
  { id: 1573, name: "Государственный Эрмитаж" },
  { id: 2592, name: "Государственный исторический музей" },
  { id: 2470, name: "Государственный музей изобразительных искусств им. А.С. Пушкина" },
  { id: 2140, name: "Музей-заповедник «Царское Село»" },
  { id: 2279, name: "Всероссийский музей А.С. Пушкина" },
  { id: 736, name: "Национальный музей Республики Тыва им. Алдан-Маадыр" },
];

export const GK_PAGE_SIZE_OPTIONS = [20, 50, 100, 200] as const;

export const GK_PORTAL_BASE = "https://goskatalog.ru/portal/#";
export const GK_REST_BASE = "https://goskatalog.ru/muzfo-rest/rest";
export const GK_IMAGE_BASE = "https://goskatalog.ru/muzfo-imaginator/rest/images";
