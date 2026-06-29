import type { Metadata } from "next";
import NotedrillUsersTable from "@/components/notedrill/NotedrillUsersTable";

export const metadata: Metadata = {
  title: "Notedrill Users | Admin",
  description: "All registered Notedrill users",
};

export default function NotedrillUsersPage() {
  return <NotedrillUsersTable />;
}
