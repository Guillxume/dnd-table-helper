"use client";

import { LogOut, Menu, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import type { Theme } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { isActive, NAV_SECTIONS } from "./nav-items";

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-md px-1 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
      <Logo size={40} priority />
      <span className="flex flex-col leading-tight">
        <span className="font-heading text-lg font-semibold">Atelier</span>
        <span className="text-xs text-muted-foreground">La Table de l&apos;Étoile</span>
      </span>
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex flex-col gap-5">
      {NAV_SECTIONS.map((section, index) => (
        <div key={section.title ?? index} className="flex flex-col gap-0.5">
          {section.title ? (
            <div className="px-2 pb-1 text-[0.7rem] font-medium tracking-wider text-muted-foreground uppercase">
              {section.title}
            </div>
          ) : null}
          {section.items.map((item) => {
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-sidebar-foreground/80 outline-none transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
                  active && "bg-sidebar-accent font-medium text-sidebar-accent-foreground",
                )}
              >
                <item.icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function GlobalSearch({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q) return;
    router.push(`/search?q=${encodeURIComponent(q)}`);
    onNavigate?.();
  }
  return (
    <form role="search" onSubmit={submit} className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      <Input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher partout…"
        aria-label="Rechercher dans toute la bibliothèque"
        className="pl-8"
      />
    </form>
  );
}

function SignOut({ email, theme }: { email: string; theme: Theme }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function signOut() {
    setPending(true);
    const { error } = await authClient.signOut();
    if (error) {
      setPending(false);
      toast.error("Déconnexion impossible. Réessayez.");
      return;
    }
    router.replace("/login");
    router.refresh();
  }
  return (
    <div className="flex items-center justify-between gap-2 border-t border-sidebar-border pt-3">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={email}>
        {email}
      </span>
      <ThemeToggle initial={theme} className="size-7" />
      <Button variant="ghost" size="icon-sm" onClick={signOut} disabled={pending} aria-label="Se déconnecter" title="Se déconnecter">
        <LogOut aria-hidden />
      </Button>
    </div>
  );
}

export function AppShell({ email, theme, children }: { email: string; theme: Theme; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[15rem_1fr]">
      <a
        href="#contenu"
        className="sr-only z-50 rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Aller au contenu
      </a>

      <aside className="on-wood sticky top-0 hidden h-dvh flex-col gap-5 border-r border-brass/30 bg-sidebar p-3 text-sidebar-foreground lg:flex">
        <Brand />
        <GlobalSearch />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <SignOut email={email} theme={theme} />
      </aside>

      <div className="on-wood sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-brass/30 bg-wood px-3 py-2 text-wood-foreground lg:hidden">
        <Brand />
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Ouvrir le menu">
              <Menu aria-hidden />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="on-wood flex w-72 flex-col gap-5 bg-sidebar p-4 text-sidebar-foreground">
            <SheetHeader className="p-0">
              <SheetTitle>Menu</SheetTitle>
            </SheetHeader>
            <GlobalSearch onNavigate={close} />
            <div className="min-h-0 flex-1 overflow-y-auto">
              <NavLinks onNavigate={close} />
            </div>
            <SignOut email={email} theme={theme} />
          </SheetContent>
        </Sheet>
      </div>

      <main id="contenu" className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        {children}
      </main>
    </div>
  );
}
