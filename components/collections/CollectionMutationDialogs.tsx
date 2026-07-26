"use client";

import type React from "react";
import type { Collection } from "@/lib/collections";
import { CollectionDeleteDialog } from "@/components/collections/CollectionDeleteDialog";
import { CollectionDialog } from "@/components/collections/CollectionDialog";

export function CollectionMutationDialogs({
  create,
  rename,
  remove,
}: {
  create: {
    open: boolean;
    name: string;
    pending: boolean;
    error: string | null;
    onNameChange: (value: string) => void;
    onOpenChange: (open: boolean) => void;
    onSubmit: (event: React.FormEvent) => void;
  };
  rename: {
    target: Collection | null;
    name: string;
    pending: boolean;
    error: string | null;
    onNameChange: (value: string) => void;
    onOpenChange: (open: boolean) => void;
    onSubmit: (event: React.FormEvent) => void;
  };
  remove: {
    target: Collection | null;
    pending: boolean;
    error: string | null;
    onClose: () => void;
    onConfirm: () => void;
  };
}) {
  return (
    <>
      <CollectionDialog
        open={create.open}
        title="New collection"
        description="Create a named collection for documents you want to revisit together."
        label="Collection name"
        inputId="collection-create-name"
        name={create.name}
        submitLabel="Create"
        pendingLabel="Creating"
        pending={create.pending}
        error={create.error}
        onNameChange={create.onNameChange}
        onOpenChange={create.onOpenChange}
        onSubmit={create.onSubmit}
      />
      <CollectionDialog
        open={rename.target !== null}
        title="Rename collection"
        description="Change the collection name without changing the documents inside it."
        label="Collection name"
        inputId="collection-rename-name"
        name={rename.name}
        submitLabel="Save"
        pendingLabel="Saving"
        pending={rename.pending}
        error={rename.error}
        onNameChange={rename.onNameChange}
        onOpenChange={rename.onOpenChange}
        onSubmit={rename.onSubmit}
      />
      <CollectionDeleteDialog
        target={remove.target}
        pending={remove.pending}
        error={remove.error}
        onClose={remove.onClose}
        onConfirm={remove.onConfirm}
      />
    </>
  );
}
