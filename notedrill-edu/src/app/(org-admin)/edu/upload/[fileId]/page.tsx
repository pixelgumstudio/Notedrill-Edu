"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ProgressSteps from "@/components/edu/ProgressSteps";
import FlashcardViewer from "@/components/edu/FlashcardViewer";
import QuizReviewer from "@/components/edu/QuizReviewer";
import EduBackButton from "@/components/edu/EduBackButton";
import EmptyState from "@/components/edu/EmptyState";
import ActionMenu from "@/components/edu/ActionMenu";
import SourceViewer from "@/components/edu/SourceViewer";
import { orgApi } from "@/lib/org-api";
import { useAuth } from "@/context/AuthContext";
import type {
  OrgNoteDetail,
  OrgGeneratedSetSummary,
  AdminQuizQuestion,
  AdminFlashcard,
} from "@/types/edu";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Display title for a set — the backend doesn't return one, so we synthesize it. */
function setTitle(type: "quiz" | "flashcardSet", count: number): string {
  return type === "quiz" ? `Quiz (${count} question${count === 1 ? "" : "s"})` : `Flashcards (${count} card${count === 1 ? "" : "s"})`;
}

// ── Content-by-set tracking ───────────────────────────────────────────────────

type SetContent =
  | { type: "quiz"; questions: AdminQuizQuestion[] }
  | { type: "flashcardSet"; cards: AdminFlashcard[] };

// ── AI Summary viewer ─────────────────────────────────────────────────────────

