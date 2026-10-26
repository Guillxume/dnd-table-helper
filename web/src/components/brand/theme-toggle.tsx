"use client";

import { Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { THEME_COOKIE, type Theme } from "@/lib/theme";

/** Bascule entre le thème sombre « taverne » et le thème clair « parchemin ». Le choix est gardé un an. */
export function ThemeToggle({ initial, className }: { initial: Theme; className?: string }) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(initial);
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label = next === "light" ? "Passer au thème clair" : "Passer au thème sombre";

  function toggle() {
    document.documentElement.classList.toggle("dark", next === "dark");
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    setTheme(next);
    // Le layout relit le cookie (notifications au bon thème).
    router.refresh();
  }

  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label} className={cn(className)}>
      {next === "light" ? <Sun aria-hidden /> : <Moon aria-hidden />}
    </Button>
  );
}
