import {
  ArrowRight,
  ArrowUpRight,
  Check,
  Clock3,
  TriangleAlert,
  Sparkles,
  CircleDollarSign,
} from "lucide-react";
import {
  CompanyId,
  Workspace,
  Action,
  Decision,
  Project,
  Meeting,
} from "@/domain/models";
import { operatingDate } from "@/services/import-workspace";
import { topPriorities } from "@/services/workspace";
import { Avatar, Badge, Empty, SectionTitle } from "./ui";
export function Today({
  data,
  company,
  navigate,
  open,
  complete,
}: {
  data: Workspace;
  company?: CompanyId;
  navigate: (view: string) => void;
  open: (item: Action | Decision | Project | Meeting, kind: string) => void;
  complete: (id: string) => void;
}) {
  const project = (id: string) => data.projects.find((p) => p.id === id)!;
  const scoped = (id: string) => !company || project(id)?.company === company;
  const day = operatingDate(data);
  const live = data.metadata?.dataset === "live";
  const cashRisk = data.risks.find((r) =>
    /cash|collections|invoice|piutang|kas|finance/i.test(r.description),
  );
  const priorities = topPriorities(data, company);
  const decisions = data.decisions.filter(
    (d) => d.status === "Needs Kimo" && scoped(d.project),
  );
  const meetings = data.meetings.filter(
    (m) => m.date.startsWith(day) && scoped(m.project),
  );
  const risks = data.risks.filter((r) => scoped(r.project));
  const commitments = data.commitments.filter(
    (c) => c.status === "Open" && scoped(c.project),
  );
  return (
    <>
      <div className="brief">
        <div className="brief-icon">
          <Sparkles size={19} />
        </div>
        <div>
          <div className="eyebrow">
            YOUR CEO BRIEF{" "}
            <span>· {live ? "WORKSPACE DATA" : "SAMPLE DATA"}</span>
          </div>
          <p>
            {decisions.length
              ? `${decisions.length} decisions need your direction.`
              : "Your decision inbox is clear."}{" "}
            {risks.length
              ? `${risks.length} exceptions to keep in view.`
              : "No flagged risks in this view."}
            <br />
            <span>
              {company
                ? "A focused view of what matters in this business."
                : live
                  ? priorities.length
                    ? priorities.map((a) => a.description).join(" · ")
                    : "Tambahkan tindakan dan komitmen untuk membentuk prioritas CEO."
                  : "Focus on the venue lease, Q4 programming, and cash collections. The rest is moving."}
            </span>
          </p>
        </div>
        <span className="brief-stamp">
          Prepared for you<small>{day}</small>
        </span>
      </div>
      <div className="section-title priorities-heading">
        <h2>
          Your top priorities <span className="muted">/</span>{" "}
          <span className="heading-note">Move these forward today.</span>
        </h2>
        <button className="text-button" onClick={() => navigate("Priorities")}>
          All priorities
          <ArrowUpRight size={14} />
        </button>
      </div>
      <div className="priority-grid">
        {priorities.map((a, i) => (
          <article className="priority-card" key={a.id}>
            <div className="card-top">
              <span className="priority-number">0{i + 1}</span>
              <Badge tone={i === 0 ? "red" : "amber"}>
                {i === 0 ? "High impact" : "Needs attention"}
              </Badge>
              <button
                aria-label={`Complete ${a.description}`}
                className="complete-button"
                onClick={() => complete(a.id)}
              >
                <Check size={15} />
              </button>
            </div>
            <button className="card-title" onClick={() => open(a, "action")}>
              {a.description}
            </button>
            <p>{project(a.project)?.latestUpdate}</p>
            <div className="priority-footer">
              <span className={`company-dot ${project(a.project)?.company}`} />
              <span>
                {
                  data.companies.find(
                    (c) => c.id === project(a.project)?.company,
                  )?.name
                }
              </span>
              <button
                aria-label={`Open ${a.description}`}
                onClick={() => open(a, "action")}
              >
                <ArrowUpRight size={17} />
              </button>
            </div>
          </article>
        ))}
        {!priorities.length && (
          <Empty
            text={
              data.actions.length
                ? "All priorities are complete. A little room to think."
                : "Belum ada prioritas. Impor tindakan atau komitmen dari sumber asli."
            }
          />
        )}
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-main">
          <section className="panel">
            <SectionTitle
              title="Decisions waiting on you"
              count={decisions.length}
              action="Decision inbox"
              onAction={() => navigate("Decisions")}
            />
            {decisions.slice(0, 3).map((d) => (
              <button
                className="decision-row"
                key={d.id}
                onClick={() => open(d, "decision")}
              >
                <span className="decision-glyph">
                  <ArrowUpRight size={18} />
                </span>
                <span className="row-body">
                  <strong>{d.issue}</strong>
                  <small>
                    {project(d.project)?.name} <span>·</span>{" "}
                    {d.deadline === day
                      ? "Due today"
                      : `Due ${d.deadline || "not set"}`}
                  </small>
                </span>
                <Badge tone={d.deadline === day ? "amber" : ""}>
                  {d.deadline === day ? "Today" : "This week"}
                </Badge>
                <ArrowRight size={16} />
              </button>
            ))}
            {!decisions.length && <Empty text="No decisions waiting on you." />}
          </section>
          <section className="panel portfolio">
            <SectionTitle
              title="Across the group"
              action="View portfolio"
              onAction={() => navigate("Projects")}
            />
            <div className="portfolio-header">
              <span>PROJECT</span>
              <span>HEALTH</span>
              <span>OWNER</span>
            </div>
            {data.projects
              .filter(
                (p) =>
                  (!company || p.company === company) &&
                  (live ||
                    ["medium", "commons", "ggi", "finance"].includes(p.id)),
              )
              .slice(0, 4)
              .map((p) => (
                <button
                  className="portfolio-row"
                  key={p.id}
                  onClick={() => open(p, "project")}
                >
                  <span>
                    <strong>{p.name}</strong>
                    <small>{p.nextAction}</small>
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
                    <span className="status-dot" />
                    {p.health}
                  </Badge>
                  <span className="owner-name">
                    <Avatar name={p.owner} />
                    {p.owner}
                  </span>
                </button>
              ))}
          </section>
          {cashRisk && (
            <section className="cash-note">
              <CircleDollarSign size={20} />
              <div>
                <strong>Cash needs a closer look</strong>
                <p>
                  {cashRisk.description} · {cashRisk.owner}
                </p>
              </div>
              <button
                aria-label="Open finance exception"
                onClick={() => open(project(cashRisk.project), "project")}
              >
                <ArrowUpRight size={18} />
              </button>
            </section>
          )}
        </div>
        <aside className="dashboard-side">
          <section className="panel schedule">
            <SectionTitle title="On your calendar" count={meetings.length} />
            <div className="date-label">
              TODAY · {day} <span>WIB</span>
            </div>
            {meetings.map((m, i) => (
              <button
                className="meeting-row"
                key={m.id}
                onClick={() => open(m, "meeting")}
              >
                <div className="meeting-time">
                  {new Date(m.date).toLocaleTimeString("en-GB", {
                    timeZone: "Asia/Jakarta",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  <small>{i === 0 ? "30 min" : "45 min"}</small>
                </div>
                <div className="meeting-line" />
                <div>
                  <strong>{m.title}</strong>
                  <small>{m.participants.join(", ")}</small>
                  <span className="meeting-location">
                    {i === 0 ? "Google Meet" : "Double Deer HQ"}
                  </span>
                </div>
              </button>
            ))}
            {!meetings.length && (
              <Empty text="No meetings in this view today." />
            )}
            <button className="wide-link" onClick={() => navigate("Meetings")}>
              View all meetings
              <ArrowRight size={14} />
            </button>
          </section>
          <section className="panel risks">
            <SectionTitle title="Keep an eye on" />
            <div className="side-list">
              {risks.map((r) => (
                <button
                  className="risk-row"
                  key={r.id}
                  onClick={() => open(project(r.project), "project")}
                >
                  <TriangleAlert
                    size={17}
                    className={r.severity === "High" ? "danger" : "warning"}
                  />
                  <div>
                    <strong>{r.description}</strong>
                    <small>
                      {project(r.project)?.name} · {r.owner}
                    </small>
                  </div>
                </button>
              ))}
            </div>
            {!risks.length && <Empty text="No flagged risks." />}
          </section>
          <section className="panel waiting">
            <SectionTitle
              title="Waiting for"
              action="People"
              onAction={() => navigate("People")}
            />
            {commitments.slice(0, 2).map((c) => (
              <button
                className="waiting-row"
                key={c.id}
                onClick={() => navigate("People")}
              >
                <Avatar name={c.owner} />
                <div>
                  <strong>{c.owner}</strong>
                  <small>{c.description}</small>
                </div>
                {c.deadline < day ? (
                  <Badge tone="red">Overdue</Badge>
                ) : (
                  <Clock3 size={15} className="muted" />
                )}
              </button>
            ))}
          </section>
        </aside>
      </div>
    </>
  );
}
