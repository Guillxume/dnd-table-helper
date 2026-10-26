"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { RefreshCw } from "lucide-react";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { refreshAccessAction, startCreationAction } from "@/app/(joueur)/personnages/actions";
import { FormMessage, NativeSelect, SubmitButton, fieldError, useFormAction } from "@/components/shared/form-controls";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function StartCreationForm({
  campaigns,
  replacesCurrent,
}: {
  campaigns: { id: string; name: string }[];
  replacesCurrent: string | null;
}) {
  const [state, formAction] = useFormAction(startCreationAction, { toastOnSuccess: false });
  return (
    <form action={formAction} className="space-y-4">
      {campaigns.length === 1 ? (
        <input type="hidden" name="campaignId" value={campaigns[0].id} />
      ) : (
        <div>
          <Label htmlFor="campaign" className="mb-1.5 text-base">
            Campagne
          </Label>
          <NativeSelect id="campaign" name="campaignId" defaultValue="" className="h-12 text-base" required>
            <option value="" disabled>
              Choisis ta campagne…
            </option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      )}
      <div>
        <Label htmlFor="character-name" className="mb-1.5 text-base">
          Nom de ton personnage
        </Label>
        <Input
          id="character-name"
          name="name"
          required
          minLength={2}
          maxLength={40}
          className="h-12 text-lg"
          aria-invalid={fieldError(state, "name") ? true : undefined}
        />
        {fieldError(state, "name") ? <p className="mt-1 text-sm text-destructive">{fieldError(state, "name")}</p> : null}
      </div>
      {replacesCurrent ? (
        <p className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          Attention : commencer un nouveau personnage remplace la création en cours de « {replacesCurrent} ».
        </p>
      ) : null}
      <FormMessage state={state} />
      <SubmitButton size="lg" className="h-12 px-6 text-base">
        Commencer
      </SubmitButton>
    </form>
  );
}

export function RefreshAccessButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="lg"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await refreshAccessAction();
          if (result.ok) {
            toast.success(result.message ?? "Accès mis à jour.");
            router.refresh();
          } else toast.error(result.error);
        })
      }
    >
      {pending ? <D20Loader /> : <RefreshCw aria-hidden />}
      Vérifier à nouveau mes accès
    </Button>
  );
}
