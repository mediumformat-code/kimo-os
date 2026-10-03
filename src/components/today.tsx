"use client";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CalendarDays,
  ListTodo,
  GitBranch,
  TriangleAlert,
  FolderOpen,
  Users,
  Inbox,
} from "lucide-react";
import type {
  CompanyId,
  Workspace,
  Action,
  Decision,
  Project,
  Meeting,
} from "@/domain/models";
import { topPriorities } from "@/services/workspace";
import { operatingDate } from "@/services/import-workspace";
import { placement, activeProject, companies } from "@/presentation/hierarchy";
import { Avatar, Badge, Empty } from "./ui";
import { ExecutiveBrief } from "./dashboard/executive-brief";
import { BusinessPerformance } from "./charts/business-performance";
import type { LucideIcon } from "lucide-react";
function Heading({
  icon: Icon,
  title,
  onMore,
}: {
  icon: LucideIcon;
  title: string;
  onMore: () => void;
}) {
  return (
    <div className="card-heading">
      <h2>
        <Icon size={16} />
        {title}
      </h2>
      <button onClick={onMore} className="view-all">
        View all <ArrowRight size={12} />
      </button>
    </div>
  );
}
const dateLabel = (date: string, day: string) =>
  !date || !Number.isFinite(Date.parse(date))
    ? "No deadline"
    : date === day
      ? "Today"
      : date < day
        ? "Overdue"
        : new Intl.DateTimeFormat("en", {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          }).format(new Date(date.slice(0, 10) + "T00:00:00Z"));
