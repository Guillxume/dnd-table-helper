"use client";

import { D20Loader } from "@/components/brand/d20-loader";
import { type ComponentProps, type ReactNode, useActionState, useEffect, useEffectEvent, useId } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { type ActionResult, type FormState, IDLE_FORM } from "@/lib/action-result";
import { cn } from "@/lib/utils";

type FormServerAction<T> = (previous: unknown, form: FormData) => Promise<ActionResult<T>>;

/**
 * useActionState + notification : affiche le message de succès et appelle
 * `onSuccess` après chaque soumission réussie.
 */
export function useFormAction<T = undefined>(
  action: FormServerAction<T>,
  options: { onSuccess?: (result: Extract<ActionResult<T>, { ok: true }>) => void; toastOnSuccess?: boolean } = {},
) {
  const toastOnSuccess = options.toastOnSuccess ?? true;
  // Le message est affiché dès la réponse, dans l'action elle-même : si le
  // formulaire est remonté par le rafraîchissement de la page, il n'est pas perdu.
  const [state, formAction, pending] = useActionState<FormState<T>, FormData>(async (previous, form) => {
    const result = await action(previous, form);
    if (result.ok && toastOnSuccess && result.message) toast.success(result.message);
    return result;
  }, IDLE_FORM);
  const handleSuccess = useEffectEvent((result: Extract<ActionResult<T>, { ok: true }>) => {
    options.onSuccess?.(result);
  });
  useEffect(() => {
    if (state.ok === true) handleSuccess(state);
  }, [state]);
  return [state, formAction, pending] as const;
}

export function SubmitButton({ children, ...props }: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? <D20Loader /> : null}
      {children}
    </Button>
  );
}

export function fieldError(state: FormState<unknown>, name: string): string | undefined {
  return state.ok === false ? state.fieldErrors?.[name]?.[0] : undefined;
}

/** Message d'erreur global du formulaire, annoncé aux lecteurs d'écran. */
export function FormMessage({ state }: { state: FormState<unknown> }) {
  if (state.ok !== false) return null;
  return (
    <p role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      {state.error}
    </p>
  );
}

type FieldProps = {
  label: string;
  name: string;
  hint?: ReactNode;
  error?: string;
  className?: string;
};

export function TextField({
  label,
  name,
  hint,
  error,
  className,
  ...inputProps
}: FieldProps & Omit<ComponentProps<typeof Input>, "name">) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5">
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        {...inputProps}
      />
      <FieldDescription id={`${id}-desc`} hint={hint} error={error} />
    </div>
  );
}

export function TextAreaField({
  label,
  name,
  hint,
  error,
  className,
  ...textareaProps
}: FieldProps & Omit<ComponentProps<typeof Textarea>, "name">) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5">
        {label}
      </Label>
      <Textarea
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        {...textareaProps}
      />
      <FieldDescription id={`${id}-desc`} hint={hint} error={error} />
    </div>
  );
}

/** Liste déroulante native : accessible, utilisable au clavier et sur mobile sans JavaScript. */
export function SelectField({
  label,
  name,
  hint,
  error,
  className,
  children,
  ...selectProps
}: FieldProps & Omit<ComponentProps<"select">, "name">) {
  const id = useId();
  return (
    <div className={className}>
      <Label htmlFor={id} className="mb-1.5">
        {label}
      </Label>
      <NativeSelect
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-desc` : undefined}
        {...selectProps}
      >
        {children}
      </NativeSelect>
      <FieldDescription id={`${id}-desc`} hint={hint} error={error} />
    </div>
  );
}

export function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-8 w-full min-w-0 rounded-lg border border-input bg-input/30 px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

function FieldDescription({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  if (!hint && !error) return null;
  return (
    <p id={id} className={`mt-1 text-xs ${error ? "text-destructive" : "text-muted-foreground"}`}>
      {error ?? hint}
    </p>
  );
}
