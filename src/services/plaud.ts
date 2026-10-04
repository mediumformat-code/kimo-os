import type { Workspace } from "@/domain/models";

export type PlaudScope = "studio" | "originals" | "hipmi" | "unassigned";
export interface PlaudDraft {
  id: string;
  kind: "action" | "decision";
  text: string;
  evidence: string;
  status: "Review" | "Applied" | "Rejected";
}
export interface PlaudRecording {
  id: string;
  title: string;
  recordedAt: string;
  timezone?: string;
  sourceUrl: string;
  summary: string;
  scope: PlaudScope;
  relevanceEvidence: string;
  projectId?: string;
  drafts: { kind: "action" | "decision"; text: string; evidence: string }[];
}
export interface PlaudSource extends Omit<PlaudRecording, "drafts"> {
  syncedAt: string;
  drafts: PlaudDraft[];
}
export interface PlaudSyncState {
  lastAttemptAt: string;
  lastSuccessAt?: string;
  attempts: number;
  status: "success" | "failed";
  error?: string;
  // Scheduling is external: a successful ingestion never activates it.
  automatic: false;
}
const scopes = ["studio", "originals", "hipmi", "unassigned"];
const obj = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, limit: number) =>
  typeof v === "string" && v.length <= limit;
export function parsePlaudRecording(value: unknown): PlaudRecording {
  if (
    !obj(value) ||
    !str(value.id, 100) ||
    !/^of_[a-zA-Z0-9_-]+$/.test(value.id as string) ||
    !str(value.title, 500) ||
    !value.title ||
    !str(value.summary, 200000) ||
    !value.summary ||
    !str(value.recordedAt, 100) ||
    !/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?(?:Z|[+-]\d\d:\d\d)?$/.test(
      value.recordedAt as string,
    ) ||
    !Number.isFinite(Date.parse(value.recordedAt as string)) ||
    !scopes.includes(value.scope as string) ||
    !str(value.relevanceEvidence, 5000) ||
    !str(value.sourceUrl, 2000) ||
    !Array.isArray(value.drafts) ||
    value.drafts.length > 50 ||
    (value.projectId !== undefined && !str(value.projectId, 500))
  )
    throw new Error("Rekaman Plaud tidak valid.");
  const url = new URL(value.sourceUrl as string);
  // Signed audio/storage links carry credentials and expire. Never persist them.
  if (
    url.protocol !== "https:" ||
    !["web.plaud.ai", "app.plaud.ai"].includes(url.hostname) ||
    url.username ||
    url.password ||
    /token|signature|credential|x-amz|key=/i.test(url.search + url.hash)
  )
    throw new Error(
      "Gunakan tautan aplikasi Plaud, bukan tautan audio bertoken.",
    );
  if (value.timezone !== undefined) {
    if (!str(value.timezone, 100))
      throw new Error("Zona waktu sumber tidak valid.");
    try {
      new Intl.DateTimeFormat("en", { timeZone: value.timezone as string });
    } catch {
      throw new Error("Zona waktu sumber tidak valid.");
    }
  }
  const drafts = value.drafts.map((d) => {
    if (
      !obj(d) ||
      !["action", "decision"].includes(d.kind as string) ||
      !str(d.text, 5000) ||
      !d.text ||
      !str(d.evidence, 10000) ||
      !d.evidence
    )
      throw new Error("Draft memerlukan teks dan bukti sumber.");
    return {
      kind: d.kind as "action" | "decision",
      text: d.text as string,
      evidence: d.evidence as string,
    };
  });
  // HIPMI is always isolated, including a misrouted envelope.
  const hipmi = /\bhipmi\b/i.test(value.title as string);
  const scope = hipmi ? "hipmi" : (value.scope as PlaudScope);
  if (["studio", "originals"].includes(scope) && !value.relevanceEvidence)
    throw new Error("Kaitan DD memerlukan bukti relevansi dari sumber.");
  return {
    id: value.id as string,
    title: value.title as string,
    recordedAt: value.recordedAt as string,
    sourceUrl: url.toString(),
    summary: value.summary as string,
    scope,
    relevanceEvidence: value.relevanceEvidence as string,
    ...(value.timezone ? { timezone: value.timezone as string } : {}),
    ...(value.projectId && ["studio", "originals"].includes(scope)
      ? { projectId: value.projectId as string }
      : {}),
    drafts,
  };
}
export function ingestPlaud(
  current: Workspace,
  value: unknown,
  syncedAt: string,
): Workspace {
  const recording = parsePlaudRecording(value);
  if (current.plaudSources?.some((r) => r.id === recording.id)) return current;
  const linked =
    recording.projectId &&
    current.projects.find((p) => p.id === recording.projectId);
  if (recording.projectId && (!linked || linked.company !== recording.scope))
    throw new Error(
      "Proyek tidak cocok dengan relevansi perusahaan. Review tautan terlebih dahulu.",
    );
  const next = structuredClone(current);
  const source: PlaudSource = {
    ...recording,
    syncedAt,
    drafts: recording.drafts.map((d, i) => ({
      ...d,
      id: `plaud:${recording.id}:draft:${i}`,
      status: "Review",
    })),
  };
  next.plaudSources = [...(next.plaudSources ?? []), source];
  const id = `plaud:${recording.id}`;
  next.meetings.push({
    id,
    plaudId: recording.id,
    title: recording.title,
    date: recording.recordedAt,
    source: "Plaud MCP",
    sourceUrl: recording.sourceUrl,
    ...(recording.timezone ? { sourceTimezone: recording.timezone } : {}),
    ...(["studio", "originals"].includes(recording.scope)
      ? { company: recording.scope as "studio" | "originals" }
      : {}),
    scope: recording.scope,
    summary: recording.summary,
    project: recording.projectId ?? "",
    participants: [],
    decisions: [],
    commitments: [],
    actions: [],
    risks: [],
    followUps: [],
  });
  if (linked) next.projects.find((p) => p.id === linked.id)!.meetings.push(id);
  next.plaudSync = {
    lastAttemptAt: syncedAt,
    lastSuccessAt: syncedAt,
    attempts: 1,
    status: "success",
    automatic: false,
  };
  return next;
}
export function reviewPlaudDraft(
  current: Workspace,
  sourceId: string,
  draftId: string,
  review: {
    action: "apply" | "reject";
    projectId?: string;
    owner?: string;
    deadline?: string;
  },
): Workspace {
  const next = structuredClone(current);
  const source = next.plaudSources?.find((s) => s.id === sourceId);
  const draft = source?.drafts.find((d) => d.id === draftId);
  if (!source || !draft || draft.status !== "Review") return current;
  if (review.action === "reject") {
    draft.status = "Rejected";
    return next;
  }
  const project = next.projects.find(
    (p) => p.id === (review.projectId || source.projectId),
  );
  if (
    !project ||
    !["studio", "originals"].includes(source.scope) ||
    project.company !== source.scope
  )
    throw new Error(
      "Pilih proyek DD yang sesuai sebelum menerapkan draft. HIPMI tetap terpisah.",
    );
  const owner = review.owner?.trim() ?? "",
    deadline = review.deadline?.trim() ?? "";
  if (deadline && !/^\d{4}-\d\d-\d\d$/.test(deadline))
    throw new Error("Deadline tidak valid.");
  const meeting = next.meetings.find((m) => m.plaudId === sourceId);
  if (draft.kind === "action") {
    next.actions.push({
      id: draft.id,
      description: draft.text,
      owner,
      dueDate: deadline,
      project: project.id,
      priority: 50,
      status: "Open",
      horizon: "Later",
      sourceRef: `plaud:${source.id}`,
    });
    meeting?.actions.push(draft.id);
  } else {
    next.decisions.push({
      id: draft.id,
      issue: draft.text,
      context: `${draft.evidence}\n${source.sourceUrl}\nPlaud ID: ${source.id}`,
      owner,
      deadline,
      project: project.id,
      options: [],
      status: "Needs Kimo",
    });
    meeting?.decisions.push(draft.id);
  }
  draft.status = "Applied";
  return next;
}