export function Today({
  data,
  company,
  node,
  navigate,
  open,
  complete,
  onScope,
}: {
  data: Workspace;
  company?: CompanyId;
  node?: string;
  navigate: (v: string) => void;
  open: (item: Action | Decision | Project | Meeting, kind: string) => void;
  complete: (id: string) => void;
  onScope: (c?: CompanyId, node?: string) => void;
}) {
  const project = (id: string) => data.projects.find((p) => p.id === id);
  const day = operatingDate(data);
  const priorities = topPriorities(data, company);
  const decisions = data.decisions.filter((d) => d.status === "Needs Kimo");
  const meetings = data.meetings.filter((m) => m.date.startsWith(day));
  const commitments = data.commitments
    .filter((c) => c.status === "Open")
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const risks = data.risks
    .filter((r) => r.severity === "High" || (r.deadline && r.deadline <= day))
    .slice(0, 4);
  const portfolio = data.projects.filter(activeProject);
  return (
    <div className="today-dashboard">
      <ExecutiveBrief
        data={data}
        company={company}
        node={node}
        navigate={navigate}
      />
      <div className="executive-work-grid">
        <section className="executive-card priorities-card">
          <Heading
            icon={ListTodo}
            title="Your top priorities"
            onMore={() => navigate("Priorities")}
          />
          <p className="card-kicker">Three moves. Real momentum.</p>
          {priorities.map((a, i) => {
            const p = project(a.project);
            return (
              <article className="ceo-priority" key={a.id}>
                <span className="rank-number">{i + 1}</span>
                <div>
                  <button
                    className="priority-link"
                    onClick={() => open(a, "action")}
                  >
                    {a.description}
                  </button>
                  <small>
                    {p ? placement(p).label : "Unassigned"} · {a.owner}
                  </small>
                  <small className="priority-next">
                    Next: {p?.nextAction || a.description}
                  </small>
                  <span className="priority-deadline">
                    {dateLabel(a.dueDate, day)}
                  </span>
                </div>
                <div className="priority-actions">
                  <Badge
                    tone={
                      a.priority >= 90
                        ? "red"
                        : a.priority >= 60
                          ? "amber"
                          : "green"
                    }
                  >
                    {a.priority >= 90
                      ? "High"
                      : a.priority >= 60
                        ? "Medium"
                        : "Low"}
                  </Badge>
                  <button
                    aria-label={`Complete ${a.description}`}
                    onClick={() => complete(a.id)}
                  >
                    <Check size={13} />
                  </button>
                </div>
              </article>
            );
          })}
          {!priorities.length && (
            <Empty text="No open priorities in this view." />
          )}
        </section>
        <section className="executive-card">
          <Heading
            icon={GitBranch}
            title="Decisions needed"
            onMore={() => navigate("Decisions")}
          />
          {decisions.slice(0, 3).map((d) => (
            <button
              className="executive-list-item decision-item"
              key={d.id}
              onClick={() => open(d, "decision")}
            >
              <span className="item-accent" />
              <span>
                <strong>{d.issue}</strong>
                <small>
                  {project(d.project)?.name} · {d.owner}
                </small>
                <small className="item-context">{d.context}</small>
              </span>
              <span
                className={d.deadline <= day ? "due-critical" : "item-date"}
              >
                {dateLabel(d.deadline, day)}
              </span>
              <ArrowRight size={12} />
            </button>
          ))}
          {!decisions.length && <Empty text="No decisions waiting on you." />}
        </section>
        <section className="executive-card">
          <Heading
            icon={TriangleAlert}
            title="Risks & deadlines"
            onMore={() => navigate("Projects")}
          />
          {risks.map((r) => (
            <button
              className="executive-list-item"
              key={r.id}
              onClick={() => {
                const p = project(r.project);
                if (p) open(p, "project");
              }}
            >
              <span
                className={`item-accent ${r.severity === "High" ? "critical" : "warning"}`}
              />
              <span>
                <strong>{r.description}</strong>
                <small>
                  {project(r.project)?.name} · {r.owner}
                </small>
              </span>
              <span
                className={r.severity === "High" ? "due-critical" : "item-date"}
              >
                {dateLabel(r.deadline, day)}
              </span>
            </button>
          ))}
          {!risks.length && <Empty text="No executive risks flagged." />}
        </section>
        <section className="executive-card meetings-card">
          <Heading
            icon={CalendarDays}
            title="Meetings today"
            onMore={() => navigate("Meetings")}
          />
          {meetings.slice(0, 4).map((m) => (
            <button
              className="executive-list-item meeting-item"
              key={m.id}
              onClick={() => open(m, "meeting")}
            >
              <time>
                {new Date(m.date).toLocaleTimeString("en-GB", {
                  timeZone: "Asia/Jakarta",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
              <span>
                <strong>{m.title}</strong>
                <small>{project(m.project)?.name}</small>
                <small>{m.participants.slice(0, 3).join(", ")}</small>
              </span>
              <ArrowRight size={12} />
            </button>
          ))}
          {!meetings.length && (
            <Empty text="A little room to think. No workspace meetings today." />
          )}
          <span className="wib-note">Asia/Jakarta · WIB</span>
        </section>
      </div>
      <BusinessPerformance
        data={data}
        company={company}
        node={node}
        onScope={onScope}
        navigate={navigate}
      />
      <div className="executive-bottom-grid">
        <section className="executive-card portfolio-card">
          <Heading
            icon={FolderOpen}
            title="Project portfolio"
            onMore={() => navigate("Projects")}
          />
          <div className="portfolio-groups">
            {companies
              .filter((c) => !company || c.id === company)
              .map((c) => (
                <div key={c.id}>
                  <h3>
                    {c.label}
                    <small>
                      {portfolio.filter((p) => p.company === c.id).length}{" "}
                      active projects
                    </small>
                  </h3>
                  {portfolio
                    .filter((p) => p.company === c.id)
                    .slice(0, 3)
                    .map((p) => (
                      <button
                        key={p.id}
                        className="mini-project"
                        onClick={() => open(p, "project")}
                      >
                        <span className="project-monogram">
                          {p.name
                            .replace(/[^A-Za-z]/g, "")
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                        <span>
                          <strong>{p.name}</strong>
                          <small>
                            {placement(p).group} · {p.owner}
                          </small>
                        </span>
                        <Badge
                          tone={
                            p.health === "At risk"
                              ? "red"
                              : p.health === "Watch"
                                ? "amber"
                                : "green"
                          }
                        >
                          {p.health}
                        </Badge>
                      </button>
                    ))}
                </div>
              ))}
          </div>
        </section>
        <section className="executive-card">
          <Heading
            icon={Users}
            title="People / delegation"
            onMore={() => navigate("People")}
          />
          {commitments.slice(0, 3).map((c) => (
            <button
              className="executive-list-item follow-up-item"
              key={c.id}
              onClick={() => navigate("People")}
            >
              <Avatar name={c.owner} />
              <span>
                <strong>Waiting from {c.owner}</strong>
                <small>{c.description}</small>
              </span>
              <span
                className={c.deadline <= day ? "due-critical" : "item-date"}
              >
                {dateLabel(c.deadline, day)}
              </span>
            </button>
          ))}
          {!commitments.length && (
            <Empty text="No outstanding commitments. Ownership is clear." />
          )}
        </section>
        <section className="executive-card">
          <Heading
            icon={Inbox}
            title="Inbox / actions"
            onMore={() => navigate("Inbox")}
          />
          {data.inbox
            .filter((i) => i.status === "Review")
            .slice(0, 4)
            .map((i) => (
              <button
                className="executive-list-item inbox-item"
                key={i.id}
                onClick={() => navigate("Inbox")}
              >
                <i
                  className={
                    /decision|alert|approval/i.test(i.kind)
                      ? "signal-critical"
                      : "signal-neutral"
                  }
                />
                <span>
                  <strong>{i.title}</strong>
                  <small>
                    {i.source} · {i.kind}
                  </small>
                </span>
                <ArrowUpRight size={12} />
              </button>
            ))}
          {!data.inbox.some((i) => i.status === "Review") && (
            <Empty text="You're up to date." />
          )}
        </section>
      </div>
    </div>
  );
}
