"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function PlayerSignOut() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.signOut();
        if (error) {
          setPending(false);
          toast.error("Déconnexion impossible. Réessaie.");
          return;
        }
        router.replace("/login");
        router.refresh();
      }}
    >
      <LogOut aria-hidden />
      <span className="sr-only sm:not-sr-only">Se déconnecter</span>
    </Button>
  );
}
