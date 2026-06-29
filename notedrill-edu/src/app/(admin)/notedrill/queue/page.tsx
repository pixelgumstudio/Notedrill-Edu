import type { Metadata } from "next";
import NotedrillQueueTable from "@/components/notedrill/NotedrillQueueTable";

export const metadata: Metadata = {
  title: "Notedrill Queue | Admin",
  description: "Transcription job queue stats for Notedrill",
};

export default function NotedrillQueuePage() {
  return <NotedrillQueueTable />;
}
