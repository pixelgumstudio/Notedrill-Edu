"use client";

import React, { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProgressSteps from "@/components/edu/ProgressSteps";
import FlashcardViewer from "@/components/edu/FlashcardViewer";
import QuizReviewer from "@/components/edu/QuizReviewer";
import EduBackButton from "@/components/edu/EduBackButton";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type {
  NoteDetail,
  GeneratedSet,
  AdminQuizQuestion,
  AdminFlashcard,
} from "@/types/edu";

// ── helpers ───────────────────────────────────────────────────────────────────

function letterToIndex(letter: unknown): number {
  if (typeof letter === "number") return letter;
  if (typeof letter !== "string" || !letter) return -1;
  return "ABCD".indexOf(letter.toUpperCase());
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function resolveYouTubeId(note: NoteDetail): string | null {
  if (note.metadata?.youtubeVideoId) return note.metadata.youtubeVideoId;
  const candidate = note.extractedContent || "";
  const match = candidate.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
  );
  return match?.[1] ?? null;
}

function isHttpUrl(s?: string): s is string {
  return !!s && (s.startsWith("http://") || s.startsWith("https://"));
}

// ── Content-by-set tracking ───────────────────────────────────────────────────

interface SetContent {
  type: "quiz" | "flashcards";
  questions?: AdminQuizQuestion[];
  cards?: AdminFlashcard[];
}

// ── Source viewer ─────────────────────────────────────────────────────────────

function SourcePanel({ note }: { note: NoteDetail }) {
  const srcType = note.sourceType || note.type;

  if (srcType === "youtube") {
    const videoId = resolveYouTubeId(note);
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
      <EmptySource
        icon="▶"
        heading="Video not available"
        body="The original YouTube video URL was not preserved. The AI summary is still available in the Summary tab."
      />
    );
  }

  if (srcType === "pdf") {
    if (isHttpUrl(note.sourceFileUrl)) {
      return (
        <div className="overflow-hidden rounded-xl border border-edu-line" style={{ height: "72vh" }}>
          <iframe className="h-full w-full" src={note.sourceFileUrl} title={note.title} />
        </div>
      );
    }
    const raw = note.extractedContent || note.content || "";
    if (raw) {
      return (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-edu-line bg-edu-paper-2 px-4 py-2.5 text-xs text-edu-blue-grey">
            <span>📄</span>
            <span>The original PDF is stored privately. Showing the extracted text content below.</span>
          </div>
          <RawText text={raw} />
        </div>
      );
    }
    return (
      <EmptySource
        icon="📄"
        heading="PDF not available"
        body="The source file could not be loaded. The AI summary is still accessible in the Summary tab."
      />
    );
  }

  if (srcType === "image") {
    if (isHttpUrl(note.sourceFileUrl)) {
      return (
        <div className="overflow-hidden rounded-xl border border-edu-line">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={note.sourceFileUrl}
            alt={note.title}
            className="mx-auto max-h-[70vh] object-contain"
          />
        </div>
      );
    }
    const raw = note.extractedContent || note.content || "";
    if (raw) {
      return (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-edu-line bg-edu-paper-2 px-4 py-2.5 text-xs text-edu-blue-grey">
            <span>🖼</span>
            <span>Image preview unavailable. Showing OCR-extracted text below.</span>
          </div>
          <RawText text={raw} />
        </div>
      );
    }
    return <EmptySource icon="🖼" heading="Image not available" body="The source image could not be loaded." />;
  }

  const raw = note.extractedContent || note.content || "";
  if (raw) return <RawText text={raw} />;
  return <EmptySource icon="✎" heading="No source text" body="The original text content was not preserved." />;
}

function RawText({ text }: { text: string }) {
  const plain = text.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim();
  return (
    <div
      className="max-h-[66vh] overflow-y-auto rounded-xl border border-edu-line bg-edu-paper-2 p-5 font-mono text-[13px] leading-relaxed text-edu-ink"
      style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
    >
      {plain}
    </div>
  );
}

function EmptySource({ icon, heading, body }: { icon: string; heading: string; body: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-edu-line bg-edu-paper-2 py-16 text-center">
      <span className="mb-3 text-4xl">{icon}</span>
      <p className="mb-1 font-source-serif text-[15px] text-edu-moss-dark">{heading}</p>
      <p className="max-w-xs text-sm text-edu-blue-grey">{body}</p>
    </div>
  );
}

// ── AI Summary viewer ─────────────────────────────────────────────────────────

