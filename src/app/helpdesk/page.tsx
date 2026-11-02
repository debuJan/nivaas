import { requirePageSession } from "@/lib/session";
import { AppHeader } from "@/components/AppHeader";
import { HelpdeskClient } from "./HelpdeskClient";

export default async function HelpdeskPage() {
  const session = await requirePageSession("HELPDESK");
  return (
    <div className="min-h-screen">
      <AppHeader name={session.name} subtitle="Help desk" />
      <main className="mx-auto max-w-5xl px-4 py-5">
        <HelpdeskClient />
      </main>
    </div>
  );
}
