"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

/** Connexion Discord (OAuth2) : le compte du joueur est créé à la première connexion. */
export function DiscordLoginButton({ next }: { next: string }) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      type="button"
      size="lg"
      className="h-12 w-full text-base"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        const { error } = await authClient.signIn.social({
          provider: "discord",
          callbackURL: next,
          errorCallbackURL: "/login?error=discord",
        });
        if (error) setPending(false);
      }}
    >
      {pending ? <D20Loader /> : null}
      Se connecter avec Discord
    </Button>
  );
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const { error: signInError } = await authClient.signIn.email({
      email: String(form.get("email") ?? ""),
      password: String(form.get("password") ?? ""),
    });
    if (signInError) {
      setPending(false);
      // Message volontairement identique pour un email inconnu ou un mauvais mot de passe.
      setError(
        signInError.status === 429
          ? "Trop de tentatives. Patientez une minute avant de réessayer."
          : "Identifiants incorrects.",
      );
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="email" className="mb-1.5">
          Adresse e-mail
        </Label>
        <Input id="email" name="email" type="email" autoComplete="username" required autoFocus />
      </div>
      <div>
        <Label htmlFor="password" className="mb-1.5">
          Mot de passe
        </Label>
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? <D20Loader /> : null}
        Se connecter
      </Button>
    </form>
  );
}
