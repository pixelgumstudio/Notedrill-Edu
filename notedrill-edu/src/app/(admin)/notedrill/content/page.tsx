import type { Metadata } from "next";
import NotedrillNotesTable from "@/components/notedrill/NotedrillNotesTable";

export const metadata: Metadata = {
  title: "Notedrill Content | Admin",
  description: "All notes generated on the Notedrill platform",
};

export default function NotedrillContentPage() {
  return <NotedrillNotesTable />;
}
