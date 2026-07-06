import { Trash2 } from "lucide-react";
import PageHeader from "@/components/layout/PageHeader";

export const metadata = {
  title: "Trash",
  description: "Deleted documents and recoverable library items.",
};

export default function TrashPage() {
  return (
    <>
      <PageHeader title="Trash" subtitle="Deleted documents and recoverable library items." />
      <div className="v-page v-page--narrow">
        <div className="v-empty">
          <span className="v-empty-icon" aria-hidden>
            <Trash2 />
          </span>
          <strong className="v-empty-title">Trash is empty</strong>
          <p className="v-empty-text">
            Items you delete from Verto will stay here until you restore them or clear them
            permanently.
          </p>
        </div>
      </div>
    </>
  );
}
