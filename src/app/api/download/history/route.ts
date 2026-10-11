import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { downloadJobs } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import fs from "fs";

export async function GET() {
  try {
    const list = await db
      .select()
      .from(downloadJobs)
      .orderBy(desc(downloadJobs.createdAt))
      .limit(50);

    const formatted = list.map((job) => {
      let fileExists = false;
      if (job.filePath) {
        try {
          fileExists = fs.existsSync(job.filePath);
        } catch {
          fileExists = false;
        }
      }
      if (!fileExists && job.status === "completed") {
        fileExists = true;
      }

      return {
        jobId: job.id,
        url: job.url,
        title: job.title,
        libraryType: job.libraryType,
        libraryName: job.libraryName,
        coverUrl: job.coverUrl,
        totalPages: job.totalDownloadPages || job.totalPages,
        totalDownloadPages: job.totalDownloadPages,
        pageRange: job.pageRange,
        quality: job.quality,
        format: job.format,
        status: job.status,
        progressPercent: job.progressPercent,
        currentPage: job.currentPage,
        fileName: job.fileName,
        fileSize: job.fileSize,
        fileExists,
        fileUrl: job.status === "completed" ? `/api/download/file/${job.id}` : null,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString() || null,
      };
    });

    return NextResponse.json({ success: true, history: formatted });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Error fetching history:", error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (id) {
      const [job] = await db.select().from(downloadJobs).where(eq(downloadJobs.id, id));
      if (job?.filePath && fs.existsSync(job.filePath)) {
        try {
          fs.unlinkSync(job.filePath);
        } catch (e) {
          console.warn("Failed to delete physical file:", e);
        }
      }
      await db.delete(downloadJobs).where(eq(downloadJobs.id, id));
      return NextResponse.json({ success: true, message: "Запись удалена" });
    }

    const all = await db.select().from(downloadJobs);
    for (const job of all) {
      if (job.filePath && fs.existsSync(job.filePath)) {
        try {
          fs.unlinkSync(job.filePath);
        } catch {
          // ignore cleanup errors
        }
      }
    }
    await db.delete(downloadJobs);
    return NextResponse.json({ success: true, message: "История очищена" });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
