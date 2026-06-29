import type { Metadata } from "next";
import NotedrillDashboard from "@/components/notedrill/NotedrillDashboard";

export const metadata: Metadata = {
  title: "Notedrill Dashboard | Admin",
  description: "Notedrill platform KPIs — users, content, and queue health",
};

export default function NotedrillDashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Notedrill Dashboard
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Live platform metrics
        </p>
      </div>
      <NotedrillDashboard />
    </div>
  );
}
