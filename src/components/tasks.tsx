"use client";
import { useState } from "react";
import { Check } from "lucide-react";
import type { Action, Workspace, CompanyId } from "@/domain/models";
import { operatingDate } from "@/services/import-workspace";
import { overdue, taskStatus, visibleTasks } from "@/services/business-views";
import { Badge, Empty } from "./ui";
export function Tasks({
  data,
  company,
  open,
  complete,
}: {
  data: Workspace;
  company?: CompanyId;
  open: (item: Action, kind: string) => void;
  complete: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Open");
  const [project, setProject] = useState("");
  const [owner, setOwner] = useState("");
  const day = operatingDate(data);
  const tasks = visibleTasks(data, company);
  const filtered = tasks
    .filter(
      (a) =>
        (status === "All" ||
          (status === "Open" && a.status === "Open") ||
          (status === "Overdue" && overdue(a, day)) ||
          taskStatus(a) === status) &&
        (!project || a.project === project) &&
        (!owner || a.owner === owner) &&
        [
          a.description,
          a.owner,
          data.projects.find((p) => p.id === a.project)?.name,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort(
      (a, b) =>
        Number(overdue(b, day)) - Number(overdue(a, day)) ||
        b.priority - a.priority,
    );
  return (
    <div className="view-stack">
      <section className="panel detail-card">
        <h2>Tasks</h2>
        <p>
          {tasks.filter((a) => a.status === "Open").length} open ·{" "}
          {tasks.filter((a) => overdue(a, day)).length} overdue ·{" "}
          {tasks.filter((a) => a.status === "Done").length} done
        </p>
        <div className="business-filters">
          <label className="field-label">
            Search tasks
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Task, PIC, project"
            />
          </label>
          <label className="field-label">
            Task status
            <select
              aria-label="Task status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              {[
                ...new Set([
                  "Open",
                  "All",
                  "Overdue",
                  "Done",
                  ...tasks.map(taskStatus),
                ]),
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Task project
            <select
              aria-label="Task project"
              value={project}
              onChange={(e) => setProject(e.target.value)}
            >
              <option value="">All projects</option>
              {data.projects
                .filter((p) => tasks.some((a) => a.project === p.id))
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field-label">
            Task PIC
            <select
              aria-label="Task PIC"
              value={owner}
              onChange={(e) => setOwner(e.target.value)}
            >
              <option value="">All PICs</option>
              {[...new Set(tasks.map((a) => a.owner))].sort().map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        </div>
        <p>
          Perubahan disimpan ke KIMO OS. Status sheet asli ditampilkan sebagai
          sumber; Google Sheets tidak berubah otomatis.
        </p>
      </section>
      <section className="panel">
        {filtered.length === 0 ? (
          <Empty text="No tasks match these filters." />
        ) : (
          filtered.map((a) => (
            <div
              className={`list-row ${a.status === "Done" ? "done" : ""}`}
              key={a.id}
            >
              <button
                className="check-button"
                disabled={a.status === "Done"}
                aria-label={`Complete ${a.description}`}
                onClick={() => complete(a.id)}
              >
                {a.status === "Done" && <Check size={15} />}
              </button>
              <button className="row-body" onClick={() => open(a, "action")}>
                <strong>{a.description}</strong>
                <small>
                  {data.projects.find((p) => p.id === a.project)?.name} ·{" "}
                  {a.owner}
                </small>
                <small>
                  {a.dueDate ? `Due ${a.dueDate}` : "No deadline in source"}
                </small>
              </button>
              <Badge tone={overdue(a, day) ? "amber" : ""}>
                {overdue(a, day) ? "Overdue · " : ""}
                {taskStatus(a)}
              </Badge>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
