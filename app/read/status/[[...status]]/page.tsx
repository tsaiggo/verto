import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listAllFiles } from "@/lib/content-source";
import DocumentIndexPage from "@/components/reader/DocumentIndexPage";
import ReaderFrame from "@/components/reader/ReaderFrame";
import { ListFilter } from "lucide-react";

interface StatusPageProps {
  params: Promise<{ status?: string[] }>;
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const files = await listAllFiles();
  const statuses = new Set<string>();
  for (const file of files) {
    if (file.hidden || file.draft || !file.status) continue;
    statuses.add(file.status);
  }
  return [
    { status: [] as string[] },
    ...Array.from(statuses).map((status) => ({ status: [status] })),
  ];
}

export async function generateMetadata({ params }: StatusPageProps): Promise<Metadata> {
  const { status } = await params;
  const segs = status ?? [];
  if (segs.length !== 1) return { title: "Not Found" };
  const decoded = decodeURIComponent(segs[0]);
  return {
    title: `Status: ${decoded}`,
    description: `Documents with status "${decoded}"`,
  };
}

export default async function StatusPage({ params }: StatusPageProps) {
  const { status } = await params;
  const segs = status ?? [];
  if (segs.length !== 1) notFound();

  let decoded: string;
  try {
    decoded = decodeURIComponent(segs[0]);
  } catch {
    notFound();
  }

  const files = await listAllFiles();
  const visibleMatches = files.filter(
    (file) => !file.hidden && !file.draft && file.status?.toLowerCase() === decoded.toLowerCase()
  );

  return (
    <ReaderFrame mainLabel="Status documents">
      <DocumentIndexPage
        title={
          <>
            Status: <span className="doc-title-accent">{decoded}</span>
          </>
        }
        files={visibleMatches}
        emptyIcon={<ListFilter aria-hidden />}
        emptyTitle="No documents have this status"
        emptyDescription="Browse the library to find another document set."
      />
    </ReaderFrame>
  );
}
