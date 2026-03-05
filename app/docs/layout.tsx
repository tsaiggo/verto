import { getNavigation } from "@/lib/navigation";
import DocsLayoutClient from "./DocsLayoutClient";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const navigation = getNavigation();

  return (
    <div className="docs-layout">
      <DocsLayoutClient navigation={navigation} />
      {children}
    </div>
  );
}
