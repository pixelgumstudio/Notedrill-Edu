import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import EduBackButton from "@/components/edu/EduBackButton";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  weight: ["400", "600", "700"],
  display: "swap",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  weight: ["400", "500"],
  display: "swap",
});

export default function StudentFocusLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-theme="edu"
      className={`${inter.variable} ${sourceSerif.variable} ${ibmPlexMono.variable} font-inter bg-edu-paper text-edu-ink min-h-screen`}
    >
      {/* Persistent escape hatch — study sessions have no sidebar, so this is
          the only guaranteed way back to the files list from any state
          (loading, error, or in-progress) across quiz/flashcard pages. */}
      <div className="sticky top-0 z-40 border-b border-edu-line bg-edu-paper/95 px-5 py-2.5 backdrop-blur md:px-8">
        <EduBackButton href="/learn/files" label="Back to Notes" />
      </div>
      {children}
    </div>
  );
}
