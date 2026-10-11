import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { downloadJobs } from "@/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import { getStorageFilePath } from "@/lib/downloader";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    if (!id) {
      return new NextResponse("Invalid ID", { status: 400 });
    }

    const [job] = await db.select().from(downloadJobs).where(eq(downloadJobs.id, id));

    if (!job) {
      return new NextResponse("Задание не найдено", { status: 404 });
    }

    if (job.status !== "completed") {
      return new NextResponse(`Файл еще подготавливается (статус: ${job.status})`, { status: 400 });
    }

    const filePath = job.filePath || getStorageFilePath(job.id, job.fileName || undefined);

    if (!filePath || !fs.existsSync(filePath)) {
      return new NextResponse("Файл не найден на сервере (возможно, истек срок хранения)", { status: 404 });
    }

    const stat = fs.statSync(filePath);
    const fileStream = fs.createReadStream(filePath);
    const contentType = job.format === "zip" ? "application/zip" : "application/pdf";
    const rawFileName = job.fileName || `book_${job.id}.${job.format === "zip" ? "zip" : "pdf"}`;
    const encodedFileName = encodeURIComponent(rawFileName);

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(new Uint8Array(chunk as Buffer)));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new NextResponse(readable, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": stat.size.toString(),
        "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("Error serving file:", error);
    return new NextResponse(`Server error: ${error}`, { status: 500 });
  }
}