function SummaryPanel({ note }: { note: OrgNoteDetail }) {
  if (!note.summary?.trim()) {
    return (
      <div className="rounded-xl border border-edu-line bg-edu-paper-2 px-6 py-10 text-center text-sm text-edu-blue-grey">
        The AI summary is still being generated. Refresh in a moment.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-edu-moss/30 bg-edu-moss-light px-5 py-4">
      <p className="mb-1.5 text-[10.5px] font-bold uppercase tracking-widest text-edu-moss">AI Summary</p>
      <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-edu-moss-dark">{note.summary}</p>
    </div>
  );
}

// ── Assessments panel ─────────────────────────────────────────────────────────

interface AssessmentsPanelProps {
  localSets: OrgGeneratedSetSummary[];
  selectedSetId: string | null;
  onSelectSet: (id: string) => void;
  content: SetContent | null | undefined;
  contentLoading: boolean;
  onQuestionsChange: (setId: string, questions: AdminQuizQuestion[]) => void;
  onCardsChange: (setId: string, cards: AdminFlashcard[]) => void;
  onGenerateQuiz: () => void;
  onGenerateFlash: () => void;
  onToast: (msg: string) => void;
}

function AssessmentsPanel({
  localSets,
  selectedSetId,
  onSelectSet,
  content,
  contentLoading,
  onQuestionsChange,
  onCardsChange,
  onGenerateQuiz,
  onGenerateFlash,
  onToast,
}: AssessmentsPanelProps) {
  const [setQuery, setSetQuery] = useState("");

  const selectedSet = localSets.find((s) => s.id === selectedSetId) ?? null;

  const SEARCH_THRESHOLD = 6;
  const filteredSets = setQuery.trim()
    ? localSets.filter((s) => setTitle(s.type, s.questionCount).toLowerCase().includes(setQuery.trim().toLowerCase()))
    : localSets;

  if (localSets.length === 0) {
    return (
      <EmptyState
        mark="＋"
        heading="No assessments yet"
        body="Generate your first quiz or flashcard deck to start reviewing content here."
        className="mb-5 rounded-xl border border-dashed border-edu-line bg-edu-paper-2"
      >
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <button
            onClick={onGenerateQuiz}
            className="rounded-lg bg-edu-moss px-4 py-2 text-sm font-bold text-white hover:bg-edu-moss-dark"
          >
            Generate Quiz
          </button>
          <button
            onClick={onGenerateFlash}
            className="rounded-lg border border-edu-moss bg-white px-4 py-2 text-sm font-bold text-edu-moss-dark hover:bg-edu-moss-light"
          >
            Generate Flashcards
          </button>
        </div>
      </EmptyState>
    );
  }

  return (
    <div>
      {/* ── Set selector ──────────────────────────────────────────────────── */}
      {localSets.length > SEARCH_THRESHOLD && (
        <div className="relative mb-2.5">
          <input
            type="text"
            value={setQuery}
            onChange={(e) => setSetQuery(e.target.value)}
            placeholder={`Search ${localSets.length} sets…`}
            className="w-full max-w-xs rounded-lg border-[1.5px] border-edu-line bg-white py-1.5 pl-8 pr-3 text-[12.5px] focus:border-edu-moss focus:outline-none"
          />
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[12px] text-edu-blue-grey">⌕</span>
        </div>
      )}
      <div className="mb-4 flex snap-x gap-2 overflow-x-auto pb-1.5" style={{ scrollbarWidth: "thin" }}>
        {filteredSets.map((set) => (
          <button
            key={set.id}
            onClick={() => onSelectSet(set.id)}
            className={[
              "flex shrink-0 snap-start items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
              selectedSetId === set.id
                ? "border-edu-moss bg-edu-moss-light text-edu-moss-dark"
                : "border-edu-line bg-white text-edu-blue-grey hover:border-edu-moss hover:text-edu-ink",
            ].join(" ")}
          >
            <span
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${set.type === "quiz" ? "bg-edu-moss" : "bg-edu-gold"}`}
              aria-hidden="true"
            />
            <span className="max-w-[160px] truncate">{setTitle(set.type, set.questionCount)}</span>
          </button>
        ))}
        {filteredSets.length === 0 && (
          <p className="shrink-0 py-1.5 text-[12.5px] text-edu-blue-grey">No sets match &quot;{setQuery}&quot;.</p>
        )}
      </div>

      {/* ── Viewer ────────────────────────────────────────────────────────── */}
      {contentLoading ? (
        <div className="space-y-2 rounded-xl border border-edu-line bg-white p-5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-edu-line" />
          ))}
        </div>
      ) : selectedSet && content ? (
        content.type === "flashcardSet" ? (
          <FlashcardViewer
            cards={content.cards}
            onCardsChange={(updated) => onCardsChange(selectedSet.id, updated)}
            onToast={onToast}
          />
        ) : (
          <QuizReviewer
            questions={content.questions}
            onQuestionsChange={(updated) => onQuestionsChange(selectedSet.id, updated)}
            onToast={onToast}
          />
        )
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
  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: "source",      label: "Original Source" },
    { id: "summary",     label: "AI Summary" },
    { id: "assessments", label: "Assessments" },
  ];
  return (
    <div className="mb-5 flex gap-1 rounded-xl border border-edu-line bg-edu-paper-2 p-1">
      {tabs.map(({ id, label }) => (
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
          <span>{label}</span>
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

  const { data: sets = [] } = useQuery({
    queryKey: ["org-note-sets", fileId],
    queryFn: () => orgApi.getQuizzesAndFlashcards(orgToken ?? "", fileId),
    enabled: !!orgToken && !!fileId && fileId !== "undefined",
    staleTime: 30_000,
  });

  // Sets generated in this session (not yet reflected by a refetch of `sets`)
  const [localOnlySets, setLocalOnlySets] = useState<OrgGeneratedSetSummary[]>([]);
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const allSets = [...localOnlySets, ...sets.filter((s) => !localOnlySets.some((l) => l.id === s.id))].filter(
    (s) => !deletedIds.has(s.id),
  );

  // ── Tab state ─────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<WorkspaceTab>("summary");

  // ── Toast ─────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2800);
  };

  // ── Per-set content store — fetched lazily on selection ────────────────────
  const [setContents, setSetContents] = useState<Record<string, SetContent>>({});
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [contentLoading, setContentLoading] = useState(false);

  function updateSetQuestions(setId: string, questions: AdminQuizQuestion[]) {
    setSetContents((prev) => ({ ...prev, [setId]: { type: "quiz", questions } }));
  }

  function updateSetCards(setId: string, cards: AdminFlashcard[]) {
    setSetContents((prev) => ({ ...prev, [setId]: { type: "flashcardSet", cards } }));
  }

  // Auto-select the most recent set once sets load, and lazily fetch content
  // for whichever set is selected.
  useEffect(() => {
    if (!selectedSetId && allSets.length > 0) {
      setSelectedSetId(allSets[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allSets.length]);

  useEffect(() => {
    if (!selectedSetId || !orgToken || setContents[selectedSetId]) return;
    const set = allSets.find((s) => s.id === selectedSetId);
    if (!set) return;

    let cancelled = false;
    setContentLoading(true);
    const fetcher =
      set.type === "quiz"
        ? orgApi.getQuizById(orgToken, selectedSetId).then((q) => ({ type: "quiz" as const, questions: q.questions }))
        : orgApi.getFlashcardSetById(orgToken, selectedSetId).then((s) => ({ type: "flashcardSet" as const, cards: s.cards }));

    fetcher
      .then((content) => {
        if (cancelled) return;
        setSetContents((prev) => ({ ...prev, [selectedSetId]: content }));
      })
      .catch(() => {
        if (!cancelled) showToast("Could not load that set — please try again");
      })
      .finally(() => {
        if (!cancelled) setContentLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSetId, orgToken]);

  // ── Modal visibility ──────────────────────────────────────────────────────
  const [genQuizOpen, setGenQuizOpen]       = useState(false);
  const [genFlashOpen, setGenFlashOpen]     = useState(false);
  const [exportOpen, setExportOpen]         = useState(false);
  const [deleteOpen, setDeleteOpen]         = useState<string | null>(null);

  // ── Generation inputs ─────────────────────────────────────────────────────
  const [quizQCount, setQuizQCount]       = useState(20);
  const [flashCardCount, setFlashCardCount] = useState(18);
  const [exportIncludesAnswers, setExportIncludesAnswers] = useState(true);
  const [exportFormat, setExportFormat]             = useState<"pdf" | "docx">("pdf");
  const [exportTargetId, setExportTargetId] = useState<string | null>(null);

  // ── Mutations ─────────────────────────────────────────────────────────────

  const generateQuizMutation = useMutation({
    mutationFn: (qCount: number) => orgApi.generateAdminQuiz(orgToken ?? "", fileId, qCount),
    onSuccess: (data) => {
      const newSet: OrgGeneratedSetSummary = {
        id: data._id,
        noteId: fileId,
        noteTitle: note?.title ?? "",
        questionCount: data.questions.length,
        type: "quiz",
        createdAt: data.createdAt,
      };
      setLocalOnlySets((prev) => [newSet, ...prev]);
      setSetContents((prev) => ({ ...prev, [data._id]: { type: "quiz", questions: data.questions } }));
      setSelectedSetId(data._id);
      setGenQuizOpen(false);
      showToast("Quiz generated — review answers below");
      setActiveTab("assessments");
    },
    onError: (err: Error) => showToast(err.message || "Failed to generate quiz"),
  });

  const generateFlashMutation = useMutation({
    mutationFn: (cardCount: number) => orgApi.generateAdminFlashcards(orgToken ?? "", fileId, cardCount),
    onSuccess: (data) => {
      const newSet: OrgGeneratedSetSummary = {
        id: data._id,
        noteId: fileId,
        noteTitle: note?.title ?? "",
        questionCount: data.cards.length,
        type: "flashcardSet",
        createdAt: data.createdAt,
      };
      setLocalOnlySets((prev) => [newSet, ...prev]);
      setSetContents((prev) => ({ ...prev, [data._id]: { type: "flashcardSet", cards: data.cards } }));
      setSelectedSetId(data._id);
      setGenFlashOpen(false);
      showToast("Flashcards generated — review below");
      setActiveTab("assessments");
    },
    onError: (err: Error) => showToast(err.message || "Failed to generate flashcards"),
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const title = noteLoading ? "Loading…" : (note?.title ?? "File workspace");
  const uploadedAt = note?.createdAt ? formatDate(note.createdAt) : "";

  const progressSteps = [
    { label: "Upload",          status: "done"    as const },
    { label: "Summary",         status: note?.summary ? ("done" as const) : ("current" as const) },
    { label: "Generate Q&A",    status: allSets.length > 0 ? ("done" as const) : (note?.summary ? ("current" as const) : ("pending" as const)) },
    { label: "Export to print", status: allSets.length > 0 ? ("current" as const) : ("pending" as const) },
  ];

  // ── Export helpers ────────────────────────────────────────────────────────

  const openExportFor = (id: string, includeAnswers: boolean) => {
    setExportTargetId(id);
    setExportIncludesAnswers(includeAnswers);
    setExportOpen(true);
  };

  const handleExportDownload = () => {
    if (!exportTargetId) return;
    const set = allSets.find((s) => s.id === exportTargetId);
    const url =
      set?.type === "quiz"
        ? orgApi.getQuizExportUrl(exportTargetId, exportIncludesAnswers, exportFormat)
        : orgApi.getFlashcardExportUrl(exportTargetId, exportIncludesAnswers, exportFormat);

    if (orgToken) {
      fetch(url, { headers: { Authorization: `Bearer ${orgToken}` } })
        .then((r) => r.blob())
        .then((blob) => {
          const a = document.createElement("a");
          a.href = URL.createObjectURL(blob);
          a.download = `${set ? setTitle(set.type, set.questionCount) : "export"}.${exportFormat}`;
          a.click();
          URL.revokeObjectURL(a.href);
          showToast("Export ready — check your downloads");
        })
        .catch(() => showToast("Export failed — try again"));
    }
    setExportOpen(false);
  };

  const handleDeleteSet = async (id: string) => {
    const set = allSets.find((s) => s.id === id);
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

    setDeletedIds((prev) => new Set(prev).add(id));
    setLocalOnlySets((prev) => prev.filter((s) => s.id !== id));
    setSetContents((prev) => { const next = { ...prev }; delete next[id]; return next; });
    if (selectedSetId === id) setSelectedSetId(null);
    setDeleteOpen(null);
    showToast("Set deleted");
    queryClient.invalidateQueries({ queryKey: ["org-note-sets", fileId] });
  };

  const selectedContent = selectedSetId ? setContents[selectedSetId] : null;

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
          Teacher workspace — you see all answers immediately. Students generate and take quizzes separately.
        </div>

        <ProgressSteps steps={progressSteps} />

        {/* ── Three-tab viewer ──────────────────────────────────────────── */}
        <div className="mb-7">
          <TabBar
            active={activeTab}
            onChange={setActiveTab}
            assessmentCount={allSets.length}
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
            note ? <SourceViewer note={note} /> : null
          ) : activeTab === "summary" ? (
            note ? <SummaryPanel note={note} /> : null
          ) : (
            /* Assessments tab */
            <AssessmentsPanel
              localSets={allSets}
              selectedSetId={selectedSetId}
              onSelectSet={setSelectedSetId}
              content={selectedContent}
              contentLoading={contentLoading}
              onQuestionsChange={updateSetQuestions}
              onCardsChange={updateSetCards}
              onGenerateQuiz={() => setGenQuizOpen(true)}
              onGenerateFlash={() => setGenFlashOpen(true)}
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
            <p className="mb-2 font-source-serif text-lg font-semibold text-edu-gold">01</p>
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
            <p className="mb-2 font-source-serif text-lg font-semibold text-edu-gold">02</p>
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
              {allSets.filter((s) => s.type === "flashcardSet").length} flashcard set(s) — private to you.
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
                        setSelectedSetId(set.id);
                        setActiveTab("assessments");
                      }}
                    >
                      <td className="px-5 py-3.5 text-sm capitalize text-edu-ink">{set.type === "quiz" ? "Quiz" : "Flashcards"}</td>
                      <td className="px-5 py-3.5 text-sm text-edu-ink">{setTitle(set.type, set.questionCount)}</td>
                      <td className="px-5 py-3.5 text-sm text-edu-ink">{set.questionCount}</td>
                      <td className="px-5 py-3.5 text-sm text-edu-blue-grey">{formatDate(set.createdAt)}</td>
                      <td className="px-5 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <ActionMenu label="More actions">
                          {(close) => (
                            <>
                              <button
                                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-semibold text-edu-ink hover:bg-edu-paper-2"
                                onClick={() => { close(); openExportFor(set.id, true); }}
                              >
                                Export questions &amp; answers
                              </button>
                              <button
                                className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[13px] font-semibold text-edu-ink hover:bg-edu-paper-2"
                                onClick={() => { close(); openExportFor(set.id, false); }}
                              >
                                Export questions only
                              </button>
                              <button
                                className="flex w-full items-center gap-2 border-t border-edu-line px-3.5 py-2.5 text-left text-[13px] font-semibold text-edu-red hover:bg-edu-red-light"
                                onClick={() => { close(); setDeleteOpen(set.id); }}
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </ActionMenu>
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

      {/* ── Export Modal ──────────────────────────────────────────────────────── */}
      {exportOpen && (
        <Modal
          title="Export set"
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
