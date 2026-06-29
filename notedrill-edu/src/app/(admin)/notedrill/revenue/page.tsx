import type { Metadata } from "next";
import NotedrillRevenue from "@/components/notedrill/NotedrillRevenue";

export const metadata: Metadata = {
  title: "Notedrill Revenue | Admin",
  description: "PRO growth and revenue overview for Notedrill",
};

export default function NotedrillRevenuePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
          Revenue & Growth
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          PRO conversion and recent subscribers
        </p>
      </div>
      <NotedrillRevenue />
    </div>
  );
}
