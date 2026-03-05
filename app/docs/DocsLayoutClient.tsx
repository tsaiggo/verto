"use client";

import { usePathname } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import type { NavigationConfig } from "@/lib/types";

interface DocsLayoutClientProps {
  navigation: NavigationConfig;
}

export default function DocsLayoutClient({
  navigation,
}: DocsLayoutClientProps) {
  const pathname = usePathname();

  return <Sidebar navigation={navigation} pathname={pathname} />;
}
