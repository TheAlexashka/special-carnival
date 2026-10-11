export interface GkMuseum {
  id: number;
  name: string;
  code?: string;
}

export interface GkCategory {
  id: string;
  label: string;
  /** Known numeric typology id on goskatalog.ru, when confidently confirmed. */
  typologyId?: number;
}

export interface GkImage {
  id: number;
  code?: string;
  url?: string;
}

export interface GkExhibitSummary {
  id: number;
  title: string;
  description?: string;
  museum?: GkMuseum;
  categoryName?: string;
  gikNumber?: string;
  invNumber?: string;
  periodStr?: string;
  images: GkImage[];
  thumbnailUrl?: string;
  deepLink: string;
}

export interface GkExhibitDetail extends GkExhibitSummary {
  productionPlace?: string;
  dimensions?: string;
  technologies?: string[];
  author?: string;
}

export type TextMatchMode = "any" | "all" | "none";

export interface GkSearchFilters {
  /** Шифр / номер по ГИК / инвентарный номер */
  code?: string;
  title?: string;
  titleMode?: TextMatchMode;
  description?: string;
  descriptionMode?: TextMatchMode;
  museumIds?: number[];
  categoryIds?: string[];
  onlyWithPhoto?: boolean;
  page: number;
  pageSize: number;
}

export interface GkSearchResult {
  items: GkExhibitSummary[];
  page: number;
  pageSize: number;
  /** Best-effort total reported by goskatalog.ru before our own client-side refinement. */
  upstreamTotal: number | null;
  /** How many items on this page matched after our own strict text/category refinement. */
  refinedCount: number;
  hasNextPage: boolean;
  deepLink: string;
  /** Что именно мы спросили у Госкаталога — для прозрачности и отладки. */
  upstreamUrl?: string;
  source: "live" | "unavailable";
  warning?: string;
}
