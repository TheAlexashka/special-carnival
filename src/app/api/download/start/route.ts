import { NextRequest, NextResponse } from "next/server";
import { parseBookUrl } from "@/lib/parsers";
import { processDownloadJob, parsePageRange } from "@/lib/downloader";
import { db } from "@/db";
import { downloadJobs } from "@/db/schema";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    const pageRange = typeof body.pageRange === "string" ? body.pageRange.trim() || "all" : "all";
    const quality = body.quality === "original" || body.quality === "mobile" ? body.quality : "hd";
    const format = body.format === "zip" ? "zip" : "pdf";
    const customTitle = typeof body.customTitle === "string" ? body.customTitle.trim() : "";

    if (!url) {
      return NextResponse.json({ success: false, error: "Укажите ссылку на книгу" }, { status: 400 });
    }

    const metadata = await parseBookUrl(url);
    const finalTitle = customTitle || metadata.title;
    const jobId = crypto.randomUUID();
    const selectedPagesIndices = parsePageRange(pageRange, metadata.totalPages);
    const pagesForJob = metadata.pages.length ? metadata.pages : [{
      index: 1,
      label: "Полный PDF",
      thumbnailUrl: metadata.coverUrl || "",
      originalUrl: metadata.directPdfUrl || metadata.url,
      hdUrl: metadata.directPdfUrl || metadata.url,
      mobileUrl: metadata.directPdfUrl || metadata.url,
    }];

    await db.insert(downloadJobs).values({
      id: jobId,
      url,
      libraryType: metadata.libraryType,
      libraryName: metadata.libraryName,
      title: finalTitle,
      author: metadata.author || null,
      year: metadata.year || null,
      description: metadata.description || null,
      coverUrl: metadata.coverUrl || null,
      totalPages: metadata.totalPages,
      pageRange,
      pagesToDownload: selectedPagesIndices,
      quality,
      format,
      status: "pending",
      progressPercent: 0,
      currentPage: 0,
      totalDownloadPages: metadata.directPdfUrl ? 1 : selectedPagesIndices.length,
      metadata: metadata.metaRaw || null,
    });

    processDownloadJob({
      jobId,
      url,
      libraryType: metadata.libraryType,
      title: finalTitle,
      pages: pagesForJob,
      pageRangeStr: pageRange,
      quality,
      format,
      directPdfUrl: metadata.directPdfUrl,
    }).catch((err) => console.error(`Background job ${jobId} error:`, err));

    return NextResponse.json({
      success: true,
      jobId,
      title: finalTitle,
      totalPages: metadata.totalPages,
      selectedPagesCount: metadata.directPdfUrl ? 1 : selectedPagesIndices.length,
      format,
      quality,
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Failed to start download job:", error);
    return NextResponse.json({ success: false, error: error || "Ошибка запуска скачивания" }, { status: 500 });
  }
}
