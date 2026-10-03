import { Workspace, CompanyId, InboxItem } from "@/domain/models";
import { mockWorkspace } from "@/data/mock";
import { isWorkspace } from "./validation";
export interface WorkspaceService {
  load(): Promise<Workspace>;
  save(data: Workspace): Promise<void>;
  getRevision?(): number | undefined;
}
const KEY = "kimo-os-workspace-v1";
export const workspaceService: WorkspaceService = {
  async load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (isWorkspace(data)) return data;
      }
    } catch {}
    return structuredClone(mockWorkspace);
  },
  async save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  },
};
export function topPriorities(data: Workspace, company?: CompanyId) {
  return data.actions
    .filter(
      (a) =>
        a.status === "Open" &&
        (!company ||
          data.projects.find((p) => p.id === a.project)?.company === company),
    )
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);
}
export function processInbox(
  data: Workspace,
  id: string,
  status: InboxItem["status"],
  owner = "Kimo",
): Workspace {
  const item = data.inbox.find((i) => i.id === id);
  if (!item) return data;
  const next = structuredClone(data);
  next.inbox.find((i) => i.id === id)!.status = status;
  if (
    (status === "Action" || status === "Delegate") &&
    !next.actions.some((a) => a.id === `inbox-${id}`)
  )
    next.actions.push({
      id: `inbox-${id}`,
      description: item.title,
      owner,
      dueDate: "2026-10-05",
      project: item.project,
      priority: 75,
      status: "Open",
      horizon: "This week",
    });
  if (status === "Delegate") {
    const action = next.actions.find((a) => a.id === `inbox-${id}`);
    if (action) action.owner = owner;
  }
  if (
    status === "Decision" &&
    !next.decisions.some((d) => d.id === `inbox-${id}`)
  )
    next.decisions.push({
      id: `inbox-${id}`,
      issue: item.title,
      context: item.description,
      owner: "Kimo",
      options: ["Proceed", "Request more information", "Defer"],
      deadline: "2026-10-05",
      status: "Needs Kimo",
      project: item.project,
    });
  return next;
}
