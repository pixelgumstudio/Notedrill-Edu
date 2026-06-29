"use client";

import React, { useState, useRef } from "react";

type SourceTab = "pdf" | "text" | "youtube" | "image";

interface UploadZoneProps {
  onUpload?: (file: File | null, source: SourceTab, text?: string) => void;
}

const sourceTabs: { id: SourceTab; label: string; icon: string }[] = [
  { id: "pdf", label: "PDF / Document", icon: "📄" },
  { id: "text", label: "Text", icon: "✎" },
  { id: "youtube", label: "YouTube link", icon: "▶" },
  { id: "image", label: "Image", icon: "🖼" },
];

export default function UploadZone({ onUpload }: UploadZoneProps) {
  const [activeSource, setActiveSource] = useState<SourceTab>("pdf");
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [textContent, setTextContent] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0] ?? null;
    if (file) setSelectedFile(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFile(e.target.files?.[0] ?? null);
  };

  const handleSubmit = () => {
    onUpload?.(selectedFile, activeSource, textContent || youtubeUrl);
  };

  return (
    <div
      className={`rounded-xl border-2 border-dashed p-9 text-center transition-colors ${
        isDragging ? "border-edu-moss bg-edu-moss-light" : "border-edu-line bg-edu-paper-2"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Source selector tabs */}
      <div className="mb-5 flex flex-wrap justify-center gap-2">
        {sourceTabs.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setActiveSource(id)}
            className={`flex items-center gap-1.5 rounded-lg border-[1.5px] px-4 py-2 text-[12.5px] font-bold transition-colors ${
              activeSource === id
                ? "border-edu-moss bg-edu-moss-light text-edu-moss-dark"
                : "border-edu-line bg-white text-edu-blue-grey hover:border-edu-moss hover:text-edu-moss-dark"
            }`}
          >
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Upload area */}
      {(activeSource === "pdf" || activeSource === "image") && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept={activeSource === "pdf" ? ".pdf,.doc,.docx" : "image/*"}
            onChange={handleFileSelect}
          />
          <div className="mb-2.5 text-3xl">⇪</div>
          <h4 className="mb-1.5 text-[15px] font-semibold text-edu-moss-dark">
            {selectedFile
              ? selectedFile.name
              : activeSource === "pdf"
              ? "Drag a PDF here, or click to browse"
              : "Drag an image here, or click to browse"}
          </h4>
          <p className="mb-4 text-sm text-edu-blue-grey">
            Lesson notes, past questions, textbook chapters — anything you want your students practicing on.
          </p>
          <button
            className="rounded-lg border border-edu-line bg-white px-5 py-2.5 text-sm font-semibold text-edu-moss-dark transition-colors hover:bg-edu-moss-light"
            onClick={() => fileInputRef.current?.click()}
          >
            Browse files
          </button>
        </>
      )}

      {activeSource === "text" && (
        <div className="text-left">
          <label className="mb-2 block text-sm font-semibold text-edu-ink">Paste or type your text</label>
          <textarea
            rows={6}
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            placeholder="Paste your lesson notes, exam text, or any content here…"
            className="w-full rounded-lg border-[1.5px] border-edu-line bg-white p-3 text-sm text-edu-ink focus:border-edu-moss focus:outline-none"
          />
        </div>
      )}

      {activeSource === "youtube" && (
        <div className="text-left">
          <label className="mb-2 block text-sm font-semibold text-edu-ink">YouTube video URL</label>
          <input
            type="url"
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            className="w-full rounded-lg border-[1.5px] border-edu-line bg-white p-3 text-sm text-edu-ink focus:border-edu-moss focus:outline-none"
          />
          <p className="mt-2 text-xs text-edu-blue-grey">
            We'll extract the transcript and generate study material from the video.
          </p>
        </div>
      )}

      {/* CTA button */}
      <button
        className="mt-5 rounded-lg bg-edu-moss px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-edu-moss-dark"
        onClick={handleSubmit}
      >
        Upload &amp; generate summary
      </button>
    </div>
  );
}
