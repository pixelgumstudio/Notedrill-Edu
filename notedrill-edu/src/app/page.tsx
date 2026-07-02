import type { Metadata } from "next";
import Link from "next/link";
import BrandMark from "@/components/edu/BrandMark";

export const metadata: Metadata = {
  title: "NoteDrill Edu — Transform Your School's Curriculum into Interactive Learning",
  description:
    "NoteDrill Edu turns any curriculum material into AI-generated summaries, flashcards, and scored practice quizzes — helping teachers save time and students study smarter.",
};

const VALUE_PROPS = [
  {
    title: "Instant AI Summaries",
    description:
      "Upload any lesson material and get a clean, structured summary in under a minute — giving teachers back hours otherwise spent condensing content by hand.",
    icon: (
      <path
        d="M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zM9 9h6M9 12h6M9 15h3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Auto-Generated Flashcards",
    description:
      "Every upload becomes a ready-to-use flashcard set, prompting active recall so students retain material instead of just re-reading it.",
    icon: (
      <path
        d="M4 7a2 2 0 0 1 2-2h9l5 5v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7zM15 5v5h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Scored Practice Quizzes",
    description:
      "Students test themselves with auto-generated quizzes and get instant, scored feedback — building exam readiness long before test day.",
    icon: (
      <path
        d="M9 11l3 3 8-8M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-edu-paper font-outfit text-edu-ink">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-edu-line bg-edu-paper/90 backdrop-blur">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <BrandMark size="md" />
          <div className="flex items-center gap-4 text-sm font-medium md:gap-6">
            <Link
              href="/student/login"
              className="text-edu-blue-grey transition-colors hover:text-edu-moss-dark"
            >
              Student Login
            </Link>
            <Link
              href="/org/login"
              className="text-edu-blue-grey transition-colors hover:text-edu-moss-dark"
            >
              Teacher/Admin
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-5 pb-16 pt-14 md:px-8 md:pb-24 md:pt-20">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-block rounded-full bg-edu-moss-light px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-edu-moss-dark">
              For Secondary Schools
            </span>
            <h1 className="mt-5 font-source-serif text-4xl leading-tight text-edu-ink sm:text-5xl md:text-6xl">
              Transform Your School&apos;s Curriculum into{" "}
              <span className="text-edu-moss">Interactive Learning</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-edu-blue-grey md:text-lg">
              Give your teachers an effortless way to turn lesson materials into summaries,
              flashcards, and quizzes — and give your students a smarter, more engaging way to
              study.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/org/register"
                className="w-full rounded-[var(--edu-radius)] bg-edu-moss px-7 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:bg-edu-moss-dark sm:w-auto"
                style={{ boxShadow: "var(--edu-shadow)" }}
              >
                Register Your School
              </Link>
              <Link
                href="/student/login"
                className="w-full rounded-[var(--edu-radius)] border-[1.5px] border-edu-line bg-white px-7 py-3.5 text-center text-sm font-semibold text-edu-ink transition-colors hover:border-edu-moss hover:text-edu-moss-dark sm:w-auto"
              >
                Student Login
              </Link>
            </div>
          </div>
        </section>

        {/* Value proposition */}
        <section className="border-t border-edu-line bg-edu-paper-2">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-source-serif text-3xl text-edu-ink md:text-4xl">
                Upload once, study <span className="text-edu-gold">three ways</span>
              </h2>
              <p className="mt-4 text-base text-edu-blue-grey">
                One upload from a teacher becomes a complete study toolkit for every student in
                the class.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
              {VALUE_PROPS.map((prop) => (
                <div
                  key={prop.title}
                  className="rounded-[var(--edu-radius)] border border-edu-line bg-white p-6 md:p-7"
                  style={{ boxShadow: "var(--edu-shadow)" }}
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-[var(--edu-radius)] bg-edu-moss-light">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-6 w-6 text-edu-moss-dark"
                      aria-hidden="true"
                    >
                      {prop.icon}
                    </svg>
                  </div>
                  <h3 className="mt-5 font-source-serif text-xl text-edu-ink">{prop.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-edu-blue-grey">
                    {prop.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <div
            className="rounded-[var(--edu-radius)] bg-edu-moss px-6 py-12 text-center md:px-16 md:py-16"
            style={{ boxShadow: "var(--edu-shadow)" }}
          >
            <h2 className="font-source-serif text-3xl text-white md:text-4xl">
              Ready to modernize how your school studies?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-edu-moss-light">
              Register your school today and give every teacher and student access to
              AI-powered study tools.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/org/register"
                className="w-full rounded-[var(--edu-radius)] bg-white px-7 py-3.5 text-center text-sm font-semibold text-edu-moss-dark transition-colors hover:bg-edu-gold-light sm:w-auto"
              >
                Register Your School
              </Link>
              <Link
                href="/org/login"
                className="w-full rounded-[var(--edu-radius)] border-[1.5px] border-white/40 px-7 py-3.5 text-center text-sm font-semibold text-white transition-colors hover:border-white sm:w-auto"
              >
                Teacher/Admin Login
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-edu-line bg-edu-paper">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
            <BrandMark size="sm" />
            <div className="flex items-center gap-6 text-sm font-medium text-edu-blue-grey">
              <Link href="/student/login" className="transition-colors hover:text-edu-moss-dark">
                Student Login
              </Link>
              <Link href="/org/login" className="transition-colors hover:text-edu-moss-dark">
                Teacher/Admin
              </Link>
            </div>
          </div>
          <p className="mt-6 text-center text-xs text-edu-blue-grey md:text-left">
            © {new Date().getFullYear()} NoteDrill Edu. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