function SummaryPanel({ note }: { note: NoteDetail }) {
  const hasSummary = !!note.summary?.trim();
  const hasContent = !!note.content?.trim();

  if (!hasSummary && !hasContent) {
    return (
      <div className="rounded-xl border border-edu-line bg-edu-paper-2 px-6 py-10 text-center text-sm text-edu-blue-grey">
        The AI summary is still being generated. Refresh in a moment.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {hasSummary && (
        <div className="rounded-xl border border-edu-moss/30 bg-edu-moss-light px-5 py-4">
          <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-widest text-edu-moss">AI Summary</p>
          <p className="text-[14.5px] leading-relaxed text-edu-moss-dark">{note.summary}</p>
        </div>
      )}
      {hasContent && (
        <div
          className={[
            "prose prose-sm max-w-none rounded-xl border border-edu-line bg-white px-6 py-5",
            "prose-headings:font-source-serif prose-headings:text-edu-moss-dark",
            "prose-p:text-edu-ink prose-p:leading-relaxed",
            "prose-strong:text-edu-ink prose-li:text-edu-ink prose-li:leading-relaxed",
            "prose-h2:text-[15px] prose-h3:text-[13.5px] prose-ul:my-2 prose-ol:my-2",
          ].join(" ")}
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: note.content ?? "" }}
        />
      )}
    </div>
  );
}

// ── Assessments panel ─────────────────────────────────────────────────────────

interface AssessmentsPanelProps {
  noteId: string;
  orgToken: string;
  localSets: GeneratedSet[];
  setContents: Record<string, SetContent>;
  onQuestionsChange: (setId: string, questions: AdminQuizQuestion[]) => void;
  onCardsChange: (setId: string, cards: AdminFlashcard[]) => void;
  onGenerateQuiz: () => void;
  onGenerateFlash: () => void;
  onGenerateMore: (type: "quiz" | "flashcards", setId: string | null) => void;
  isGeneratingMore: boolean;
  onToast: (msg: string) => void;
}

