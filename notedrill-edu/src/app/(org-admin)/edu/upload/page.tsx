"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import UploadZone from "@/components/edu/UploadZone";
import FileCard from "@/components/edu/FileCard";
import SectionEyebrow from "@/components/edu/SectionEyebrow";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type { NoteDetail } from "@/types/edu";

type SourceType = "pdf" | "text" | "youtube" | "image";

function formatNoteSubtitle(note: NoteDetail): string {
  const uploaded = new Date(note.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const parts = [`Uploaded ${uploaded}`];
  if (note.summary) parts.push("Summary generated");
  if (note.quizCount) parts.push(`${note.quizCount} quiz attempt${note.quizCount !== 1 ? "s" : ""}`);
  if (note.flashcardCount) parts.push(`${note.flashcardCount} flashcard session${note.flashcardCount !== 1 ? "s" : ""}`);
  return parts.join(" · ");
}

export default function UploadPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgToken } = useAuth();

  const [toast, setToast] = useState<string | null>(null);
  // jobId set when the backend returns 202 — drives the polling screen
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);
  // Simulated progress 0–100 shown in the progress bar
  const [processingProgress, setProcessingProgress] = useState(5);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Recent notes list ────────────────────────────────────────────────────────
  const { data: notes, isLoading: notesLoading } = useQuery<NoteDetail[]>({
    queryKey: ["org-notes"],
    queryFn: () => orgApi.getNotes(orgToken ?? ""),
    enabled: !!orgToken,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });

  // ── Job status polling ───────────────────────────────────────────────────────
  // Fires every 2 s while a job is pending; stops automatically once done/failed.
  const { data: jobStatus } = useQuery({
    queryKey: ["note-job", pendingJobId],
    queryFn: () => orgApi.getJobStatus(orgToken ?? "", pendingJobId!),
    enabled: !!orgToken && !!pendingJobId,
    staleTime: 0,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "completed" || s === "failed" ? false : 2000;
    },
  });

  // ── Simulate progress bar while waiting ─────────────────────────────────────
  // Creeps from 5% → 85% while polling; jumps to 100% on completion.
  useEffect(() => {
    if (!pendingJobId) {
      setProcessingProgress(5);
      return;
    }
    const id = setInterval(() => {
      setProcessingProgress((p) => {
        if (p >= 85) {
          clearInterval(id);
          return p;
        }
        return Math.min(85, p + Math.random() * 4);
      });
    }, 1400);
    return () => clearInterval(id);
  }, [pendingJobId]);

  // ── React to job completion / failure ────────────────────────────────────────
  useEffect(() => {
    if (!jobStatus) return;

    if (jobStatus.status === "completed" && jobStatus.result?._id) {
      setProcessingProgress(100);
      // Bust the notes list cache so the new note appears immediately
      queryClient.invalidateQueries({ queryKey: ["org-notes"] });
      const noteId = jobStatus.result._id;
      const t = setTimeout(() => {
        router.push(`/edu/upload/${noteId}`);
      }, 350);
      return () => clearTimeout(t);
    }

    if (jobStatus.status === "failed") {
      showToast(jobStatus.error ?? "Note generation failed. Please try again.");
      setPendingJobId(null);
    }
  }, [jobStatus, queryClient, router]);

  // ── Upload + generate mutation ───────────────────────────────────────────────
  const uploadMutation = useMutation({
    mutationFn: (payload: { source: SourceType; file: File | null; text?: string }) =>
      orgApi.uploadContent(orgToken ?? "", payload),
    onSuccess: (result) => {
      if ("_id" in result && result._id) {
        // Text source — note created synchronously
        showToast("Note created successfully!");
        queryClient.invalidateQueries({ queryKey: ["org-notes"] });
        router.push(`/edu/upload/${result._id}`);
      } else if ("jobId" in result && result.jobId) {
        // PDF / image / YouTube — generation running in background
        setPendingJobId(result.jobId);
      } else {
        showToast("Upload started — your note is being generated in the background.");
      }
    },
    onError: (err: Error) => {
      showToast(err.message || "Upload failed. Please try again.");
    },
  });

  const handleUpload = (file: File | null, source: SourceType, text?: string) => {
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
    uploadMutation.mutate({ source, file, text });
  };

  const recentNotes = notes ?? [];

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
        {pendingJobId ? (
          /* ── Processing screen ── */
          <ProcessingScreen progress={processingProgress} />
        ) : (
          <>
            {/* Upload zone + loading overlay */}
            <div className="relative">
              <UploadZone onUpload={handleUpload} />
              {uploadMutation.isPending && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-xl bg-white/80 backdrop-blur-sm">
                  <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-edu-moss border-t-transparent" />
                  <p className="text-sm font-semibold text-edu-moss-dark">Uploading…</p>
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
                {recentNotes.slice(0, 8).map((note) => (
                  <FileCard
                    key={note._id}
                    title={note.title}
                    type={note.type}
                    subtitle={formatNoteSubtitle(note)}
                    visible
                    onClick={() => router.push(`/edu/upload/${note._id}`)}
                  />
                ))}
              </div>
            )}
          </>
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

// ── Processing screen component ───────────────────────────────────────────────

function ProcessingScreen({ progress }: { progress: number }) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="mb-6 h-12 w-12 animate-spin rounded-full border-4 border-edu-moss border-t-transparent" />

      <h2 className="mb-2 font-source-serif text-[20px] text-edu-moss-dark">
        Processing Document…
      </h2>

      <p className="mb-8 max-w-xs text-sm leading-relaxed text-edu-blue-grey">
        We&apos;re extracting and summarising your content. This usually takes 20–60 seconds.
      </p>

      {/* Progress bar */}
      <div className="relative h-1.5 w-64 overflow-hidden rounded-full bg-edu-line">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-edu-moss transition-[width] duration-[1200ms] ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>

      <p className="mt-4 text-xs text-edu-blue-grey">Please keep this tab open</p>
    </div>
  );
}
