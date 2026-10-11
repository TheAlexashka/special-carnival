export type SupportedLibraryType =
  | "prlib"
  | "shpl"
  | "historyrussia"
  | "unatlib"
  | "gwar"
  | "kazneb"
  | "archive"
  | "cyberleninka"
  | "iiif"
  | "rusneb"
  | "dokumen"
  | "rosdok"
  | "smb"
  | "museumdigital"
  | "klassik"
  | "sbc"
  | "rct"
  | "generic";

export interface PageInfo {
  index: number; // 1-based index
  id?: string | number;
  label: string; // e.g. "Страница 1"
  thumbnailUrl: string;
  originalUrl: string;
  hdUrl: string;
  mobileUrl: string;
  width?: number;
  height?: number;
}

export interface BookMetadata {
  url: string;
  libraryType: SupportedLibraryType;
  libraryName: string;
  libraryIcon?: string;
  title: string;
  author?: string;
  year?: string;
  publisher?: string;
  description?: string;
  coverUrl?: string;
  totalPages: number;
  directPdfUrl?: string;
  pages: PageInfo[];
  metaRaw?: Record<string, unknown>;
}

export interface DownloadOptions {
  pageRange?: string; // e.g., "1-10", "1,3,5-10", "all"
  quality: "original" | "hd" | "mobile";
  format: "pdf" | "zip";
  customTitle?: string;
}

export interface DownloadProgress {
  jobId: string;
  /** Исходная ссылка на книгу, нужна для ручного fallback при ограничениях источника. */
  url?: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled";
  progressPercent: number;
  currentPage: number;
  totalPages: number;
  downloadedBytes?: number;
  totalBytesEstimated?: number;
  fileName?: string;
  fileSize?: number;
  fileUrl?: string;
  errorMessage?: string;
  etaSeconds?: number;
  title: string;
  libraryName: string;
  coverUrl?: string;
  format: "pdf" | "zip";
  quality: "original" | "hd" | "mobile";
  createdAt: string;
}