export interface PlaudStore {
  read(): Promise<{ data: Workspace; revision: number }>;
  write(data: Workspace, revision: number): Promise<boolean>;
}
export async function syncPlaud(
  store: PlaudStore,
  recording: unknown,
  now = () => new Date().toISOString(),
  sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
) {
  const validated = parsePlaudRecording(recording);
  let attempts = 0;
  for (; attempts < 3; attempts++) {
    try {
      const row = await store.read();
      const next = ingestPlaud(row.data, validated, now());
      if (next === row.data)
        return {
          status: "duplicate" as const,
          id: validated.id,
          attempts: attempts + 1,
        };
      next.plaudSync!.attempts = attempts + 1;
      if (await store.write(next, row.revision))
        return {
          status: "synced" as const,
          id: validated.id,
          attempts: attempts + 1,
        };
    } catch (error) {
      // Invalid relationships are deterministic: do not retry them.
      if (
        error instanceof Error &&
        error.message.startsWith("Proyek tidak cocok")
      )
        throw error;
    }
    if (attempts < 2) await sleep(250 * 2 ** attempts);
  }
  // Best effort: an unavailable DB cannot itself persist an outage.
  try {
    const row = await store.read();
    await store.write(
      {
        ...row.data,
        plaudSync: {
          ...row.data.plaudSync,
          automatic: false,
          lastAttemptAt: now(),
          attempts,
          status: "failed",
          error:
            "Sync gagal setelah 3 percobaan. Kirim ulang ID yang sama untuk retry.",
        },
      },
      row.revision,
    );
  } catch {
    /* Caller retains the failed recording for retry. */
  }
  throw new Error(
    "Sync gagal setelah 3 percobaan. Data rekaman belum dikonfirmasi tersimpan.",
  );
}
