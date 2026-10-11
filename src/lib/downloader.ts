import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import fs from "fs";
import path from "path";
import { PageInfo, SupportedLibraryType } from "./types";
import { db } from "@/db";
import { downloadJobs } from "@/db/schema";
import { eq } from "drizzle-orm";

const STORAGE_DIR =
  process.env.DOWNLOAD_STORAGE_DIR || path.join(process.cwd(), ".data", "downloads");

// Ensure storage directory exists
if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

import { parsePageRange, sanitizeFileName } from "./page-utils";
import { fetchDokumenPdf, isDokumenUrl, normalizeDokumenPageUrl } from "./dokumen";
export { parsePageRange, sanitizeFileName };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function fetchImageBuffer(url: string, referer?: string, retries = 3): Promise<Buffer> {
  let lastErr: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          Referer: referer || "https://www.prlib.ru/",
        },
        signal: AbortSignal.timeout(20000),
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const arrayBuf = await res.arrayBuffer();
      return Buffer.from(arrayBuf);
    } catch (e: unknown) {
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  throw lastErr || new Error("Failed to fetch image");
}

export interface ProcessJobParams {
  jobId: string;
  url: string;
  libraryType: SupportedLibraryType;
  title: string;
  pages: PageInfo[];
  pageRangeStr?: string;
  quality: "original" | "hd" | "mobile";
  format: "pdf" | "zip";
  directPdfUrl?: string;
}

