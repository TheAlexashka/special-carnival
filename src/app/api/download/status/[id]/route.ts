import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { downloadJobs } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return NextResponse.json({ success: false, error: "Missing ID" }, { status: 400 });
    }

    const [job] = await db.select().from(downloadJobs).where(eq(downloadJobs.id, id));

    if (!job) {
      return NextResponse.json({ success: false, error: "Задание не найдено" }, { status: 404 });
    }

    const fileUrl = job.status === "completed" ? `/api/download/file/${job.id}` : null;

    return NextResponse.json({
      success: true,
      job: {
        jobId: job.id,
        url: job.url,
        status: job.status,
        progressPercent: job.progressPercent,
        currentPage: job.currentPage,
        totalPages: job.totalDownloadPages || job.totalPages,
        title: job.title,
        libraryName: job.libraryName,
        coverUrl: job.coverUrl,
        format: job.format,
        quality: job.quality,
        fileName: job.fileName,
        fileSize: job.fileSize,
        fileUrl,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt.toISOString(),
        completedAt: job.completedAt?.toISOString(),
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Error fetching job status:", error);
    return NextResponse.json({ success: false, error }, { status: 500 });
  }
}
