import PageHeader from "@/components/layout/PageHeader";

export const metadata = {
  title: "Trash",
  description: "Trash is not yet available in this version of Verto.",
};

export default function TrashPage() {
  return (
    <>
      <PageHeader title="Trash" subtitle="Deleted documents will appear here." flush />
      <div className="v-page">
        <div className="trash-placeholder">
          <p>Trash is not yet available in this version.</p>
          <p>To remove a document, delete or move the file from your content folder directly.</p>
        </div>
      </div>
    </>
  );
}
