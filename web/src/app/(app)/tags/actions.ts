"use server";

import { z } from "zod";
import type { ActionResult } from "@/lib/action-result";
import { idSchema, refreshAll, runAction } from "@/server/action-utils";
import { deleteTag, renameTag } from "@/server/library/tags";

export async function renameTagAction(tagId: string, name: string): Promise<ActionResult> {
  return runAction("tags:rename", async () => {
    await renameTag(idSchema.parse(tagId), z.string().max(60).parse(name));
    refreshAll();
    return { ok: true, message: "Tag renommé." };
  });
}

export async function deleteTagAction(tagId: string): Promise<ActionResult> {
  return runAction("tags:delete", async () => {
    await deleteTag(idSchema.parse(tagId));
    refreshAll();
    return { ok: true, message: "Tag supprimé." };
  });
}
