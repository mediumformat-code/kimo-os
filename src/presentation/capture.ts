import type { Workspace, Project, Meeting } from "@/domain/models";

/** ChatGPT exports do not reliably carry Project membership: users choose it. */
export function captureText(input: string): string {
  const text = input.trim();
  if (!text) throw new Error("Tambahkan file atau transkrip terlebih dahulu.");
  if (!text.startsWith("{") && !text.startsWith("[")) return text;
  const parsed = JSON.parse(text);
  const conversations = Array.isArray(parsed) ? parsed : [parsed];
  const result = conversations
    .map((conversation) => {
      if (typeof conversation.transcript === "string")
        return conversation.transcript;
      if (typeof conversation.text === "string") return conversation.text;
      const mapping = conversation.mapping;
      if (!mapping || typeof mapping !== "object")
        throw new Error(
          "JSON belum dikenali. Gunakan export ChatGPT conversations.json atau transkrip TXT/MD.",
        );
      // Follow only the active branch; edited alternative messages are not duplicated.
      const nodes = [];
      const seen = new Set<string>();
      let key = conversation.current_node;
      while (key && mapping[key] && !seen.has(key)) {
        seen.add(key);
        nodes.unshift(mapping[key]);
        key = mapping[key].parent;
      }
      if (!nodes.length)
        throw new Error(
          "Percakapan tidak memiliki branch aktif. Export transkrip sebagai TXT/MD.",
        );
      const messages = nodes
        .map((node) => {
          const message = node.message;
          const parts =
            message?.content?.parts?.filter(
              (part: unknown) => typeof part === "string",
            ) ?? [];
          return parts.length
            ? `${message.author?.role ?? "message"}: ${parts.join("\n")}`
            : "";
        })
        .filter(Boolean);
      return `${conversation.title ?? "ChatGPT conversation"}\n\n${messages.join("\n\n")}`;
    })
    .join("\n\n---\n\n");
  if (!result.trim()) throw new Error("Tidak ada teks yang dapat diimpor.");
  return result;
}

export function appendCapture(
  data: Workspace,
  options: {
    kind: "Plaud" | "GPT Projects";
    title: string;
    text: string;
    projectId?: string;
    company: "studio" | "originals";
    owner: string;
    date: string;
    actions: string[];
  },
  uuid: () => string = () => crypto.randomUUID(),
): Workspace {
  if (
    !options.title.trim() ||
    !options.owner.trim() ||
    !Number.isFinite(Date.parse(options.date))
  )
    throw new Error("Isi judul, owner, dan tanggal yang valid.");
  if (
    options.projectId &&
    !data.projects.some((p) => p.id === options.projectId)
  )
    throw new Error("Proyek sudah berubah. Baca ulang workspace.");
  const transcript = captureText(options.text);
  const linked = data.projects.find((p) => p.id === options.projectId);
  if (
    data.meetings.some(
      (m) =>
        m.source === `${options.kind} import` &&
        m.summary === transcript &&
        (linked ? m.project === linked.id : m.title === options.title.trim()),
    )
  )
    throw new Error("Sumber ini sudah diimpor.");
  const project: Project = linked ?? {
    id: uuid(),
    name: options.title.trim(),
    company: options.company,
    owner: options.owner.trim(),
    status: "Planning",
    priority: 50,
    deadline: "",
    health: "Watch",
    latestUpdate: "Source imported; review project details.",
    nextAction: options.actions[0] ?? "Review imported source",
    blockers: [],
    people: [],
    meetings: [],
    documents: [],
  };
  const actions = options.actions
    .map((s) => s.trim())
    .filter(Boolean)
    .map((description) => ({
      id: uuid(),
      description,
      owner: options.owner.trim(),
      dueDate: "",
      project: project.id,
      priority: 50,
      status: "Open" as const,
      horizon: "Later" as const,
    }));
  const meeting: Meeting = {
    id: uuid(),
    title: options.title.trim(),
    participants: [options.owner.trim()],
    date: options.date,
    source: `${options.kind} import`,
    summary: transcript,
    project: project.id,
    decisions: [],
    commitments: [],
    actions: actions.map((a) => a.id),
    risks: [],
    followUps: [],
  };
  return {
    ...data,
    projects: linked
      ? data.projects.map((p) =>
          p.id === project.id
            ? { ...p, meetings: [...p.meetings, meeting.id] }
            : p,
        )
      : [...data.projects, { ...project, meetings: [meeting.id] }],
    meetings: [...data.meetings, meeting],
    actions: [...data.actions, ...actions],
  };
}
