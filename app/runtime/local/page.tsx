import { Suspense } from "react";
import RuntimeLocalReader, {
  RuntimeLocalWorkspaceFallback,
} from "@/components/runtime/RuntimeLocalReader";

export default function RuntimeLocalPage() {
  return (
    <Suspense fallback={<RuntimeLocalWorkspaceFallback />}>
      <RuntimeLocalReader />
    </Suspense>
  );
}
