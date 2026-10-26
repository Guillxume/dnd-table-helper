"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** `text` depuis un composant serveur ; `getText` depuis un composant client (valeur lue au clic). */
export function CopyButton({
  text,
  getText,
  label = "Copier",
  successMessage = "Copié dans le presse-papiers.",
  variant = "outline",
  size = "sm",
}: {
  text?: string;
  getText?: () => string;
  label?: string;
  successMessage?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default";
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(getText ? getText() : (text ?? ""));
      setCopied(true);
      toast.success(successMessage);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Contexte non sécurisé (HTTP hors localhost) ou permission refusée.
      toast.error("Copie impossible : sélectionnez le texte et copiez-le manuellement.");
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={copy}>
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {label}
    </Button>
  );
}
