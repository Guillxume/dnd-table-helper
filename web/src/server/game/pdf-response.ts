import "server-only";
import { NextResponse } from "next/server";
import { sheetFileName } from "@bot/character/label";

export function pdfResponse(buffer: Buffer, name: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${sheetFileName(name)}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
