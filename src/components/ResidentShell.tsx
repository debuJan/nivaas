import Link from "next/link";
import { AppHeader } from "./AppHeader";
import { ResidentNav } from "./ResidentNav";
import type { Session } from "@/lib/session";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/bills", label: "Bills & payments" },
  { href: "/complaints", label: "Complaints" },
  { href: "/complaints/new", label: "Raise a complaint" },
];

export function ResidentShell({
  session,
  flatLabel,
  children,
}: {
  session: Session;
  flatLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-20 sm:pb-0">
      <AppHeader name={session.name} subtitle={flatLabel} />
      <div className="mx-auto max-w-5xl px-4">
        <nav className="mt-4 hidden gap-1 sm:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:bg-teal-50 hover:text-accent"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <main className="py-5">{children}</main>
      </div>
      <ResidentNav />
    </div>
  );
}
