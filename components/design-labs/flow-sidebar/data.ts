import {
  ChartNoAxesColumn,
  FileText,
  FolderKanban,
  GitBranch,
  Info,
  LayoutGrid,
  Settings,
  Users,
  UserRoundCog,
  WalletCards,
} from "lucide-react";

export const primaryLinks = [
  { label: "Dashboard", icon: LayoutGrid },
  { label: "Calendar", icon: GitBranch },
  { label: "My Tasks", icon: WalletCards },
  { label: "Projects", icon: FolderKanban },
];
export const businessLinks = [
  { label: "Leads", icon: ChartNoAxesColumn },
  { label: "Teams", icon: Users },
  { label: "Clients", icon: UserRoundCog },
  { label: "Invoices", icon: WalletCards },
  { label: "Documents", icon: FileText },
];
export const utilityLinks = [
  { label: "Settings", icon: Settings },
  { label: "Help & Support", icon: Info },
];
export const allLinks = [...primaryLinks, ...businessLinks, ...utilityLinks];
