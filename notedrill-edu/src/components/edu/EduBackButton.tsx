import Link from "next/link";

interface EduBackButtonProps {
  href: string;
  label: string;
  className?: string;
}

export default function EduBackButton({ href, label, className = "" }: EduBackButtonProps) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 font-outfit text-sm font-semibold text-edu-blue-grey transition-colors hover:text-edu-moss ${className}`}
    >
      <span aria-hidden="true">←</span> {label}
    </Link>
  );
}
