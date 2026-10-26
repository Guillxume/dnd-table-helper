"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pluralize } from "@/lib/text";
import { deleteTagAction, renameTagAction } from "./actions";

export function TagRow({ id, name, count }: { id: string; name: string; count: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await renameTagAction(id, value);
      if (result.ok) {
        toast.success(result.message ?? "Renommé.");
        setEditing(false);
      } else toast.error(result.error);
    });
  }

  return (
    <li className="flex items-center gap-3 px-3 py-2">
      {editing ? (
        <form
          className="flex flex-1 items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Input value={value} onChange={(event) => setValue(event.target.value)} aria-label={`Nouveau nom pour ${name}`} autoFocus maxLength={60} />
          <Button type="submit" size="icon-sm" disabled={pending || !value.trim()} aria-label="Enregistrer">
            <Check aria-hidden />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => setEditing(false)} aria-label="Annuler">
            <X aria-hidden />
          </Button>
        </form>
      ) : (
        <>
          <Link href={`/library?tag=${id}`} className="min-w-0 flex-1 truncate hover:underline">
            {name}
          </Link>
          <span className="text-xs text-muted-foreground">{pluralize(count, "illustration")}</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setEditing(true)} aria-label={`Renommer ${name}`}>
            <Pencil aria-hidden />
          </Button>
          <ConfirmAction
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Supprimer ${name}`}>
                <Trash2 aria-hidden />
              </Button>
            }
            title={`Supprimer le tag « ${name} » ?`}
            description={<p>Il sera retiré de {pluralize(count, "illustration")}. Les illustrations sont conservées.</p>}
            action={() => deleteTagAction(id)}
          />
        </>
      )}
    </li>
  );
}
