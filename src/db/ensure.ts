import { sql } from "drizzle-orm";
import { db } from "./index";

/**
 * Самовосстановление схемы: таблицы создаются при старте сервера, даже если
 * `drizzle-kit push` ещё не запускали. SQL полностью совпадает со schema.ts.
 */
const CREATE_DOWNLOAD_JOBS = `CREATE TABLE IF NOT EXISTS "download_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "url" text NOT NULL,
  "library_type" text NOT NULL,
  "library_name" text NOT NULL,
  "title" text NOT NULL,
  "author" text,
  "year" text,
  "description" text,
  "cover_url" text,
  "total_pages" integer DEFAULT 0 NOT NULL,
  "page_range" text,
  "pages_to_download" json,
  "quality" text DEFAULT 'hd' NOT NULL,
  "format" text DEFAULT 'pdf' NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "progress_percent" integer DEFAULT 0 NOT NULL,
  "current_page" integer DEFAULT 0 NOT NULL,
  "total_download_pages" integer DEFAULT 0 NOT NULL,
  "file_path" text,
  "file_name" text,
  "file_size" bigint,
  "error_message" text,
  "metadata" json,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "completed_at" timestamp
)`;

const CREATE_SAVED_BOOKMARKS = `CREATE TABLE IF NOT EXISTS "saved_bookmarks" (
  "id" text PRIMARY KEY NOT NULL,
  "url" text NOT NULL,
  "title" text NOT NULL,
  "library_type" text NOT NULL,
  "cover_url" text,
  "total_pages" integer DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
)`;

const CREATE_DOKUMEN_BOOKS = `CREATE TABLE IF NOT EXISTS "dokumen_books" (
  "slug" text PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "cover_url" text,
  "size_label" text,
  "page_url" text NOT NULL,
  "source_page" integer DEFAULT 1 NOT NULL,
  "discovered_at" timestamp DEFAULT now() NOT NULL,
  "has_file" boolean,
  "file_url" text,
  "verified_at" timestamp
)`;

let ensuring: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ensuring) {
    ensuring = (async () => {
      await db.execute(sql.raw(CREATE_DOWNLOAD_JOBS));
      await db.execute(sql.raw(CREATE_SAVED_BOOKMARKS));
      await db.execute(sql.raw(CREATE_DOKUMEN_BOOKS));
    })().catch((err) => {
      ensuring = null;
      throw err;
    });
  }
  return ensuring;
}

/** Вызывается один раз при старте сервера (instrumentation.ts). */
export async function bootstrapDatabase(): Promise<void> {
  try {
    await ensureSchema();
    // Фоновые сборки не переживают перезапуск процесса — честно помечаем их.
    await db.execute(
      sql`UPDATE "download_jobs" SET "status" = 'failed', "error_message" = ${"Сервер перезапустился во время сборки файла — запустите скачивание ещё раз."}, "updated_at" = now(), "completed_at" = now() WHERE "status" IN ('pending', 'processing')`
    );
  } catch (err) {
    console.warn("[klubok] database bootstrap skipped:", err instanceof Error ? err.message : err);
  }
}
