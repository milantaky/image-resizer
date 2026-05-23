import { app, InvocationContext } from "@azure/functions";
import { BlobServiceClient } from "@azure/storage-blob";
import sharp from "sharp";

// Message schema sent by the web app
interface ResizeJobMessage {
  jobId: string;
  blobName: string;
  originalUrl: string;
  uploadedAt: string;
  targetWidths: number[];
}

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const CONTAINER_ORIGINALS = process.env.AZURE_BLOB_CONTAINER_ORIGINALS ?? "originals";
const CONTAINER_THUMBNAILS = process.env.AZURE_BLOB_CONTAINER_THUMBNAILS ?? "thumbnails";
const QUEUE_NAME = process.env.AZURE_QUEUE_NAME ?? "resize-jobs";

app.storageQueue("resizeImage", {
  queueName: QUEUE_NAME,
  connection: "AZURE_STORAGE_CONNECTION_STRING",
  handler: resizeImage,
});

async function resizeImage(queueItem: unknown, context: InvocationContext): Promise<void> {
  context.log("resizeImage triggered, raw message:", queueItem);

  // Azure Functions SDK v4 automatically base64-decodes queue messages
  let job: ResizeJobMessage;
  try {
    const raw = typeof queueItem === "string" ? queueItem : JSON.stringify(queueItem);
    job = JSON.parse(raw) as ResizeJobMessage;
  } catch (err) {
    context.error("Failed to parse queue message:", err);
    return; // Poison message – let Azure move it to the poison queue after 5 retries
  }

  context.log(`Processing job ${job.jobId} for blob ${job.blobName}`);

  const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
  const originalsContainer = blobServiceClient.getContainerClient(CONTAINER_ORIGINALS);
  const thumbsContainer = blobServiceClient.getContainerClient(CONTAINER_THUMBNAILS);
  await thumbsContainer.createIfNotExists({ access: "blob" });

  // Download original image
  const originalBlob = originalsContainer.getBlobClient(job.blobName);
  const downloadResponse = await originalBlob.download();
  if (!downloadResponse.readableStreamBody) {
    throw new Error(`Could not download blob: ${job.blobName}`);
  }

  const originalBuffer = await streamToBuffer(downloadResponse.readableStreamBody);
  context.log(`Downloaded original: ${originalBuffer.length} bytes`);

  // Get image metadata once
  const metadata = await sharp(originalBuffer).metadata();
  const originalWidth = metadata.width ?? 0;

  const widths = job.targetWidths ?? [800, 400, 200];

  // Resize to each target width in parallel
  await Promise.all(
    widths.map(async (width) => {
      // Skip if target is larger than original
      if (width > originalWidth) {
        context.log(`Skipping ${width}w (original is ${originalWidth}px wide)`);
        return;
      }

      const baseName = job.blobName.replace(/\.[^.]+$/, "");
      const thumbName = `${baseName}_${width}w.webp`;

      const resized = await sharp(originalBuffer)
        .resize({ width, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();

      const thumbBlob = thumbsContainer.getBlockBlobClient(thumbName);
      await thumbBlob.uploadData(resized, {
        blobHTTPHeaders: { blobContentType: "image/webp" },
      });

      context.log(`Created thumbnail: ${thumbName} (${resized.length} bytes)`);
    })
  );

  context.log(`Job ${job.jobId} completed – ${widths.length} thumbnails processed`);
}

function streamToBuffer(readable: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    readable.on("data", (chunk: Buffer) => chunks.push(chunk));
    readable.on("end", () => resolve(Buffer.concat(chunks)));
    readable.on("error", reject);
  });
}
