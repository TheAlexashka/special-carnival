import { bigint, boolean, integer, json, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const downloadJobs = pgTable("download_jobs", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  libraryType: text("library_type").notNull(),
  libraryName: text("library_name").notNull(),
  title: text("title").notNull(),
  author: text("author"),
  year: text("year"),
  description: text("description"),
  coverUrl: text("cover_url"),
  totalPages: integer("total_pages").notNull().default(0),
  pageRange: text("page_range"),
  pagesToDownload: json("pages_to_download"),
  quality: text("quality").notNull().default("hd"), // 'original' | 'hd' | 'mobile'
  format: text("format").notNull().default("pdf"), // 'pdf' | 'zip'
  status: text("status").notNull().default("pending"), // 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progressPercent: integer("progress_percent").notNull().default(0),
  currentPage: integer("current_page").notNull().default(0),
  totalDownloadPages: integer("total_download_pages").notNull().default(0),
  filePath: text("file_path"),
  fileName: text("file_name"),
  fileSize: bigint("file_size", { mode: "number" }),
  errorMessage: text("error_message"),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const savedBookmarks = pgTable("saved_bookmarks", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title").notNull(),
  libraryType: text("library_type").notNull(),
  coverUrl: text("cover_url"),
  totalPages: integer("total_pages").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Локальный корпус книг dokumen.pub для поиска словами.
 *
 * Собственный поиск сайта не работает (проверено: /search и /category?page=
 * возвращают один и тот же фиксированный список из 24 «новинок» при любом
 * запросе), а внешние поисковики закрыты антиботом. Зато корневая пагинация
 * dokumen.pub/1…/19 отдаёт уникальные книги — их и складываем сюда, чтобы
 * искать по заголовку и описанию быстро и повторно.
 */
export const dokumenBooks = pgTable("dokumen_books", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  coverUrl: text("cover_url"),
  sizeLabel: text("size_label"),
  pageUrl: text("page_url").notNull(),
  sourcePage: integer("source_page").notNull().default(1),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
  /**
   * Проверено ли, что у книги реально есть скачиваемый файл.
   * По замеру на живой выборке только ~33% изданий отдают настоящий PDF,
   * а ~67% показывают служебную заглушку min.pdf — поэтому статус важен
   * и показывается в выдаче, чтобы не кликать «пустые» книги.
   */
  hasFile: boolean("has_file"),
  fileUrl: text("file_url"),
  verifiedAt: timestamp("verified_at"),
});

export type DownloadJob = typeof downloadJobs.$inferSelect;
export type NewDownloadJob = typeof downloadJobs.$inferInsert;
export type SavedBookmark = typeof savedBookmarks.$inferSelect;
export type DokumenBook = typeof dokumenBooks.$inferSelect;
