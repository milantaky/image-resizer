import type { Metadata } from "next";
import UploadSection from "./components/UploadSection";
import Gallery from "./components/Gallery";

export const metadata: Metadata = {
  title: "AsyncResizer — Cloud Computing HW3",
  description: "Asynchronous image resizing via Azure Queue + Functions",
};

export default function Home() {
  return (
    <main>
      <header>
        <div className="header-inner">
          <span className="logo">⚡ AsyncResizer</span>
          <span className="subtitle">Azure Queue + Functions demo</span>
        </div>
      </header>

      <section className="hero">
        <h1>Asynchronous<br />Image Processing</h1>
        <p className="hero-desc">
          Upload an image → message queued → Azure Function resizes it asynchronously
        </p>
        <div className="arch-badges">
          <span className="badge">Next.js</span>
          <span className="arrow">→</span>
          <span className="badge highlight">Azure Queue Storage</span>
          <span className="arrow">→</span>
          <span className="badge">Azure Function</span>
          <span className="arrow">→</span>
          <span className="badge">Blob Storage</span>
        </div>
      </section>

      <section className="upload-section">
        <UploadSection />
      </section>

      <section className="gallery-section">
        <Gallery />
      </section>
    </main>
  );
}
