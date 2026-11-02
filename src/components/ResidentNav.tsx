"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "⌂" },
  { href: "/bills", label: "Bills", icon: "₹" },
  { href: "/complaints", label: "Complaints", icon: "✎" },
  { href: "/complaints/new", label: "New", icon: "+" },
];

export function ResidentNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 backdrop-blur sm:hidden">
      <div className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href) &&
                (item.href !== "/complaints" || pathname === "/complaints");
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-12 flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
                active ? "text-accent" : "text-stone-400"
              }`}
            >
              {active && (
                <span className="absolute inset-x-8 top-0 h-0.5 rounded-full bg-accent" />
              )}
              <span className="text-base leading-none">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
