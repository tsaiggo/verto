import { HardDrive } from "lucide-react";

export default function VxAccount() {
  return (
    <div className="vx-account">
      <span className="vx-account-avatar" aria-hidden>
        <HardDrive />
      </span>
      <span className="vx-account-text">
        <span className="vx-account-name">Local workspace</span>
        <span className="vx-account-plan">This device</span>
      </span>
    </div>
  );
}
