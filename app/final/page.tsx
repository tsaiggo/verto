import { notFound } from "next/navigation";
import { FinalPackIndex } from "@/components/final/FinalPackScreen";

const referencePackEnabled = process.env.VERTO_SHOW_REFERENCE_PACK === "1";

export const metadata = referencePackEnabled
  ? {
      title: "Final Implementation Pack",
      description: "Route-backed coverage for all Verto final reference screens.",
    }
  : { title: "Not Found" };

export default function FinalIndexPage() {
  // The pack is an internal implementation-review board, not a product route.
  if (!referencePackEnabled) notFound();
  return <FinalPackIndex />;
}
