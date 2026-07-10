import { HardDrive } from "lucide-react";

export default function RailAccount() {
  return (
    <div className="app-rail-account app-rail-account--workspace">
      <span className="app-rail-account-avatar" aria-hidden>
        <HardDrive className="app-rail-account-avatar-icon" />
      </span>
      <span className="app-rail-account-text">
        <span className="app-rail-account-name">Local workspace</span>
        <span className="app-rail-account-plan">This device</span>
      </span>
    </div>
  );
}
