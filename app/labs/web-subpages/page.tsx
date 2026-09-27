import type { Metadata } from "next";
import WebSubpagesPreview from "@/components/design-labs/web-subpages/WebSubpagesPreview";

export const metadata: Metadata = {
  title: "Web subpages · Design preview",
  robots: { index: false, follow: false },
};

export default function WebSubpagesPreviewPage() {
  return <WebSubpagesPreview />;
}
