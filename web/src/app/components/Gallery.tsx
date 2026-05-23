"use client";

import { useState, useEffect, useCallback } from "react";

interface Thumbnail {
  name: string;
  url: string;
  width: number;
}
interface GalleryItem {
  name: string;
  originalUrl: string;
  thumbnails: Thumbnail[];
}

export default function Gallery() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchGallery = useCallback(async () => {
    try {
      const res = await fetch("/api/gallery");
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      // silently fail on poll
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGallery();
    // Poll every 5s so thumbnails appear as Function finishes
    const interval = setInterval(fetchGallery, 5000);
    // Also refresh immediately after upload
    window.addEventListener("gallery-refresh", fetchGallery);
    return () => {
      clearInterval(interval);
      window.removeEventListener("gallery-refresh", fetchGallery);
    };
  }, [fetchGallery]);

  return (
    <div>
      <div className="gallery-header">
        <h2>Processed Images</h2>
        <button className="btn btn-ghost" onClick={fetchGallery}>↻ Refresh</button>
      </div>

      {loading ? (
        <div className="gallery-empty">
          <span className="spinner" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="gallery-empty">
          No images yet. Upload one above.
        </div>
      ) : (
        <div className="gallery-grid">
          {items.map((item) => (
            <div key={item.name} className="gallery-item">
              <div className="gallery-item-image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.originalUrl} alt={item.name} loading="lazy" />
              </div>
              <div className="gallery-item-info">
                <div className="gallery-item-name">{item.name}</div>
                <div className="thumb-list">
                  {item.thumbnails.length > 0 ? (
                    item.thumbnails.map((t) => (
                      <a key={t.name} href={t.url} target="_blank" rel="noreferrer" className="thumb-badge">
                        {t.width}w
                      </a>
                    ))
                  ) : (
                    <span className="thumb-pending">
                      <span className="spinner" /> generating thumbnails…
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
