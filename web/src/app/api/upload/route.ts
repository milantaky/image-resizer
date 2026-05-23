import { NextRequest, NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";
import { QueueServiceClient } from "@azure/storage-queue";
import { randomUUID } from "crypto";

export const dynamic = "force-dynamic";

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const CONTAINER_ORIGINALS =
  process.env.AZURE_BLOB_CONTAINER_ORIGINALS ?? "originals";
const QUEUE_NAME = process.env.AZURE_QUEUE_NAME ?? "resize-jobs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("image") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG and WebP are supported" },
      { status: 400 },
    );
  }

  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop() ?? "jpg";
  const blobName = `${randomUUID()}.${ext}`;

  // 1. Upload original to Blob Storage
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(CONNECTION_STRING);
  const containerClient =
    blobServiceClient.getContainerClient(CONTAINER_ORIGINALS);
  await containerClient.createIfNotExists({ access: "blob" });

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  const buffer = Buffer.from(await file.arrayBuffer());
  await blockBlobClient.uploadData(buffer, {
    blobHTTPHeaders: { blobContentType: file.type },
  });

  // 2. Enqueue resize job message
  const queueServiceClient =
    QueueServiceClient.fromConnectionString(CONNECTION_STRING);
  const queueClient = queueServiceClient.getQueueClient(QUEUE_NAME);
  await queueClient.createIfNotExists();

  const message = {
    jobId: randomUUID(),
    blobName,
    originalUrl: blockBlobClient.url,
    uploadedAt: new Date().toISOString(),
    targetWidths: [800, 400, 200],
  };

  // Azure Queue requires base64-encoded messages
  const encoded = Buffer.from(JSON.stringify(message)).toString("base64");
  await queueClient.sendMessage(encoded);

  return NextResponse.json({
    success: true,
    blobName,
    originalUrl: blockBlobClient.url,
    message: "Image uploaded. Thumbnails are being generated...",
  });
}
