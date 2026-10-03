import { FileText, ArrowUpRight } from "lucide-react";
import type { Workspace, CompanyId } from "@/domain/models";
import { activeProject } from "@/presentation/hierarchy";
import { sampleRevenue } from "@/data/executive-metrics";
import { performance, money } from "@/presentation/performance";
export function ExecutiveBrief({
  data,
  company,
  node,
  navigate,
}: {
  data: Workspace;
  company?: CompanyId;
  node?: string;
  navigate: (view: string) => void;
}) {
  const decisions = data.decisions.filter(
    (d) => d.status === "Needs Kimo",
  ).length;
  const riskProjects = new Set(
    data.projects.filter((p) => p.health === "At risk").map((p) => p.id),
  );
  const riskIds = new Set(data.risks.map((r) => r.project));
  riskProjects.forEach((id) => riskIds.add(id));
  const risk = riskIds.size;
  const sample = data.metadata?.dataset !== "live";
  const report = performance(
    sample ? sampleRevenue : [],
    "Year",
    company,
    node,
  );
  const active = data.projects.filter(activeProject).length;
  return (
    <section className="executive-brief executive-card">
      <div className="brief-story">
        <span className="brief-document">
          <FileText size={22} />
        </span>
        <div>
          <div className="eyebrow">EXECUTIVE BRIEF</div>
          <p>
            {decisions
              ? `${decisions} decisions need your direction.`
              : "Your decision inbox is clear."}
            <br />
            <span>
              {risk
                ? `${risk} project${risk === 1 ? "" : "s"} with flagged risks. Focus on the next move.`
                : "A focused view across your business. Keep the next move clear."}
            </span>
          </p>
        </div>
      </div>
      <div className="executive-kpis">
        <button onClick={() => navigate("Pipeline")}>
          <strong>
            {report.total === undefined ? "—" : money(report.total)}
          </strong>
          <span>{company ? "Company revenue" : "Group revenue"}</span>
          <small>{sample ? "Illustrative · YTD" : "Not reported"}</small>
        </button>
        <button onClick={() => navigate("Projects")}>
          <strong>{active}</strong>
          <span>Active projects</span>
          <small>In this view</small>
        </button>
        <button onClick={() => navigate("Decisions")}>
          <strong>
            {decisions}
            {decisions > 0 && <ArrowUpRight size={15} />}
          </strong>
          <span>Decisions pending</span>
          <small>Waiting on Kimo</small>
        </button>
        <button onClick={() => navigate("Projects")}>
          <strong className={risk ? "attention" : ""}>{risk}</strong>
          <span>At-risk projects</span>
          <small>Flagged in workspace</small>
        </button>
      </div>
    </section>
  );
}
