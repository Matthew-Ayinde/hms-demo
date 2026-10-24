import { Suspense } from "react";
import { FolioView } from "@/components/folio-view";

export default function FolioPage() {
  return (
    <Suspense fallback={null}>
      <FolioView />
    </Suspense>
  );
}
