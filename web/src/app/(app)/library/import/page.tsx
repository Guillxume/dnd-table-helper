import type { Metadata } from "next";
import { Importer } from "@/components/library/importer";
import { PageHeader } from "@/components/shared/page-header";
import { getUploadMaxBytes } from "@/server/env";
import { getLibraryOptions } from "@/server/library/options";
import { requireUser } from "@/server/session";

export const metadata: Metadata = { title: "Importer" };

export default async function ImportPage() {
  await requireUser();
  const options = await getLibraryOptions();
  return (
    <>
      <PageHeader
        title="Importer des illustrations"
        description="Les fichiers originaux sont conservés intacts dans le stockage privé ; une miniature et un aperçu sont générés. Les doublons sont détectés par empreinte."
      />
      <Importer options={options} maxBytes={getUploadMaxBytes()} />
    </>
  );
}
