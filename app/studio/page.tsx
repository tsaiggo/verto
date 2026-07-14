import PageHeader from "@/components/layout/PageHeader";
import StudioCards from "@/components/studio/StudioCards";

export const metadata = { title: "Knowledge Studio" };

export default function StudioPage() {
  return (
    <>
      <PageHeader
        title="Knowledge Studio"
        subtitle="Your saved summaries and notes as reusable knowledge cards."
      />

      <div className="v-page">
        <StudioCards />
      </div>
    </>
  );
}
