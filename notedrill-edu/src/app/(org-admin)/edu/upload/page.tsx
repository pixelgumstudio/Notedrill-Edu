"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UploadZone from "@/components/edu/UploadZone";
import FileCard from "@/components/edu/FileCard";
import SectionEyebrow from "@/components/edu/SectionEyebrow";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type { OrgNoteSummary } from "@/types/edu";

type SourceType = "pdf" | "text" | "youtube" | "image";

function formatNoteSubtitle(note: OrgNoteSummary): string {
  const uploaded = new Date(note.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const parts = [`Uploaded ${uploaded}`];
  parts.push(note.status === "ready" ? "Summary generated" : "Processing…");
  return parts.join(" · ");
}

export default function UploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgToken } = useAuth();

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Recent notes list ────────────────────────────────────────────────────────
  const { data, isLoading: notesLoading } = useQuery<{ items: OrgNoteSummary[] }>({
    queryKey: ["org-notes"],
    queryFn: () => orgApi.getNotes(orgToken ?? "", { limit: 20 }),
    enabled: !!orgToken,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // ── Upload + generate mutation ───────────────────────────────────────────────
  // POST /org/files responds synchronously once the AI summary is ready — no
  // background job/polling on this backend.
  const uploadMutation = useMutation({
    mutationFn: (payload: { source: SourceType; title: string; file: File | null; text?: string }) =>
      orgApi.uploadContent(orgToken ?? "", payload),
    onSuccess: (note) => {
      showToast("Note created successfully!");
      queryClient.invalidateQueries({ queryKey: ["org-notes"] });
      router.push(`/edu/upload/${note.id}`);
    },
    onError: (err: Error) => {
      showToast(err.message || "Upload failed. Please try again.");
    },
  });

  const handleUpload = (file: File | null, source: SourceType, title: string, text?: string) => {
    if (!title.trim()) {
      showToast("Please enter a title.");
      return;
    }
    if ((source === "pdf" || source === "image") && !file) {
      showToast("Please select a file first.");
      return;
    }
    const SUPPORTED_DOC_TYPES = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (source === "pdf" && file && !SUPPORTED_DOC_TYPES.includes(file.type)) {
      showToast("Unsupported file type. Please upload a PDF, DOC, or DOCX file.");
      return;
    }
    if ((source === "text" || source === "youtube") && !text?.trim()) {
      showToast(source === "youtube" ? "Please enter a YouTube URL." : "Please enter some text content.");
      return;
    }
    uploadMutation.mutate({ source, title: title.trim(), file, text });
  };

  const recentNotes = data?.items ?? [];

  return (
    <>
      {/* Page top bar */}
      <div className="border-b border-edu-line bg-white px-6 py-5 md:px-8">
        <SectionEyebrow className="mb-1">The solution</SectionEyebrow>
        <h1 className="font-source-serif text-[22px] text-edu-moss-dark">Files &amp; content</h1>
        <p className="mt-0.5 text-sm text-edu-blue-grey">
          Upload material once — every student in your school can practice with it
        </p>
      </div>

      <div className="px-6 py-6 md:px-8">
        {/* Upload zone + loading overlay */}
        <div className="relative">
          <UploadZone onUpload={handleUpload} />
          {uploadMutation.isPending && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/80 backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-edu-moss border-t-transparent" />
              <p className="text-sm font-semibold text-edu-moss-dark">Generating summary — this can take up to a minute…</p>
            </div>
          )}
        </div>

        <h3 className="mb-3.5 mt-7 font-source-serif text-[15.5px] text-edu-moss-dark">
          Recently uploaded
        </h3>

        {notesLoading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-edu-line" />
            ))}
          </div>
        ) : recentNotes.length === 0 ? (
          <p className="py-6 text-center text-sm text-edu-blue-grey">
            No files yet. Upload your first piece of content above.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5">
            {recentNotes.map((note) => (
              <FileCard
                key={note.id}
                title={note.title}
                type={note.sourceType === "audio" ? "pdf" : note.sourceType}
                subtitle={formatNoteSubtitle(note)}
                visible
                onClick={() => router.push(`/edu/upload/${note.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[2000] flex items-center gap-2.5 rounded-xl bg-edu-moss-dark px-5 py-3.5 text-sm font-semibold text-white"
          style={{ boxShadow: "0 8px 24px rgba(0,0,0,0.25)" }}
        >
          {toast}
        </div>
      )}
    </>
  );
}
