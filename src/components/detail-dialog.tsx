import { ArrowUpRight, Check } from "lucide-react";
import { Action, Decision, Project, Meeting, Workspace } from "@/domain/models";
import { Badge, Modal } from "./ui";
export type Detail = {
  kind: string;
  item: Action | Decision | Project | Meeting;
};
export function DetailDialog({
  detail,
  data,
  onClose,
  decide,
  open,
  complete,
  delegate,
}: {
  detail: Detail;
  data: Workspace;
  onClose: () => void;
  decide: (id: string, option: string) => void;
  open: (item: Action | Decision | Project | Meeting, kind: string) => void;
  complete: (id: string) => void;
  delegate: (id: string) => void;
}) {
  return (
    <Modal
      title={
        detail.kind === "decision"
          ? (detail.item as Decision).issue
          : detail.kind === "project"
            ? (detail.item as Project).name
            : detail.kind === "meeting"
              ? (detail.item as Meeting).title
              : (detail.item as Action).description
      }
      onClose={() => onClose()}
    >
      {detail.kind === "decision"
        ? (() => {
            const d = detail.item as Decision;
            return (
              <>
                <Badge>{d.status}</Badge>
                <p>{d.context}</p>
                <div className="detail-meta">
                  {d.owner} · Due {d.deadline} ·{" "}
                  {data.projects.find((p) => p.id === d.project)?.name}
                </div>
                {d.status === "Decided" ? (
                  <p className="decision-record">
                    Recorded decision: {d.finalDecision}
                  </p>
                ) : (
                  <div className="option-list">
                    {d.options.map((o) => (
                      <button
                        className="secondary-button"
                        key={o}
                        onClick={() => decide(d.id, o)}
                      >
                        {o}
                        <ArrowUpRight size={15} />
                      </button>
                    ))}
                  </div>
                )}
              </>
            );
          })()
        : detail.kind === "project"
          ? (() => {
              const p = detail.item as Project;
              return (
                <>
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
                  <p>{p.latestUpdate}</p>
                  <div className="detail-meta">
                    Owner {p.owner} · Next milestone {p.deadline}
                  </div>
                  <h3>Next action</h3>
                  <p>{p.nextAction}</p>
                  <h3>Blockers</h3>
                  <p>{p.blockers.join(" · ") || "No current blockers."}</p>
                  <h3>Related decisions</h3>
                  {data.decisions
                    .filter((d) => d.project === p.id)
                    .map((d) => (
                      <button
                        className="detail-link"
                        key={d.id}
                        onClick={() => open(d, "decision")}
                      >
                        {d.issue}
                        <Badge>{d.status}</Badge>
                      </button>
                    ))}
                  <h3>Key people</h3>
                  <p>{p.people.join(", ")}</p>
                </>
              );
            })()
          : detail.kind === "meeting"
            ? (() => {
                const m = detail.item as Meeting;
                return (
                  <>
                    <Badge>{m.source}</Badge>
                    <p>{m.summary}</p>
                    <div className="detail-meta">
                      {new Date(m.date).toLocaleString("en-GB", {
                        timeZone: "Asia/Jakarta",
                      })}{" "}
                      WIB
                      <br />
                      {m.participants.join(", ")}
                    </div>
                    <h3>Decisions</h3>
                    {m.decisions.map((id) => {
                      const d = data.decisions.find((d) => d.id === id);
                      return (
                        d && (
                          <button
                            key={id}
                            className="detail-link"
                            onClick={() => open(d, "decision")}
                          >
                            {d.issue}
                            <Badge>{d.status}</Badge>
                          </button>
                        )
                      );
                    })}
                    <h3>Commitments</h3>
                    {m.commitments.map((id) => (
                      <p key={id}>
                        {data.commitments.find((c) => c.id === id)?.description}
                      </p>
                    ))}
                    <h3>Actions</h3>
                    {m.actions.map((id) => {
                      const a = data.actions.find((a) => a.id === id);
                      return (
                        a && (
                          <button
                            key={id}
                            className="detail-link"
                            onClick={() => open(a, "action")}
                          >
                            {a.description}
                            <Badge>{a.status}</Badge>
                          </button>
                        )
                      );
                    })}
                    <h3>Risks</h3>
                    {m.risks.length ? (
                      m.risks.map((id) => (
                        <p key={id}>
                          {data.risks.find((r) => r.id === id)?.description}
                        </p>
                      ))
                    ) : (
                      <p>No risks captured.</p>
                    )}
                    <h3>Unresolved follow-ups</h3>
                    {m.followUps.map((f) => (
                      <p key={f}>{f}</p>
                    ))}
                  </>
                );
              })()
            : (() => {
                const a = detail.item as Action;
                return (
                  <>
                    <Badge>{a.status}</Badge>
                    <p>
                      {
                        data.projects.find((p) => p.id === a.project)
                          ?.latestUpdate
                      }
                    </p>
                    <div className="detail-meta">
                      {a.owner} · Due {a.dueDate || "Not provided"} ·{" "}
                      {data.projects.find((p) => p.id === a.project)?.name}
                    </div>
                    {a.sourceRef && (
                      <section>
                        <h3>Source task record</h3>
                        <p>
                          Original status: {a.sourceStatus || "Not provided"}.
                          OS status: {a.status}.
                        </p>
                        <dl className="source-fields">
                          {Object.entries(
                            data.sourceRecords?.find(
                              (r) => r.id === a.sourceRef,
                            )?.fields ?? {},
                          ).map(([key, value]) => (
                            <div key={key}>
                              <dt>{key.replace(/^\d+\.\s*/, "")}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </section>
                    )}
                    <div className="option-list">
                      <button
                        className="primary-button"
                        onClick={() => {
                          complete(a.id);
                          onClose();
                        }}
                      >
                        Mark {a.status === "Done" ? "open" : "complete"}
                        <Check size={16} />
                      </button>
                      <button
                        className="secondary-button"
                        onClick={() => delegate(a.id)}
                      >
                        Delegate to someone
                        <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </>
                );
              })()}
    </Modal>
  );
}
