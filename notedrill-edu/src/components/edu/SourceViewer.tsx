import React from "react";
import EmptyState from "./EmptyState";
import { BASE_URL } from "@/lib/api-fetch";

/** Shape shared by OrgNoteDetail and StudentNoteDetail. */
export interface SourceViewerNote {
  title: string;
  sourceType?: string;
  sourceUrl?: string;
  sourceMimeType?: string;
}

function resolveYouTubeId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return match?.[1] ?? null;
}

function resolveUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.startsWith("http://") || url.startsWith("https://") ? url : `${BASE_URL}${url}`;
}

/** Renders the original uploaded/linked source (YouTube embed, PDF, or image). */
export default function SourceViewer({ note }: { note: SourceViewerNote }) {
  const srcType = note.sourceType;
  const url = resolveUrl(note.sourceUrl);

  if (srcType === "youtube") {
    const videoId = url ? resolveYouTubeId(url) : null;
    if (videoId) {
      return (
        <div className="overflow-hidden rounded-xl border border-edu-line" style={{ aspectRatio: "16/9" }}>
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title={note.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    return (
      <EmptyState
        mark="Y"
        heading="Video not available"
        body="The original YouTube video URL was not preserved. The AI-generated notes are still available in another tab."
      />
    );
  }

  if (srcType === "pdf") {
    if (url) {
      return (
        <div className="overflow-hidden rounded-xl border border-edu-line" style={{ height: "72vh" }}>
          <iframe className="h-full w-full" src={url} title={note.title} />
        </div>
      );
    }
    return (
      <EmptyState
        mark="P"
        heading="File not available"
        body="The source file could not be loaded. The AI-generated notes are still accessible in another tab."
      />
    );
  }

  if (srcType === "image") {
    if (url) {
      return (
        <div className="overflow-hidden rounded-xl border border-edu-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={note.title} className="mx-auto max-h-[70vh] object-contain" />
        </div>
      );
    }
    return <EmptyState mark="I" heading="Image not available" body="The source image could not be loaded." />;
  }

  return <EmptyState mark="T" heading="No source preview" body="This file type doesn't have an original-source preview." />;
}
