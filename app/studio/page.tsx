import { LayoutGrid } from "lucide-react";
import { ContentHeader, ContentPage } from "@/components/layout/ContentPage";
import StudioCards from "@/components/studio/StudioCards";

export const metadata = { title: "Knowledge Studio" };

export default function StudioPage() {
  return (
    <ContentPage width="standard">
      <ContentHeader
        icon={<LayoutGrid />}
        title="Knowledge Studio"
        description="Search, review, and refine saved summaries and notes."
      />
      <StudioCards />
    </ContentPage>
  );
}