async function fetchDirectPdf(
  directPdfUrl: string,
  url: string,
  libraryType: SupportedLibraryType
): Promise<Buffer> {
  if (libraryType === "dokumen" || isDokumenUrl(directPdfUrl) || isDokumenUrl(url)) {
    return fetchDokumenPdf(directPdfUrl, normalizeDokumenPageUrl(url));
  }

  const res = await fetch(directPdfUrl, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: url,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to download direct PDF: HTTP ${res.status}`);
  }

  return Buffer.from(await res.arrayBuffer());
}

export async function processDownloadJob(params: ProcessJobParams): Promise<void> {
  const { jobId, url, title, pages, pageRangeStr, quality, format, directPdfUrl } = params;

  try {
    await db
      .update(downloadJobs)
      .set({
        status: "processing",
        progressPercent: 5,
        updatedAt: new Date(),
      })
      .where(eq(downloadJobs.id, jobId));

    const safeTitle = sanitizeFileName(title);
    const targetPagesIndices = parsePageRange(pageRangeStr, pages.length);
    const pagesToFetch = pages.filter((p) => targetPagesIndices.includes(p.index));
    const totalToDownload = pagesToFetch.length;

    await db
      .update(downloadJobs)
      .set({
        totalDownloadPages: totalToDownload,
        pagesToDownload: targetPagesIndices,
      })
      .where(eq(downloadJobs.id, jobId));

    // Case 1: Direct single PDF provided by source (e.g. Unatlib, Gwar, dokumen.pub)
    if (directPdfUrl) {
      const fileName = `${safeTitle}.pdf`;
      const finalPath = path.join(STORAGE_DIR, `${jobId}_${fileName}`);

      const buffer = await fetchDirectPdf(directPdfUrl, url, params.libraryType);
      fs.writeFileSync(finalPath, buffer);

      await db
        .update(downloadJobs)
        .set({
          status: "completed",
          progressPercent: 100,
          currentPage: 1,
          totalDownloadPages: 1,
          filePath: finalPath,
          fileName,
          fileSize: buffer.length,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(downloadJobs.id, jobId));

      return;
    }

    // Case 2: Fetch individual page scans with controlled concurrency
    const downloadedImages: Array<{ index: number; buffer: Buffer; label: string }> = [];
    const concurrency = 4;
    let completedCount = 0;

    for (let i = 0; i < pagesToFetch.length; i += concurrency) {
      const chunk = pagesToFetch.slice(i, i + concurrency);
      const promises = chunk.map(async (page) => {
        let pageImgUrl = page.hdUrl;
        if (quality === "original") pageImgUrl = page.originalUrl;
        if (quality === "mobile") pageImgUrl = page.mobileUrl;

        const buffer = await fetchImageBuffer(pageImgUrl, url);
        return {
          index: page.index,
          label: page.label,
          buffer,
        };
      });

      const results = await Promise.all(promises);
      downloadedImages.push(...results);
      completedCount += results.length;

      // Update progress in database (up to 85% for downloading, 15% for assembly)
      const percent = Math.min(85, Math.round(5 + (completedCount / totalToDownload) * 80));
      await db
        .update(downloadJobs)
        .set({
          progressPercent: percent,
          currentPage: completedCount,
          updatedAt: new Date(),
        })
        .where(eq(downloadJobs.id, jobId));
    }

    // Sort downloaded images in natural page order
    downloadedImages.sort((a, b) => a.index - b.index);

    let finalFileName = "";
    let finalFilePath = "";
    let finalFileSize = 0;

    if (format === "pdf") {
      // Assemble PDF using pdf-lib
      await db
        .update(downloadJobs)
        .set({ progressPercent: 90, updatedAt: new Date() })
        .where(eq(downloadJobs.id, jobId));

      const pdfDoc = await PDFDocument.create();
      pdfDoc.setTitle(title);
      pdfDoc.setProducer("ELIB Downloader (Web for Android)");
      pdfDoc.setCreator("ELIB Web App");

      for (let i = 0; i < downloadedImages.length; i++) {
        const item = downloadedImages[i];
        try {
          // Check if buffer is PNG or JPEG
          const isPng =
            item.buffer[0] === 0x89 &&
            item.buffer[1] === 0x50 &&
            item.buffer[2] === 0x4e &&
            item.buffer[3] === 0x47;

          const embeddedImage = isPng
            ? await pdfDoc.embedPng(item.buffer)
            : await pdfDoc.embedJpg(item.buffer);

          const { width, height } = embeddedImage.scale(1.0);
          const page = pdfDoc.addPage([width, height]);
          page.drawImage(embeddedImage, {
            x: 0,
            y: 0,
            width,
            height,
          });
        } catch (embedErr) {
          console.warn(`Failed to embed page ${item.index}:`, embedErr);
        }
      }

      const pdfBytes = await pdfDoc.save();
      finalFileName = `${safeTitle}.pdf`;
      finalFilePath = path.join(STORAGE_DIR, `${jobId}_${finalFileName}`);
      fs.writeFileSync(finalFilePath, Buffer.from(pdfBytes));
      finalFileSize = pdfBytes.length;
    } else {
      // Assemble ZIP using JSZip
      await db
        .update(downloadJobs)
        .set({ progressPercent: 90, updatedAt: new Date() })
        .where(eq(downloadJobs.id, jobId));

      const zip = new JSZip();
      const folder = zip.folder(safeTitle) || zip;

      // Add readme
      folder.file(
        "info.txt",
        `Название: ${title}\nИсточник: ${url}\nСтраниц скачано: ${downloadedImages.length}\nКачество: ${quality}\nДата: ${new Date().toLocaleString(
          "ru-RU"
        )}\n`
      );

      const padLen = String(totalToDownload).length > 2 ? String(totalToDownload).length : 3;

      for (const item of downloadedImages) {
        const pageNum = String(item.index).padStart(padLen, "0");
        const isPng =
          item.buffer[0] === 0x89 &&
          item.buffer[1] === 0x50 &&
          item.buffer[2] === 0x4e &&
          item.buffer[3] === 0x47;
        const ext = isPng ? "png" : "jpg";
        folder.file(`page_${pageNum}.${ext}`, item.buffer);
      }

      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      finalFileName = `${safeTitle}.zip`;
      finalFilePath = path.join(STORAGE_DIR, `${jobId}_${finalFileName}`);
      fs.writeFileSync(finalFilePath, zipBuffer);
      finalFileSize = zipBuffer.length;
    }

    // Mark job completed!
    await db
      .update(downloadJobs)
      .set({
        status: "completed",
        progressPercent: 100,
        currentPage: totalToDownload,
        filePath: finalFilePath,
        fileName: finalFileName,
        fileSize: finalFileSize,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(downloadJobs.id, jobId));
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Download job ${jobId} failed:`, err);
    await db
      .update(downloadJobs)
      .set({
        status: "failed",
        errorMessage: errorMsg,
        updatedAt: new Date(),
      })
      .where(eq(downloadJobs.id, jobId));
  }
}

export function getStorageFilePath(jobId: string, fileName?: string): string | null {
  if (fileName) {
    const p = path.join(STORAGE_DIR, `${jobId}_${fileName}`);
    if (fs.existsSync(p)) return p;
  }
  // Search for any file starting with jobId_
  const files = fs.readdirSync(STORAGE_DIR);
  const match = files.find((f) => f.startsWith(`${jobId}_`));
  if (match) {
    return path.join(STORAGE_DIR, match);
  }
  return null;
}
