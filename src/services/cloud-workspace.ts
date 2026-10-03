import type { SupabaseClient } from "@supabase/supabase-js";
import type { Workspace } from "@/domain/models";
import { mockWorkspace } from "@/data/mock";
import type { WorkspaceService } from "./workspace";
import { isWorkspace } from "./validation";
export class WorkspaceConflictError extends Error {
  constructor() {
    super(
      "This workspace changed on another device. Reload the latest version before editing again.",
    );
    this.name = "WorkspaceConflictError";
  }
}
export interface WorkspaceStore {
  read(): Promise<{ data: unknown; revision: number } | null>;
  write(data: Workspace, expectedRevision: number): Promise<number>;
}
export function createVersionedWorkspaceService(
  store: WorkspaceStore,
): WorkspaceService {
  let revision: number | undefined;
  return {
    getRevision() {
      return revision;
    },
    async load() {
      const row = await store.read();
      if (!row) {
        revision = 0;
        return structuredClone(mockWorkspace);
      }
      if (!isWorkspace(row.data))
        throw new Error(
          "Saved workspace data is incompatible. Contact the workspace administrator.",
        );
      revision = row.revision;
      return row.data;
    },
    async save(data) {
      if (revision === undefined)
        throw new Error("Load the workspace before saving.");
      if (!isWorkspace(data))
        throw new Error("The workspace data could not be validated.");
      revision = await store.write(data, revision);
    },
  };
}
export function createCloudWorkspaceService(
  client: SupabaseClient,
  userId: string,
): WorkspaceService {
  return createVersionedWorkspaceService({
    async read() {
      const { data, error } = await client
        .from("workspaces")
        .select("data, revision")
        .eq("owner_id", userId)
        .maybeSingle();
      if (error)
        throw new Error(
          "Could not load your workspace. Check your connection and database setup.",
        );
      return data;
    },
    async write(data, expectedRevision) {
      const { data: revision, error } = await client.rpc("save_workspace", {
        workspace_data: data,
        expected_revision: expectedRevision,
      });
      if (error?.code === "40001") throw new WorkspaceConflictError();
      if (error)
        throw new Error(
          "Changes could not be saved. Check your connection and try again.",
        );
      if (typeof revision !== "number")
        throw new Error("The database returned an invalid workspace revision.");
      return revision;
    },
  });
}
