import { redirect } from "next/navigation";

export const metadata = {
  title: "Sources & Integrations",
  description: "Manage connected content sources.",
};

export default function ConnectSourcePage() {
  redirect("/integrations#local-files");
}
