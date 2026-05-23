import { NextResponse } from "next/server";
import { BlobServiceClient } from "@azure/storage-blob";

export const dynamic = "force-dynamic";

const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING!;
const CONTAINER_ORIGINALS =
  process.env.AZURE_BLOB_CONTAINER_ORIGINALS ?? "originals";
const CONTAINER_THUMBNAILS =
  process.env.AZURE_BLOB_CONTAINER_THUMBNAILS ?? "thumbnails";

export async function GET() {
  const blobServiceClient =
    BlobServiceClient.fromConnectionString(CONNECTION_STRING);

  const originalsContainer =
    blobServiceClient.getContainerClient(CONTAINER_ORIGINALS);
  const thumbsContainer =
    blobServiceClient.getContainerClient(CONTAINER_THUMBNAILS);

  // List all originals
  const originals: string[] = [];
  for await (const blob of originalsContainer.listBlobsFlat()) {
    originals.push(blob.name);
  }

  // List all thumbnails
  const thumbnails: string[] = [];
  for await (const blob of thumbsContainer.listBlobsFlat()) {
    thumbnails.push(blob.name);
  }

  const items = originals.map((name) => {
    const baseName = name.replace(/\.[^.]+$/, "");
    const thumbs = thumbnails
      .filter((t) => t.startsWith(baseName))
      .map((t) => ({
        name: t,
        url: `${thumbsContainer.url}/${t}`,
        width: parseInt(t.match(/_(\d+)w\./)?.[1] ?? "0"),
      }))
      .sort((a, b) => b.width - a.width);

    return {
      name,
      originalUrl: `${originalsContainer.url}/${name}`,
      thumbnails: thumbs,
    };
  });

  // Newest first (UUID-based names won't sort by time, but this is fine for demo)
  return NextResponse.json({ items: items.reverse() });
}
