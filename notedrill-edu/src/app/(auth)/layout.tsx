import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";

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

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-theme="edu"
      className={`${inter.variable} ${sourceSerif.variable} ${ibmPlexMono.variable} font-inter bg-edu-paper text-edu-ink min-h-screen`}
    >
      {children}
    </div>
  );
}
