"use client";

import { useMemo, useState } from "react";
import { AlignLeft } from "lucide-react";
import { toast } from "sonner";
import type { ConnectionDetails } from "@/lib/connection-info";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  PROVIDERS,
  checklistFor,
  fieldsFor,
  initialProviderFor,
  isConnectedProvider,
  previewRowsFor,
  setupStepsFor,
  type ProviderKind,
} from "@/components/integrations/connect-source-data";
import {
  ConnectAside,
  ConnectFormSection,
  ProviderCards,
} from "@/components/integrations/connect-source-sections";

interface ConnectSourceViewProps {
  connection: ConnectionDetails;
}

export default function ConnectSourceView({ connection }: ConnectSourceViewProps) {
  const initialProvider = initialProviderFor(connection);

  const [selected, setSelected] = useState<ProviderKind>(initialProvider);
  const [remote, setRemote] = useState(connection.remote);
  const [localFolder, setLocalFolder] = useState(() =>
    connection.kind === "local" && connection.path !== "/" ? connection.path : ""
  );

  const auth = useAuth();
  // The interactive GitHub flow is desktop-only. In the browser build (or
  // before the user signs in) we fall back to the presentational form, which
  // reflects the build-time `VERTO_CONTENT_SOURCE` configuration.
  const liveGitHub = selected === "github" && auth.available;

  const fields = useMemo(() => fieldsFor(selected, connection), [selected, connection]);
  const previewRows = useMemo(
    () => previewRowsFor(selected, connection, fields, localFolder),
    [selected, connection, fields, localFolder]
  );
  const connectedHere = isConnectedProvider(selected, connection);
  const selectedMeta = PROVIDERS.find((p) => p.kind === selected) ?? PROVIDERS[0];
  const setupSteps = useMemo(
    () => setupStepsFor(selected, auth, localFolder, connection),
    [selected, auth, localFolder, connection]
  );
  const checklist = useMemo(
    () => checklistFor(selected, auth.available, Boolean(auth.user)),
    [selected, auth.available, auth.user]
  );

  const onSave = () => {
    toast("Connections are configured at build time", {
      description:
        "Verto previews from the source set via VERTO_CONTENT_SOURCE. Update your environment and rebuild to switch sources.",
    });
  };

  return (
    <div className="connect-page">
      <div className="connect-main">
        <header className="connect-hero">
          <span className="connect-eyebrow">
            <AlignLeft className="h-3.5 w-3.5" aria-hidden />
            Library source
          </span>
          <h1 className="connect-title">Choose a source for this library.</h1>
          <p className="connect-subtitle">
            Verto reads .mdx and .md files from one source at a time. Start with a folder on this
            device, or connect GitHub when your notes live in a repository.
          </p>
        </header>
        <ProviderCards selected={selected} setSelected={setSelected} connection={connection} />
        <ConnectFormSection
          selected={selected}
          localFolder={localFolder}
          setLocalFolder={setLocalFolder}
          liveGitHub={liveGitHub}
          auth={auth}
          selectedMeta={selectedMeta}
          fields={fields}
          remote={remote}
          setRemote={setRemote}
          connectedHere={connectedHere}
          onSave={onSave}
        />
      </div>
      <ConnectAside
        setupSteps={setupSteps}
        previewRows={previewRows}
        connectedHere={connectedHere}
        connection={connection}
        selected={selected}
        selectedMeta={selectedMeta}
        checklist={checklist}
      />
    </div>
  );
}
