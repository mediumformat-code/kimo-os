import {
  ArrowUpRight,
  Check,
  Search,
  Archive,
  UserRound,
  ListPlus,
  GitBranch,
} from "lucide-react";
import {
  Workspace,
  CompanyId,
  Action,
  Decision,
  Project,
  Meeting,
  InboxItem,
} from "@/domain/models";
import { Avatar, Badge, Empty, SectionTitle } from "./ui";
import { AiChat } from "./ai-chat";
import { operatingDate } from "@/services/import-workspace";
import { GoogleConnection } from "./google/workspace";
import { plannedIntegrations } from "@/integrations/adapters";
import { useState } from "react";
type Props = {
  view: string;
  data: Workspace;
  company?: CompanyId;
  open: (item: Action | Decision | Project | Meeting, kind: string) => void;
  complete: (id: string) => void;
  triage: (id: string, status: InboxItem["status"]) => void;
  delegate: (id: string) => void;
  commitmentDone: (id: string) => void;
  reset: () => void;
  cloud?: boolean;
  email?: string;
  onSignOut?: () => void;
  refresh: () => void;
  googleNavigate: () => void;
};
export function WorkspaceViews({
  view,
  data,
  company,
  open,
  complete,
  triage,
  delegate,
  commitmentDone,
  reset,
  cloud = false,
  email,
  onSignOut,
  refresh,
  googleNavigate,
}: Props) {
  const day = operatingDate(data);
  const [tab, setTab] = useState("Needs Kimo");
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const project = (id: string) => data.projects.find((p) => p.id === id)!;
  const scoped = (id: string) => !company || project(id)?.company === company;
  if (view === "Priorities")
    return (
      <div className="view-stack">
        {(["Today", "This week", "Later"] as const).map((h) => (
          <section className="panel" key={h}>
            <SectionTitle
              title={h}
              count={
                data.actions.filter(
                  (a) =>
                    a.horizon === h && a.status === "Open" && scoped(a.project),
                ).length
              }
            />
            {data.actions
              .filter((a) => a.horizon === h && scoped(a.project))
              .map((a) => (
                <div
                  className={`list-row ${a.status === "Done" ? "done" : ""}`}
                  key={a.id}
                >
                  <button
                    className="check-button"
                    aria-label={`Complete ${a.description}`}
                    onClick={() => complete(a.id)}
                  >
                    {a.status === "Done" && <Check size={15} />}
                  </button>
                  <button
                    className="row-body"
                    onClick={() => open(a, "action")}
                  >
                    <strong>{a.description}</strong>
                    <small>
                      {project(a.project)?.name} · {a.owner} · Due {a.dueDate}
                    </small>
                  </button>
                  <Badge tone={a.priority > 90 ? "amber" : ""}>
                    {a.status === "Done"
                      ? "Done"
                      : a.priority > 90
                        ? "High priority"
                        : "Normal"}
                  </Badge>
                </div>
              ))}
          </section>
        ))}
      </div>
    );
  if (view === "Decisions")
    return (
      <>
        <div className="tabs">
          {["Needs Kimo", "Waiting for others", "Decided"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
              <span>
                {
                  data.decisions.filter(
                    (d) => d.status === t && scoped(d.project),
                  ).length
                }
              </span>
            </button>
          ))}
        </div>
        <div className="view-stack">
          {data.decisions
            .filter((d) => d.status === tab && scoped(d.project))
            .map((d) => (
              <article className="panel detail-card" key={d.id}>
                <div className="card-top">
                  <Badge>{project(d.project)?.name}</Badge>
                  <span className="muted">Due {d.deadline}</span>
                </div>
                <h2>{d.issue}</h2>
                <p>{d.context}</p>
                <div className="card-bottom">
                  <span>
                    <Avatar name={d.owner} /> {d.owner}
                  </span>
                  {d.finalDecision ? (
                    <Badge tone="green">{d.finalDecision}</Badge>
                  ) : (
                    <button
                      className="primary-button"
                      onClick={() => open(d, "decision")}
                    >
                      Review decision
                      <ArrowUpRight size={15} />
                    </button>
                  )}
                </div>
              </article>
            ))}
          {!data.decisions.some(
            (d) => d.status === tab && scoped(d.project),
          ) && <Empty text="Nothing waiting here. You're up to date." />}
        </div>
      </>
    );
  if (view === "Projects")
    return (
      <div className="view-stack">
        {data.companies
          .filter((c) => !company || c.id === company)
          .map((c) => (
            <section key={c.id}>
              <SectionTitle
                title={c.name}
                count={data.projects.filter((p) => p.company === c.id).length}
              />
              <div className="project-grid">
                {data.projects
                  .filter((p) => p.company === c.id)
                  .map((p) => (
                    <button
                      className="panel project-card"
                      key={p.id}
                      onClick={() => open(p, "project")}
                    >
                      <div className="card-top">
                        <span className={`company-dot ${c.id}`} />
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
                      </div>
                      <h2>{p.name}</h2>
                      <p>{p.latestUpdate}</p>
                      <div className="project-next">
                        <span className="eyebrow">NEXT ACTION</span>
                        <strong>{p.nextAction}</strong>
                      </div>
                      <div className="card-bottom">
                        <span>
                          <Avatar name={p.owner} />
                          {p.owner}
                        </span>
                        <ArrowUpRight size={17} />
                      </div>
                    </button>
                  ))}
              </div>
            </section>
          ))}
      </div>
    );
  if (view === "People")
    return (
      <div className="project-grid">
        {data.people
          .filter((p) => !company || p.company === company)
          .map((p) => (
            <article className="panel person-card" key={p.id}>
              <div className="person-top">
                <Avatar name={p.name} />
                <div>
                  <h2>{p.name}</h2>
                  <p>{p.role}</p>
                </div>
              </div>
              <span className="eyebrow">RESPONSIBLE FOR</span>
              <div className="tag-list">
                {p.projects.map((id) => (
                  <button key={id} onClick={() => open(project(id), "project")}>
                    <Badge>{project(id)?.name}</Badge>
                  </button>
                ))}
              </div>
              <span className="eyebrow">COMMITMENTS & FOLLOW-UPS</span>
              {data.commitments
                .filter((c) => c.owner === p.name)
                .map((c) => (
                  <div className="person-commitment" key={c.id}>
                    <span>
                      {c.description}
                      <small>
                        {c.source} · Due {c.deadline}
                      </small>
                    </span>
                    <button
                      className="check-button"
                      aria-label={`Complete commitment: ${c.description}`}
                      onClick={() => commitmentDone(c.id)}
                    >
                      {c.status === "Done" ? <Check size={14} /> : null}
                    </button>
                  </div>
                ))}
              {!data.commitments.some((c) => c.owner === p.name) && (
                <p className="muted">No outstanding commitments.</p>
              )}
              <div className="person-actions">
                {data.actions
                  .filter((a) => a.owner === p.name && a.status === "Open")
                  .map((a) => (
                    <button key={a.id} onClick={() => open(a, "action")}>
                      {a.description}
                      <ArrowUpRight size={13} />
                    </button>
                  ))}
              </div>
              <p className="person-date">
                Last interaction {p.lastInteraction}
                <br />
                Next expected update {p.nextUpdate}
              </p>
              <button
                className="secondary-button"
                onClick={() => delegate(p.name)}
              >
                Delegate an action
                <ArrowUpRight size={14} />
              </button>
            </article>
          ))}
      </div>
    );
  if (view === "Meetings")
    return (
      <div className="view-stack">
        {[
          "Upcoming",
          "Recent",
          ...(!company ? ["HIPMI", "Unassigned"] : []),
        ].map((group) => (
          <section key={group}>
            <SectionTitle title={group} />
            {data.meetings
              .filter((m) =>
                group === "HIPMI"
                  ? m.scope === "hipmi"
                  : group === "Unassigned"
                    ? m.scope === "unassigned"
                    : m.scope !== "hipmi" &&
                      m.scope !== "unassigned" &&
                      (!company ||
                        m.company === company ||
                        scoped(m.project)) &&
                      (group === "Upcoming"
                        ? m.date.slice(0, 10) >= day
                        : m.date.slice(0, 10) < day),
              )
              .map((m) => (
                <button
                  className="panel meeting-card"
                  key={m.id}
                  onClick={() => open(m, "meeting")}
                >
                  <div className="meeting-date">
                    <strong>
                      {m.plaudId
                        ? m.date.slice(0, 10)
                        : new Date(m.date).toLocaleDateString("en-GB", {
                            timeZone: "Asia/Jakarta",
                            day: "2-digit",
                            month: "short",
                          })}
                    </strong>
                    <span>
                      {m.plaudId ? (
                        `${m.date.slice(11)} ${m.sourceTimezone ?? "Zona waktu tidak tersedia"}`
                      ) : (
                        <>
                          {new Date(m.date).toLocaleTimeString("en-GB", {
                            timeZone: "Asia/Jakarta",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}{" "}
                          WIB
                        </>
                      )}
                    </span>
                  </div>
                  <div className="row-body">
                    <h2>{m.title}</h2>
                    <p>{m.summary}</p>
                    <small>
                      {m.participants.join(" · ")} <span> / </span> {m.source}
                    </small>
                  </div>
                  <Badge>
                    {m.followUps.length} follow-up
                    {m.followUps.length !== 1 ? "s" : ""}
                  </Badge>
                  <ArrowUpRight size={17} />
                </button>
              ))}
          </section>
        ))}
      </div>
    );
  if (view === "Inbox")
    return (
      <>
        <div className="inbox-toolbar">
          <span>
            {
              data.inbox.filter(
                (i) => i.status === "Review" && scoped(i.project),
              ).length
            }{" "}
            items need a review
          </span>
          <button
            className="secondary-button"
            onClick={() => setShowArchived(!showArchived)}
          >
            {showArchived ? "Hide archived" : "Show archived"}
          </button>
        </div>
        <div className="view-stack">
          {data.inbox
            .filter(
              (i) =>
                scoped(i.project) && (showArchived || i.status !== "Archived"),
            )
            .map((i) => (
              <article className="panel detail-card" key={i.id}>
                <div className="card-top">
                  <Badge tone={i.kind === "Cash alert" ? "amber" : ""}>
                    {i.kind}
                  </Badge>
                  <small>
                    {i.source} · {project(i.project)?.name}
                  </small>
                  <Badge>{i.status}</Badge>
                </div>
                <h2>{i.title}</h2>
                <p>{i.description}</p>
                {i.status === "Review" && (
                  <div className="inbox-actions">
                    <button onClick={() => delegate(i.id)}>
                      <UserRound size={14} />
                      Delegate
                    </button>
                    <button onClick={() => triage(i.id, "Action")}>
                      <ListPlus size={14} />
                      Convert to action
                    </button>
                    <button onClick={() => triage(i.id, "Decision")}>
                      <GitBranch size={14} />
                      Convert to decision
                    </button>
                    <button onClick={() => triage(i.id, "Archived")}>
                      <Archive size={14} />
                      Archive
                    </button>
                  </div>
                )}
                {i.status !== "Review" && (
                  <button
                    className="text-button"
                    onClick={() => triage(i.id, "Review")}
                  >
                    Return to review
                  </button>
                )}
              </article>
            ))}
        </div>
      </>
    );
  if (view === "Search") {
    const normalized = query.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    const tokens = normalized
      .split(" ")
      .filter(
        (t) =>
          t.length > 2 &&
          ![
            "what",
            "the",
            "are",
            "from",
            "with",
            "show",
            "all",
            "about",
            "happening",
            "waiting",
            "needs",
          ].includes(t),
      );
    const overdue = normalized.includes("overdue");
    const approval = normalized.includes("approval");
    const matches = (text: string) =>
      tokens.some((t) => text.toLowerCase().includes(t));
    const results = [
      ...data.projects
        .filter(
          (p) =>
            scoped(p.id) &&
            !overdue &&
            !approval &&
            matches(p.name + " " + p.latestUpdate + " " + p.owner),
        )
        .map((p) => ({
          id: p.id,
          title: p.name,
          description: p.latestUpdate,
          kind: "Project",
          run: () => open(p, "project"),
        })),
      ...data.commitments
        .filter(
          (c) =>
            scoped(c.project) &&
            c.status === "Open" &&
            (overdue
              ? c.deadline < day
              : !approval && matches(c.owner + " " + c.description)),
        )
        .map((c) => ({
          id: c.id,
          title: c.description,
          description: `${c.owner} · Due ${c.deadline} · ${c.source}`,
          kind: "Commitment",
          run: () => open(project(c.project), "project"),
        })),
      ...data.decisions
        .filter(
          (d) =>
            scoped(d.project) &&
            (approval
              ? d.status === "Needs Kimo"
              : !overdue && matches(d.issue + " " + d.context + " " + d.owner)),
        )
        .map((d) => ({
          id: d.id,
          title: d.issue,
          description: d.context,
          kind: "Decision",
          run: () => open(d, "decision"),
        })),
    ];
    return (
      <>
        <AiChat cloud={cloud} />
        <section className="search-view">
          <div className="search-symbol">
            <Search size={26} />
          </div>
          <h2>
            A little less searching.
            <br />A little more clarity.
          </h2>
          <p>
            Search your workspace for projects, people, commitments, and
            decisions.
          </p>
          <div className="search-field">
            <Search size={19} />
            <input
              autoFocus
              placeholder="What are you looking for?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <kbd>↵</kbd>
          </div>
          <div className="search-suggestions">
            {[
              "What commitments need follow-up?",
              "What needs my approval?",
              "Show all overdue commitments",
              "What’s happening with Medium Format?",
            ].map((q) => (
              <button key={q} onClick={() => setQuery(q)}>
                {q}
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
          <small className="search-disclaimer">
            Local workspace search · AI answers will be added in a future
            milestone.
          </small>
          {query && (
            <div className="search-results">
              <SectionTitle title="Workspace matches" count={results.length} />
              {results.map((r) => (
                <button className="panel result-row" key={r.id} onClick={r.run}>
                  <Badge>{r.kind}</Badge>
                  <strong>{r.title}</strong>
                  <p>{r.description}</p>
                  <ArrowUpRight size={16} />
                </button>
              ))}
              {!results.length && (
                <Empty text="No matches. Try a project name, a person, or “overdue”." />
              )}
            </div>
          )}
        </section>
      </>
    );
  }
  return (
    <div className="view-stack">
      <section className="panel detail-card">
        <h2>Your workspace</h2>
        <p>Kimo Rizky · Double Deer Group</p>
        <Badge>
          {cloud
            ? data.metadata?.dataset === "live"
              ? "Cloud connected · Imported workspace"
              : "Cloud connected · Sample business data"
            : "Prototype · Sample data"}
        </Badge>
        <p>
          {cloud
            ? "Changes are saved to your private cloud workspace."
            : "Changes are saved in this browser."}{" "}
          {data.metadata?.dataset === "live"
            ? "Dates and meeting times use Asia/Jakarta."
            : "The sample brief is anchored to 3 October 2026, with meeting times in Asia/Jakarta."}
        </p>
      </section>
      <section className="panel detail-card">
        <h2>{cloud ? "Account & synchronization" : "Local workspace"}</h2>
        <p>
          {cloud
            ? `Signed in as ${email ?? "workspace owner"}. Reload to fetch the latest changes from your other devices.`
            : "This workspace is stored on this device. Cloud sync activates when Supabase is configured."}
        </p>
        <div className="account-actions">
          <button className="secondary-button" onClick={refresh}>
            Reload latest workspace
          </button>
          {cloud && (
            <button className="secondary-button" onClick={onSignOut}>
              Sign out on this device
            </button>
          )}
        </div>
      </section>
      <GoogleConnection navigate={googleNavigate} />
      <section className="panel detail-card">
        <h2>Other connections</h2>
        <p>Connectors are planned. No external systems are connected yet.</p>
        {plannedIntegrations
          .filter((name) => ["Plaud", "GitHub"].includes(name))
          .map((name) => (
            <div className="connection-row" key={name}>
              <span>{name}</span>
              <Badge>Not connected</Badge>
            </div>
          ))}
      </section>
      {data.metadata?.dataset !== "live" && (
        <section className="panel detail-card">
          <h2>Reset sample workspace</h2>
          <p>
            Restore the original sample data and replace your saved workspace.
          </p>
          <button className="secondary-button" onClick={reset}>
            Reset sample data
          </button>
        </section>
      )}
    </div>
  );
}
