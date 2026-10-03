import { ArrowUpRight, FolderOpen } from "lucide-react";
import type { Project, Workspace } from "@/domain/models";
import { companies, placement } from "@/presentation/hierarchy";
import { Badge, Avatar, Empty } from "../ui";
export function ProjectPortfolio({
  data,
  open,
}: {
  data: Workspace;
  open: (p: Project, kind: string) => void;
}) {
  return (
    <div className="view-stack portfolio-page">
      {companies.map((c) => {
        const rows = data.projects.filter((p) => p.company === c.id);
        if (!rows.length) return null;
        const groups = [...new Set(rows.map((p) => placement(p).group))];
        return (
          <section key={c.id}>
            <div className="portfolio-company-title">
              <span className="company-initials">{c.initials}</span>
              <div>
                <h2>{c.name}</h2>
                <p>
                  {rows.length} projects ·{" "}
                  {c.id === "studio"
                    ? "Client service, campaigns and activation"
                    : "Music, Event IP and Retail"}
                </p>
              </div>
            </div>
            {groups.map((group) => (
              <section className="business-unit-section" key={group}>
                <h3>
                  <FolderOpen size={15} />
                  {group}
                  <small>
                    {rows.filter((p) => placement(p).group === group).length}{" "}
                    projects
                  </small>
                </h3>
                <div className="project-grid">
                  {rows
                    .filter((p) => placement(p).group === group)
                    .map((p) => (
                      <button
                        key={p.id}
                        className="panel project-card"
                        onClick={() => open(p, "project")}
                      >
                        <div className="card-top">
                          <span className="eyebrow">{placement(p).label}</span>
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
                        <p>{p.latestUpdate || "No update reported yet."}</p>
                        <div className="project-next">
                          <span className="eyebrow">NEXT MILESTONE</span>
                          <strong>{p.nextAction || "Not set"}</strong>
                          <small>
                            {p.deadline
                              ? `Due ${p.deadline}`
                              : "No deadline set"}
                          </small>
                        </div>
                        {p.blockers.length > 0 && (
                          <p className="project-blocker">
                            Blocker: {p.blockers.join(" · ")}
                          </p>
                        )}
                        <div className="card-bottom">
                          <span>
                            <Avatar name={p.owner} />
                            {p.owner}
                          </span>
                          <span>
                            {p.status}
                            <ArrowUpRight size={14} />
                          </span>
                        </div>
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </section>
        );
      })}
      {!data.projects.length && (
        <Empty text="No projects in this business view." />
      )}
    </div>
  );
}
