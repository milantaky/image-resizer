"use client";

import { useState, useRef, DragEvent } from "react";

type UploadState =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "success"; originalUrl: string; blobName: string }
  | { type: "error"; message: string };

export default function UploadSection() {
  const [file, setFile] = useState<File | null>(null);
  const [state, setState] = useState<UploadState>({ type: "idle" });
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setState({ type: "idle" });
    setFile(f);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }

  async function handleUpload() {
    if (!file) return;
    setState({ type: "loading" });

    const fd = new FormData();
    fd.append("image", file);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setState({ type: "success", originalUrl: data.originalUrl, blobName: data.blobName });
      setFile(null);
      // Trigger gallery refresh via custom event
      window.dispatchEvent(new Event("gallery-refresh"));
    } catch (err: unknown) {
      setState({ type: "error", message: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return (
    <div className="upload-card">
      <div className="upload-card-title">// upload image</div>

      <div
        className={`dropzone${dragOver ? " drag-over" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <span className="dropzone-icon">🖼️</span>
        <h2>{file ? file.name : "Drop image here"}</h2>
        <p>{file ? `${(file.size / 1024).toFixed(0)} KB · click to change` : "or click to browse · JPEG, PNG, WebP · max 10 MB"}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {state.type === "loading" && (
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: "60%" }} />
        </div>
      )}

      {state.type === "success" && (
        <div className="status success">
          <span>✓</span> Uploaded &amp; queued for processing —{" "}
          <a href={state.originalUrl} target="_blank" rel="noreferrer" style={{ color: "inherit" }}>
            view original
          </a>
        </div>
      )}
      {state.type === "error" && (
        <div className="status error"><span>✗</span> {state.message}</div>
      )}
      {state.type === "loading" && (
        <div className="status loading"><span className="spinner" /> Uploading…</div>
      )}

      <div className="upload-footer">
        {file && <span className="selected-file">{file.name}</span>}
        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!file || state.type === "loading"}
          style={{ marginLeft: "auto" }}
        >
          {state.type === "loading" ? "Uploading…" : "Upload & Queue"}
        </button>
      </div>
    </div>
  );
}