function AssessmentsPanel({
  noteId,
  orgToken,
  localSets,
  setContents,
  onQuestionsChange,
  onCardsChange,
  onGenerateQuiz,
  onGenerateFlash,
  onGenerateMore,
  isGeneratingMore,
  onToast,
}: AssessmentsPanelProps) {
  const [selectedSetId, setSelectedSetId] = useState<string | null>(
    localSets[0]?.id ?? null
  );

  // Keep selection in sync when a new set is added
  const latestId = localSets[0]?.id ?? null;
  const prevLatestRef = useRef(latestId);
  useEffect(() => {
    if (latestId && latestId !== prevLatestRef.current) {
      setSelectedSetId(latestId);
      prevLatestRef.current = latestId;
    }
  }, [latestId]);

  const selectedSet = localSets.find((s) => s.id === selectedSetId) ?? null;
  const content = selectedSetId ? setContents[selectedSetId] : null;

  if (localSets.length === 0) {
    return (
      <div>
        <div className="mb-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-edu-line bg-edu-paper-2 py-12 text-center">
          <span className="mb-3 text-4xl">🎓</span>
          <h3 className="mb-1 font-source-serif text-[15px] text-edu-moss-dark">No assessments yet</h3>
          <p className="mb-5 max-w-xs text-sm text-edu-blue-grey">
            Generate your first quiz or flashcard deck to start reviewing content here.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <button
              onClick={onGenerateQuiz}
              className="flex items-center gap-2 rounded-lg bg-edu-moss px-4 py-2 text-sm font-bold text-white hover:bg-edu-moss-dark"
            >
              📝 Generate Quiz
            </button>
            <button
              onClick={onGenerateFlash}
              className="flex items-center gap-2 rounded-lg border border-edu-moss bg-white px-4 py-2 text-sm font-bold text-edu-moss-dark hover:bg-edu-moss-light"
            >
              🃏 Generate Flashcards
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* ── Set selector ──────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap gap-2">
        {localSets.map((set) => (
          <button
            key={set.id}
            onClick={() => setSelectedSetId(set.id)}
            className={[
              "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              selectedSetId === set.id
                ? "border-edu-moss bg-edu-moss-light text-edu-moss-dark"
                : "border-edu-line bg-white text-edu-blue-grey hover:border-edu-moss hover:text-edu-ink",
            ].join(" ")}
          >
            <span>{set.type === "quiz" ? "📝" : "🃏"}</span>
            <span className="max-w-[140px] truncate">{set.title}</span>
            <span className="text-[11px] opacity-70">({set.questionCount})</span>
          </button>
        ))}
      </div>

      {/* ── Viewer ────────────────────────────────────────────────────────── */}
      {selectedSet && content ? (
        <div>
          {content.type === "flashcards" && content.cards ? (
            <FlashcardViewer
              flashcardSetId={selectedSet.id}
              cards={content.cards}
              onCardsChange={(updated) => onCardsChange(selectedSet.id, updated)}
              onSaveCard={async (setId, cardId, data) => {
                await orgApi.updateFlashcard(orgToken, setId, cardId, data);
              }}
              onToast={onToast}
            />
          ) : content.type === "quiz" && content.questions ? (
            <QuizReviewer
              quizId={selectedSet.id}
              questions={content.questions}
              onQuestionsChange={(updated) => onQuestionsChange(selectedSet.id, updated)}
              onSaveQuestion={async (quizId, qIdx, data) => {
                await orgApi.updateQuizQuestion(orgToken, quizId, qIdx, data);
              }}
              onToast={onToast}
            />
          ) : (
            <div className="rounded-xl border border-edu-line bg-edu-paper-2 py-10 text-center text-sm text-edu-blue-grey">
              Content unavailable — please re-generate this set.
            </div>
          )}

          {/* ── Generate More ────────────────────────────────────────────── */}
          <div className="mt-5 flex flex-wrap items-center gap-2.5 rounded-xl border border-edu-line bg-edu-paper-2 px-4 py-3.5">
            <p className="flex-1 text-[12.5px] font-semibold text-edu-ink">
              {content.type === "quiz"
                ? `${content.questions?.length ?? 0} questions in this quiz`
                : `${content.cards?.length ?? 0} cards in this deck`}
            </p>
            <button
              disabled={isGeneratingMore}
              onClick={() => onGenerateMore(content.type, selectedSetId)}
              className="flex items-center gap-1.5 rounded-lg border border-edu-moss bg-white px-3.5 py-1.5 text-[12.5px] font-bold text-edu-moss-dark transition-colors hover:bg-edu-moss-light disabled:opacity-50"
            >
              {isGeneratingMore ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-edu-moss border-t-transparent" />
                  Generating…
                </>
              ) : (
                <>
                  ＋ Generate {content.type === "quiz" ? "more questions" : "more cards"}
                </>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-edu-line bg-edu-paper-2 py-10 text-center text-sm text-edu-blue-grey">
          Select a set above to start reviewing.
        </div>
      )}
    </div>
  );
}

// ── Tab bar ───────────────────────────────────────────────────────────────────

type WorkspaceTab = "source" | "summary" | "assessments";

function TabBar({
  active,
  onChange,
  assessmentCount,
}: {
  active: WorkspaceTab;
  onChange: (t: WorkspaceTab) => void;
  assessmentCount: number;
}) {
  const tabs: { id: WorkspaceTab; label: string; icon: string }[] = [
    { id: "source",      label: "Original Source",   icon: "📂" },
    { id: "summary",     label: "AI Summary",         icon: "✦"  },
    { id: "assessments", label: "Assessments",        icon: "🎓" },
  ];
  return (
    <div className="mb-5 flex gap-1 rounded-xl border border-edu-line bg-edu-paper-2 p-1">
      {tabs.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={[
            "relative flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-[12.5px] font-semibold transition-colors",
            active === id
              ? "bg-white text-edu-moss-dark shadow-sm"
              : "text-edu-blue-grey hover:text-edu-ink",
          ].join(" ")}
        >
          <span className="text-base leading-none">{icon}</span>
          <span className="hidden sm:inline">{label}</span>
          {id === "assessments" && assessmentCount > 0 && (
            <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-edu-moss px-1 text-[10px] font-bold text-white">
              {assessmentCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function FileWorkspacePage() {
  const { fileId } = useParams<{ fileId: string }>();
  const { orgToken } = useAuth();
  const queryClient = useQueryClient();

  // ── Server state ──────────────────────────────────────────────────────────
  const { data: note, isLoading: noteLoading } = useQuery({
    queryKey: ["org-note", fileId],
    queryFn: () => orgApi.getNoteById(orgToken ?? "", fileId),
    enabled: !!orgToken && !!fileId && fileId !== "undefined",
    staleTime: 30_000,
  });

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("summary");

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // ── Generated sets metadata list ──────────────────────────────────────────
  const [localSets, setLocalSets] = useState<GeneratedSet[]>([]);

  // ── Per-set content store ─────────────────────────────────────────────────
  // Keyed by set _id; holds the full questions / cards for interactive review.
  const [setContents, setSetContents] = useState<Record<string, SetContent>>({});

  function updateSetQuestions(setId: string, questions: AdminQuizQuestion[]) {
    setSetContents((prev) => ({ ...prev, [setId]: { ...prev[setId], type: "quiz", questions } }));
  }

  function updateSetCards(setId: string, cards: AdminFlashcard[]) {
    setSetContents((prev) => ({ ...prev, [setId]: { ...prev[setId], type: "flashcards", cards } }));
  }

  // ── Modal visibility ──────────────────────────────────────────────────────
  const [genQuizOpen, setGenQuizOpen]       = useState(false);
  const [genFlashOpen, setGenFlashOpen]     = useState(false);
  const [quizReviewOpen, setQuizReviewOpen] = useState(false);
  const [flashPreviewOpen, setFlashPreviewOpen] = useState(false);
  const [exportOpen, setExportOpen]         = useState(false);
  const [deleteOpen, setDeleteOpen]         = useState<string | null>(null);
  const [openMenuId, setOpenMenuId]         = useState<string | null>(null);

  // ── Generation inputs ─────────────────────────────────────────────────────
  const [quizQCount, setQuizQCount]       = useState(20);
  const [flashCardCount, setFlashCardCount] = useState(18);

  // ── Legacy modal state (used by existing quiz-review / flash-preview modals)
  const [generatedQuestions, setGeneratedQuestions] = useState<AdminQuizQuestion[]>([]);
  const [generatedCards, setGeneratedCards]         = useState<AdminFlashcard[]>([]);
  const [activeQuizId, setActiveQuizId]             = useState<string | null>(null);
  const [activeFlashId, setActiveFlashId]           = useState<string | null>(null);
  const [reviewSetTitle, setReviewSetTitle]         = useState("");
  const [exportIncludesAnswers, setExportIncludesAnswers] = useState(true);
  const [exportFormat, setExportFormat]             = useState<"pdf" | "docx">("pdf");

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const generateQuizMutation = useMutation({
    mutationFn: (qCount: number) =>
      orgApi.generateAdminQuiz(orgToken ?? "", fileId, { questionCount: qCount }),
    onSuccess: (data) => {
      const newSet: GeneratedSet = {
        id: data._id,
        type: "quiz",
        title: data.title,
        questionCount: data.questions.length,
        generatedAt: formatDate(new Date().toISOString()),
      };
      setLocalSets((prev) => [newSet, ...prev]);
      setSetContents((prev) => ({ ...prev, [data._id]: { type: "quiz", questions: data.questions } }));
      // Legacy modal state
      setGeneratedQuestions(data.questions);
      setActiveQuizId(data._id);
      setReviewSetTitle(data.title);
      setGenQuizOpen(false);
      setQuizReviewOpen(true);
      showToast("Quiz generated — review answers below");
      // Switch to Assessments tab automatically
      setActiveTab("assessments");
    },
    onError: (err: Error) => showToast(err.message || "Failed to generate quiz"),
  });

  const generateFlashMutation = useMutation({
    mutationFn: (cardCount: number) =>
      orgApi.generateAdminFlashcards(orgToken ?? "", fileId, { cardCount }),
    onSuccess: (data) => {
      const newSet: GeneratedSet = {
        id: data._id,
        type: "flashcards",
        title: data.title,
        questionCount: data.cards.length,
        generatedAt: formatDate(new Date().toISOString()),
      };
      setLocalSets((prev) => [newSet, ...prev]);
      setSetContents((prev) => ({ ...prev, [data._id]: { type: "flashcards", cards: data.cards } }));
      // Legacy modal state
      setGeneratedCards(data.cards);
      setActiveFlashId(data._id);
      setReviewSetTitle(data.title);
      setGenFlashOpen(false);
      setFlashPreviewOpen(true);
      showToast("Flashcards generated — review below");
      setActiveTab("assessments");
    },
    onError: (err: Error) => showToast(err.message || "Failed to generate flashcards"),
  });

  const generateMoreMutation = useMutation({
    mutationFn: ({
      type,
      setId,
    }: {
      type: "quiz" | "flashcards";
      setId: string | null;
    }) =>
      orgApi.generateMore(orgToken ?? "", fileId, {
        type,
        count: type === "quiz" ? 5 : 8,
        quizId: type === "quiz" ? (setId ?? null) : null,
        flashcardSetId: type === "flashcards" ? (setId ?? null) : null,
      }),
    onSuccess: (result, { setId }) => {
      if (result.type === "quiz" && setId) {
        const existing = setContents[setId]?.questions ?? [];
        const merged = [...existing, ...result.questions];
        updateSetQuestions(setId, merged);
        setLocalSets((prev) =>
          prev.map((s) => s.id === setId ? { ...s, questionCount: merged.length } : s)
        );
        showToast(`Added ${result.questions.length} more questions`);
      } else if (result.type === "flashcards" && setId) {
        const existing = setContents[setId]?.cards ?? [];
        const merged = [...existing, ...result.cards];
        updateSetCards(setId, merged);
        setLocalSets((prev) =>
          prev.map((s) => s.id === setId ? { ...s, questionCount: merged.length } : s)
        );
        showToast(`Added ${result.cards.length} more cards`);
      }
    },
    onError: (err: Error) => showToast(err.message || "Failed to generate more content"),
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const allSets = localSets;
  const title = noteLoading ? "Loading…" : (note?.title ?? "File workspace");
  const uploadedAt = note?.createdAt ? formatDate(note.createdAt) : "";

  const progressSteps = [
    { label: "Upload",          status: "done"    as const },
    { label: "Summary",         status: note?.summary ? ("done" as const) : ("current" as const) },
    { label: "Generate Q&A",    status: allSets.length > 0 ? ("done" as const) : (note?.summary ? ("current" as const) : ("pending" as const)) },
    { label: "Review",          status: (quizReviewOpen || flashPreviewOpen) ? ("current" as const) : ("pending" as const) },
    { label: "Export to print", status: "pending" as const },
  ];

  // ── Export helpers ────────────────────────────────────────────────────────

  const openExportForActive = (includeAnswers: boolean) => {
    setExportIncludesAnswers(includeAnswers);
    setOpenMenuId(null);
    setExportOpen(true);
  };

  const handleExportDownload = () => {
    const type = exportIncludesAnswers ? "answers" : "questions";
    const url = activeQuizId
      ? orgApi.getQuizExportUrl(activeQuizId, type, exportFormat)
      : activeFlashId
      ? orgApi.getFlashcardExportUrl(activeFlashId, type, exportFormat)
      : null;

    if (url && orgToken) {
      fetch(url, { headers: { Authorization: `Bearer ${orgToken}` } })
        .then((r) => r.blob())
        .then((blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${reviewSetTitle}.${exportFormat}`;
          a.click();
          URL.revokeObjectURL(a.href);
          showToast("Export ready — check your downloads");
        })
        .catch(() => showToast("Export failed — try again"));
    }
    setExportOpen(false);
  };

  const handleDeleteSet = async (id: string) => {
    const set = localSets.find((s) => s.id === id);
    if (!set) {
      setDeleteOpen(null);
      return;
    }

    try {
      if (set.type === "quiz") {
        await orgApi.deleteQuiz(orgToken ?? "", id);
      } else {
        await orgApi.deleteFlashcardSet(orgToken ?? "", id);
      }
    } catch {
      showToast("Could not delete set — please try again");
      setDeleteOpen(null);
      return;
    }

    setLocalSets((prev) => prev.filter((s) => s.id !== id));
    setSetContents((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (id === activeQuizId) setActiveQuizId(null);
    if (id === activeFlashId) setActiveFlashId(null);
    setDeleteOpen(null);
    showToast("Set deleted");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  function handleGenerateMore(type: "quiz" | "flashcards", setId: string | null) {
    generateMoreMutation.mutate({ type, setId });
  }

  return (
    <>
      {/* Page top bar */}
      <div className="border-b border-edu-line bg-white px-6 py-5 md:px-8">
        {noteLoading ? (
          <div className="h-7 w-72 animate-pulse rounded bg-edu-line" />
        ) : (
          <h1 className="font-source-serif text-[22px] text-edu-moss-dark">{title}</h1>
        )}
        <p className="mt-0.5 text-sm text-edu-blue-grey">
          {uploadedAt ? `Uploaded ${uploadedAt} · ` : ""}Visible to all students
        </p>
      </div>

      <div className="px-6 py-6 md:px-8">
        <EduBackButton href="/edu/upload" label="Back to files" className="mb-4" />

        {/* Teacher badge */}
        <div className="mb-5 inline-flex items-center gap-1.5 rounded-lg bg-edu-gold-light px-3 py-1.5 text-[12px] font-bold text-[#8A5A18]">
          🔒 Teacher workspace — you see all answers immediately. Students generate and take quizzes separately.
        </div>

        <ProgressSteps steps={progressSteps} />

        {/* ── Three-tab viewer ──────────────────────────────────────────── */}
        <div className="mb-7">
          <TabBar
            active={activeTab}
            onChange={setActiveTab}
            assessmentCount={localSets.length}
          />

          {noteLoading ? (
            <div className="space-y-3">
              {[3 / 4, 1, 5 / 6, 2 / 3].map((w, i) => (
                <div
                  key={i}
                  className="h-5 animate-pulse rounded bg-edu-line"
                  style={{ width: `${w * 100}%` }}
                />
              ))}
            </div>
          ) : activeTab === "source" ? (
            note ? <SourcePanel note={note} /> : null
          ) : activeTab === "summary" ? (
            note ? <SummaryPanel note={note} /> : null
          ) : (
            /* Assessments tab */
            <AssessmentsPanel
              noteId={fileId}
              orgToken={orgToken ?? ""}
              localSets={localSets}
              setContents={setContents}
              onQuestionsChange={updateSetQuestions}
              onCardsChange={updateSetCards}
              onGenerateQuiz={() => setGenQuizOpen(true)}
              onGenerateFlash={() => setGenFlashOpen(true)}
              onGenerateMore={handleGenerateMore}
              isGeneratingMore={generateMoreMutation.isPending}
              onToast={showToast}
            />
          )}
        </div>

        {/* ── Generate exam material ──────────────────────────────────────── */}
        <h3 className="mb-3.5 font-source-serif text-[15.5px] text-edu-moss-dark">
          Generate exam material from this file
        </h3>
        <div className="mb-7 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            className="rounded-xl border-[1.5px] border-edu-line bg-white p-5 text-left transition-all hover:border-edu-moss hover:shadow-md disabled:opacity-50"
            style={{ boxShadow: "var(--edu-shadow)" }}
            onClick={() => setGenQuizOpen(true)}
            disabled={!note || generateQuizMutation.isPending}
          >
            <div className="mb-2 text-xl">📝</div>
            <h4 className="mb-1 font-source-serif text-[14.5px] text-edu-moss-dark">Generate Quiz</h4>
            <p className="text-xs text-edu-blue-grey">
              Multiple-choice questions — all answers visible immediately for review and export.
            </p>
          </button>
          <button
            className="rounded-xl border-[1.5px] border-edu-line bg-white p-5 text-left transition-all hover:border-edu-moss hover:shadow-md disabled:opacity-50"
            style={{ boxShadow: "var(--edu-shadow)" }}
            onClick={() => setGenFlashOpen(true)}
            disabled={!note || generateFlashMutation.isPending}
          >
            <div className="mb-2 text-xl">🗂</div>
            <h4 className="mb-1 font-source-serif text-[14.5px] text-edu-moss-dark">Generate Flashcards</h4>
            <p className="text-xs text-edu-blue-grey">
              Question and answer pairs — front and back both visible for admin review and printing.
            </p>
          </button>
        </div>

        {/* ── Generated sets table ────────────────────────────────────────── */}
        <div
          className="overflow-hidden rounded-xl border border-edu-line bg-white"
          style={{ boxShadow: "var(--edu-shadow)" }}
        >
          <div className="border-b border-edu-line px-5 py-4">
            <h3 className="font-source-serif text-[16.5px] text-edu-moss-dark">Your generated entries</h3>
            <p className="mt-0.5 text-[12.5px] text-edu-blue-grey">
              {allSets.filter((s) => s.type === "quiz").length} quiz set(s) ·{" "}
              {allSets.filter((s) => s.type === "flashcards").length} flashcard set(s) — private to you.
            </p>
          </div>

          {(generateQuizMutation.isPending || generateFlashMutation.isPending) && (
            <div className="flex items-center gap-3 border-b border-edu-line px-5 py-3.5">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-edu-moss border-t-transparent" />
              <span className="text-sm text-edu-blue-grey">Generating…</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-edu-paper-2">
                  {["Type", "Title", "Items", "Generated", ""].map((h) => (
                    <th
                      key={h}
                      className={`border-b border-edu-line px-5 py-3 text-[11.5px] font-bold uppercase tracking-wider text-edu-blue-grey ${h ? "text-left" : "text-right"}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allSets.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-8 text-center text-sm text-edu-blue-grey">
                      No sets generated yet — use the buttons above.
                    </td>
                  </tr>
                ) : (
                  allSets.map((set) => (
                    <tr
                      key={set.id}
                      className="cursor-pointer border-b border-edu-line last:border-b-0 transition-colors hover:bg-edu-paper-2"
                      onClick={() => {
                        setReviewSetTitle(set.title);
                        if (set.type === "quiz") setQuizReviewOpen(true);
                        else setFlashPreviewOpen(true);
                      }}
                    >
                      <td className="px-5 py-3.5 text-sm capitalize text-edu-ink">{set.type}</td>
                      <td className="px-5 py-3.5 text-sm text-edu-ink">{set.title}</td>
                      <td className="px-5 py-3.5 text-sm text-edu-ink">{set.questionCount}</td>
                      <td className="px-5 py-3.5 text-sm text-edu-blue-grey">{set.generatedAt}</td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div
                          className="relative inline-block"
                          ref={openMenuId === set.id ? menuRef : undefined}
                        >
                          <button
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-edu-line bg-white text-sm text-edu-blue-grey hover:bg-edu-paper-2"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId(openMenuId === set.id ? null : set.id);
                              setReviewSetTitle(set.title);
                              if (set.type === "quiz") setActiveQuizId(set.id);
                              else setActiveFlashId(set.id);
                            }}
                            title="More actions"
                          >
                            ⋯
                          </button>
                          {openMenuId === set.id && (
                            <div
                              className="absolute right-0 top-full z-50 mt-1 min-w-[220px] overflow-hidden rounded-lg border border-edu-line bg-white"
                              style={{ boxShadow: "0 6px 20px rgba(21,35,31,0.15)" }}
                            >
                              <button
                                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-semibold text-edu-ink hover:bg-edu-paper-2"
                                onClick={() => openExportForActive(true)}
                              >
                                📄 Export questions &amp; answers
                              </button>
                              <button
                                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-semibold text-edu-ink hover:bg-edu-paper-2"
                                onClick={() => openExportForActive(false)}
                              >
                                📄 Export questions only
                              </button>
                              <button
                                className="flex w-full items-center gap-2 border-t border-edu-line px-3.5 py-2.5 text-left text-[13px] font-semibold text-edu-red hover:bg-edu-red-light"
                                onClick={() => { setOpenMenuId(null); setDeleteOpen(set.id); }}
                              >
                                🗑 Delete
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Generate Quiz Modal ───────────────────────────────────────────────── */}
      {genQuizOpen && (
        <Modal
          title="Generate a quiz"
          description={`Based on "${title}". You'll see all answers immediately — nothing is shared with students until you export.`}
          onClose={() => setGenQuizOpen(false)}
        >
          <div className="mb-3">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">Number of questions</label>
            <input
              type="number" value={quizQCount} min={5} max={50}
              onChange={(e) => setQuizQCount(Number(e.target.value))}
              className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none"
            />
          </div>
          <div className="flex gap-2.5">
            <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setGenQuizOpen(false)}>Cancel</button>
            <button
              className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
              disabled={generateQuizMutation.isPending}
              onClick={() => generateQuizMutation.mutate(quizQCount)}
            >
              {generateQuizMutation.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Generate Flashcards Modal ─────────────────────────────────────────── */}
      {genFlashOpen && (
        <Modal
          title="Generate flashcards"
          description={`Based on "${title}". Both question and answer will be visible for admin review.`}
          onClose={() => setGenFlashOpen(false)}
        >
          <div className="mb-5">
            <label className="mb-1.5 block text-[12.5px] font-semibold text-edu-ink">Number of cards</label>
            <input
              type="number" value={flashCardCount} min={5} max={50}
              onChange={(e) => setFlashCardCount(Number(e.target.value))}
              className="w-full rounded-lg border-[1.5px] border-edu-line bg-edu-paper p-2.5 text-sm focus:border-edu-moss focus:outline-none"
            />
          </div>
          <div className="flex gap-2.5">
            <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setGenFlashOpen(false)}>Cancel</button>
            <button
              className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark disabled:opacity-60"
              disabled={generateFlashMutation.isPending}
              onClick={() => generateFlashMutation.mutate(flashCardCount)}
            >
              {generateFlashMutation.isPending ? "Generating…" : "Generate"}
            </button>
          </div>
        </Modal>
      )}

      {/* ── Quiz Review Modal (legacy — still works from table row click) ───── */}
      {quizReviewOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5"
          onClick={(e) => e.currentTarget === e.target && setQuizReviewOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-xl bg-white"
            style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}
          >
            <div className="border-b border-edu-line px-7 py-5">
              <h3 className="font-source-serif text-lg text-edu-ink">{reviewSetTitle}</h3>
              <p className="mt-0.5 text-sm text-edu-blue-grey">
                {generatedQuestions.length} questions · review before exporting to print
              </p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-edu-gold-light px-2.5 py-1 text-[11px] font-bold text-[#8A5A18]">
                🔒 Admin view — correct answers highlighted.
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-7 py-5">
              {generatedQuestions.map((q, idx) => {
                const correctIdx = letterToIndex(q.correctAnswer);
                return (
                  <div key={q.id ?? idx} className="rounded-xl border border-edu-line bg-white p-4">
                    <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-edu-gold">
                      Q{idx + 1}
                    </p>
                    <p className="mb-2.5 text-sm font-semibold text-edu-ink">{q.question}</p>
                    <div className="mb-2.5 grid grid-cols-2 gap-2">
                      {q.options.map((opt, i) => (
                        <div
                          key={opt.id ?? i}
                          className={`rounded-md p-2 text-xs ${i === correctIdx ? "border border-edu-moss bg-edu-moss-light font-bold text-edu-moss-dark" : "bg-edu-paper-2 text-edu-ink"}`}
                        >
                          <span className="mr-1 font-bold text-edu-blue-grey">{"ABCD"[i]}.</span>
                          {opt.text}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <p className="border-t border-edu-line pt-2 text-[12px] text-edu-blue-grey">
                        <b>Why:</b> {q.explanation}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-2.5 border-t border-edu-line px-7 py-5">
              <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setQuizReviewOpen(false)}>Close</button>
              <button
                className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark"
                onClick={() => { setQuizReviewOpen(false); setExportIncludesAnswers(true); setExportOpen(true); }}
              >
                Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Flashcard Preview Modal ───────────────────────────────────────────── */}
      {flashPreviewOpen && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5"
          onClick={(e) => e.currentTarget === e.target && setFlashPreviewOpen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-[600px] flex-col overflow-hidden rounded-xl bg-white"
            style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}
          >
            <div className="border-b border-edu-line px-7 py-5">
              <h3 className="font-source-serif text-lg text-edu-ink">{reviewSetTitle}</h3>
              <p className="mt-0.5 text-sm text-edu-blue-grey">{generatedCards.length} cards</p>
              <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-md bg-edu-gold-light px-2.5 py-1 text-[11px] font-bold text-[#8A5A18]">
                🔒 Admin view — both sides shown.
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto px-7 py-5">
              {generatedCards.map((card, idx) => (
                <div key={idx} className="grid grid-cols-2 gap-0 overflow-hidden rounded-xl border border-edu-line">
                  <div className="bg-edu-moss-light px-4 py-3.5">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-edu-moss-dark">Front</p>
                    <p className="text-sm font-semibold text-edu-moss-dark">{card.front}</p>
                  </div>
                  <div className="border-l border-edu-line px-4 py-3.5">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-edu-blue-grey">Back</p>
                    <p className="text-sm text-edu-ink">{card.back}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-2.5 border-t border-edu-line px-7 py-5">
              <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setFlashPreviewOpen(false)}>Close</button>
              <button
                className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark"
                onClick={() => { setFlashPreviewOpen(false); setExportIncludesAnswers(true); setExportOpen(true); }}
              >
                Export flashcards
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export Modal ──────────────────────────────────────────────────────── */}
      {exportOpen && (
        <Modal
          title={`Export "${reviewSetTitle}"`}
          description="Choose a format and what to include."
          onClose={() => setExportOpen(false)}
        >
          <div className="mb-4">
            <p className="mb-2 text-[12.5px] font-semibold text-edu-ink">Format</p>
            <div className="flex gap-2.5">
              {(["pdf", "docx"] as const).map((fmt) => (
                <button
                  key={fmt}
                  className={`flex-1 rounded-lg border-[1.5px] py-3.5 text-sm font-bold transition-colors ${exportFormat === fmt ? "border-edu-moss bg-edu-moss-light text-edu-moss-dark" : "border-edu-line text-edu-blue-grey hover:border-edu-moss"}`}
                  onClick={() => setExportFormat(fmt)}
                >
                  {fmt.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-1 flex items-center justify-between py-2">
            <span className="text-[13.5px] font-semibold text-edu-ink">Include answers</span>
            <button
              className={`relative h-6 w-11 rounded-full transition-colors ${exportIncludesAnswers ? "bg-edu-moss" : "bg-edu-line"}`}
              onClick={() => setExportIncludesAnswers((v) => !v)}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${exportIncludesAnswers ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <p className="mb-5 text-xs text-edu-blue-grey">
            {exportIncludesAnswers ? "Includes questions, correct answers, and explanations." : "Questions only — exam paper mode."}
          </p>
          <div className="flex gap-2.5">
            <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setExportOpen(false)}>Cancel</button>
            <button className="flex-1 rounded-lg bg-edu-moss py-2.5 text-sm font-bold text-white hover:bg-edu-moss-dark" onClick={handleExportDownload}>Export</button>
          </div>
        </Modal>
      )}

      {/* ── Delete Confirmation Modal ─────────────────────────────────────────── */}
      {deleteOpen && (
        <Modal
          title="Delete this set?"
          description="This removes it permanently from your workspace. Students are not affected."
          onClose={() => setDeleteOpen(null)}
        >
          <div className="flex gap-2.5">
            <button className="flex-1 rounded-lg border-[1.5px] border-edu-line py-2.5 text-sm font-bold text-edu-blue-grey hover:bg-edu-paper-2" onClick={() => setDeleteOpen(null)}>Cancel</button>
            <button className="flex-1 rounded-lg bg-edu-red py-2.5 text-sm font-bold text-white hover:opacity-90" onClick={() => deleteOpen && handleDeleteSet(deleteOpen)}>Delete</button>
          </div>
        </Modal>
      )}

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

// ── Modal shell ───────────────────────────────────────────────────────────────

function Modal({
  title,
  description,
  children,
  onClose,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-edu-moss-dark/45 p-5"
      onClick={(e) => e.currentTarget === e.target && onClose()}
    >
      <div
        className="w-full max-w-[460px] rounded-xl bg-white p-7"
        style={{ boxShadow: "0 10px 40px rgba(0,0,0,0.25)" }}
      >
        <h3 className="mb-2 font-source-serif text-lg text-edu-ink">{title}</h3>
        {description && <p className="mb-5 text-sm leading-relaxed text-edu-blue-grey">{description}</p>}
        {children}
      </div>
    </div>
  );
}
