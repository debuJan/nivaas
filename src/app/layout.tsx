import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nivaas — Township Resident App",
  description:
    "Maintenance bills, bank-matched payments, complaints and notices for gated-township residents.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
