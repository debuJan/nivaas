import { LogoutButton } from "./LogoutButton";

export function AppHeader({
  name,
  subtitle,
}: {
  name: string;
  subtitle: string;
}) {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div>
          <p className="text-lg font-semibold tracking-tight text-accent">
            Nivaas
          </p>
          <p className="text-xs text-stone-500">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm text-stone-600 sm:block">{name}</span>
          <LogoutButton />
        </div>
      </div>
    </header>
  );
}
