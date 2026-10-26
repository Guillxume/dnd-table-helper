"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ACCEPT_ATTRIBUTE } from "@/lib/upload-rules";
import { cn } from "@/lib/utils";

export function Dropzone({
  onFiles,
  multiple = true,
  disabled = false,
  hint,
}: {
  onFiles: (files: File[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (disabled) return;
        const files = Array.from(event.dataTransfer.files);
        onFiles(multiple ? files : files.slice(0, 1));
      }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
        dragging ? "border-primary bg-primary/5" : "border-border",
        disabled && "opacity-60",
      )}
    >
      <Upload className="size-8 text-muted-foreground" aria-hidden />
      <div>
        <p className="font-medium">Glissez-déposez {multiple ? "vos images" : "l'image"} ici</p>
        <p className="mt-1 text-sm text-muted-foreground">{hint ?? "JPEG, PNG, WebP ou AVIF."}</p>
      </div>
      <Button type="button" variant="outline" disabled={disabled} onClick={() => inputRef.current?.click()}>
        Choisir {multiple ? "des fichiers" : "un fichier"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple={multiple}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (files.length > 0) onFiles(files);
        }}
        data-testid="file-input"
      />
    </div>
  );
}
