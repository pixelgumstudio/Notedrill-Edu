import type { Metadata } from "next";
import NotedrillFeedbackTable from "@/components/notedrill/NotedrillFeedbackTable";

export const metadata: Metadata = {
  title: "Notedrill Feedback | Admin",
  description: "User feedback and ratings on Notedrill notes",
};

export default function NotedrillFeedbackPage() {
  return <NotedrillFeedbackTable />;
}
