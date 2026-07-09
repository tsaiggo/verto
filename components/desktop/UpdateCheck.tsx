"use client";

import { Download } from "lucide-react";
import UpdateCheckButton from "@/components/desktop/UpdateCheckButton";

/**
 * Compact "check for updates" trigger for toolbar surfaces.
 *
 * The shared UpdateCheckButton handles desktop detection, progress toasts,
 * updater downloads and relaunching. Keeping this wrapper tiny avoids a second
 * updater code path drifting away from the Settings button.
 */
export default function UpdateCheck() {
  return (
    <UpdateCheckButton
      className="vx-iconbtn"
      aria-label="Check for updates"
      title="Check for updates"
    >
      <Download aria-hidden />
    </UpdateCheckButton>
  );
}
