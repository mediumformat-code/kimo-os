"use client";
import { useEffect, useRef, useState } from "react";
import {
  Sun,
  ListTodo,
  GitBranch,
  Layers,
  Users,
  CalendarDays,
  Inbox,
  Search,
  ArrowUpRight,
  Menu,
  X,
  Check,
  Sparkles,
} from "lucide-react";
import {
  Workspace,
  CompanyId,
  Action,
  Decision,
  Project,
  Meeting,
} from "@/domain/models";
import { removeDemo } from "@/presentation/remove-demo";
import { mockWorkspace } from "@/data/mock";
import {
  processInbox,
  workspaceService,
  WorkspaceService,
} from "@/services/workspace";
import { useLiveSync } from "./google/use-live-sync";
import { Tasks } from "./tasks";
import { Pipeline } from "./pipeline";
import { Today } from "./today";
import { WorkspaceViews } from "./workspace-views";
import { Modal } from "./ui";
import { DataHub } from "./data-hub";
import {
  executiveWorkspace,
  scopeExecutive,
  companies,
} from "@/presentation/hierarchy";
import { ExecutiveSidebar } from "./layout/executive-sidebar";
import { ExecutiveTopbar } from "./layout/executive-topbar";
import { ProjectPortfolio } from "./dashboard/project-portfolio";
import { operatingDate } from "@/services/import-workspace";
import { GoogleWorkspace, GoogleAgenda } from "./google/workspace";
import { DetailDialog, Detail } from "./detail-dialog";
const nav = [
  { name: "Today", icon: Sun },
  { name: "Priorities", icon: ListTodo },
  { name: "Decisions", icon: GitBranch },
  { name: "Projects", icon: Layers },
  { name: "Tasks", icon: ListTodo },
  { name: "Pipeline", icon: Layers },
  { name: "People", icon: Users },
  { name: "Meetings", icon: CalendarDays },
  { name: "Inbox", icon: Inbox },
  { name: "Search", icon: Search },
  { name: "Google", icon: Layers },
  { name: "Sources", icon: Layers },
];
const subtitles: Record<string, string> = {
  Today: "Focus on what moves the business forward.",
  Priorities: "The few things that move everything forward.",
  Decisions: "Your direction, where it matters most.",
  Projects: "The group picture. Without the noise.",
  Tasks: "Clear tasks, PICs, and deadlines across DDO and DDS.",
  Pipeline: "Commercial opportunities, contacts, and source financials.",
  People: "Clear ownership. Fewer loose ends.",
  Meetings: "Turn conversations into forward motion.",
  Inbox: "Signal from across your business.",
  Search: "Your business, at your fingertips.",
  Settings: "Make space for how you work.",
  Google: "Your connected calendar, inbox, and documents.",
  Sources: "Real projects, meeting sources, and GPT proposals.",
};
export function CommandCenter({
  service = workspaceService,
  cloud = false,
  email,
  onSignOut,
}: {
  service?: WorkspaceService;
  cloud?: boolean;
  email?: string;
  onSignOut?: () => void;
}) {
  const [data, setData] = useState<Workspace>(() => removeDemo(mockWorkspace));
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState("Today");
  const [company, setCompany] = useState<CompanyId>();
  const [businessNode, setBusinessNode] = useState<string>();
  const onScope = (next?: CompanyId, node?: string) => {
    setCompany(next);
    setBusinessNode(node);
    setMobile(false);
  };
  const presented = scopeExecutive(
    executiveWorkspace(data),
    company,
    businessNode,
  );
  const [detail, setDetail] = useState<Detail>();
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const [delegation, setDelegation] = useState<string>();
  const [owner, setOwner] = useState("");
  const [description, setDescription] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  useEffect(() => {
    let active = true;
    service
      .load()
      .then(async (loaded) => {
        const d = removeDemo(loaded);
        if (JSON.stringify(d) !== JSON.stringify(loaded)) await service.save(d);
        if (!active) return;
        setData(d);
        setReady(true);
        const found = [...nav.map((n) => n.name), "Settings"].find(
          (n) => n.toLowerCase() === window.location.hash.slice(1),
        );
        if (found) setView(found);
      })
      .catch((error) => {
        if (active)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Could not load your workspace.",
          );
      });
    return () => {
      active = false;
    };
  }, [service, reloadKey]);
  const navigate = (v: string) => {
    setView(v);
    setMobile(false);
    window.history.replaceState(null, "", `#${v.toLowerCase()}`);
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setView("Search");
      }
      if (e.key === "Escape") {
        setDetail(undefined);
        setDelegation(undefined);
        setMobile(false);
        setResetConfirm(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  const update = async (next: Workspace, message: string) => {
    if (saveLock.current) return false;
    saveLock.current = true;
    setSaving(true);
    setSaveError("");
    try {
      await service.save(next);
      setData(next);
      setToast(message);
      return true;
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Changes could not be saved.",
      );
      return false;
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };
  const refresh = () => {
    if (saveLock.current) return;
    setReady(false);
    setLoadError("");
    setSaveError("");
    setReloadKey((k) => k + 1);
  };
  const liveNotice = useLiveSync(data, cloud, service.getRevision, refresh);
  const managedAction = (id: string) =>
    !!data.businessSync?.enabled && data.businessSync.actionIds.includes(id);
  const complete = (id: string) => {
    if (managedAction(id)) {
      setToast("Edit status di Google Sheets sumber, kemudian Sync.");
      return;
    }
    return update(
      {
        ...data,
        actions: data.actions.map((a) =>
          a.id === id
            ? { ...a, status: a.status === "Done" ? "Open" : "Done" }
            : a,
        ),
      },
      "Priority updated",
    );
  };
  const open = (item: Action | Decision | Project | Meeting, kind: string) =>
    setDetail({ item, kind });
  const decide = (id: string, option: string) => {
    update(
      {
        ...data,
        decisions: data.decisions.map((d) =>
          d.id === id ? { ...d, status: "Decided", finalDecision: option } : d,
        ),
      },
      "Decision recorded",
    );
    setDetail(undefined);
  };
  const delegate = (id: string) => {
    if (managedAction(id)) {
      setToast("Edit PIC di Google Sheets sumber, kemudian Sync.");
      return;
    }
    setDelegation(id);
    setOwner(data.people.some((p) => p.name === id) ? id : "");
    setDescription("");
  };
  const saveDelegation = () => {
    if (!delegation) return;
    if (data.inbox.some((i) => i.id === delegation)) {
      update(
        processInbox(data, delegation, "Delegate", owner),
        `Delegated to ${owner}`,
      );
    } else if (data.actions.some((a) => a.id === delegation)) {
      update(
        {
          ...data,
          actions: data.actions.map((a) =>
            a.id === delegation ? { ...a, owner } : a,
          ),
        },
        `Delegated to ${owner}`,
      );
    } else {
      if (!description.trim()) return;
      update(
        {
          ...data,
          actions: [
            ...data.actions,
            {
              id: `delegated-${Date.now()}`,
              description: description.trim(),
              owner,
              dueDate: "2026-10-05",
              project: data.people.find((p) => p.name === owner)!.projects[0],
              priority: 70,
              status: "Open",
              horizon: "This week",
            },
          ],
        },
        `Action delegated to ${owner}`,
      );
    }
    setDelegation(undefined);
    setDetail(undefined);
  };
  const scopedDecisions = presented.decisions.filter(
    (d) => d.status === "Needs Kimo",
  ).length;
  const scopedInbox = presented.inbox.filter(
    (i) => i.status === "Review",
  ).length;
  return (
    <div className="app-shell executive-app">
      <button
        className={`mobile-menu icon-button ${mobile ? "hidden" : ""}`}
        aria-label="Open navigation"
        onClick={() => setMobile(true)}
      >
        <Menu size={22} />
      </button>
      {mobile && (
        <div className="mobile-overlay" onClick={() => setMobile(false)} />
      )}
      <ExecutiveSidebar
        view={view}
        company={company}
        node={businessNode}
        navigate={navigate}
        onScope={onScope}
        mobile={mobile}
        onClose={() => setMobile(false)}
        decisions={scopedDecisions}
        inbox={scopedInbox}
        cloud={cloud}
      />
      <div className="main-shell">
        <ExecutiveTopbar
          navigate={navigate}
          date={operatingDate(data)}
          inbox={scopedInbox}
          sample={data.metadata?.dataset !== "live"}
        />
        <main>
          <div
            className={`page-heading ${view === "Today" ? "editorial-hero" : ""}`}
          >
            <div>
              <div className="eyebrow">
                {view === "Today"
                  ? data.metadata?.dataset === "live"
                    ? operatingDate(data)
                    : "TODAY"
                  : "YOUR EXECUTIVE WORKSPACE"}
              </div>
              <h1>
                {view === "Today"
                  ? `Good ${Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(new Date())) >= 17 ? "evening" : Number(new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(new Date())) >= 12 ? "afternoon" : "morning"}, Kimo.`
                  : view === "Search"
                    ? "Ask KIMO OS"
                    : view}
              </h1>
              <p>{subtitles[view]}</p>
            </div>
            {view === "Today" ? (
              <blockquote className="hero-quote">
                “Discipline today
                <br />
                creates freedom tomorrow.”<cite>— KIMO</cite>
              </blockquote>
            ) : (
              <button className="ask-button" onClick={() => navigate("Search")}>
                <Sparkles size={16} />
                Ask KIMO OS<kbd>⌘ K</kbd>
              </button>
            )}
          </div>
          {company && (
            <div className="filter-banner">
              <span>
                Viewing {companies.find((c) => c.id === company)?.name}
                {businessNode ? ` · ${businessNode}` : ""}
              </span>
              <button onClick={() => onScope()}>
                All companies <X size={13} />
              </button>
            </div>
          )}
          {saveError && (
            <div className="persistence-error" role="alert">
              <div>
                <strong>Changes were not saved.</strong>
                <p>{saveError}</p>
              </div>
              <button className="secondary-button" onClick={refresh}>
                Reload latest workspace
              </button>
            </div>
          )}
          {liveNotice && (
            <div className="notice" role="status">
              {liveNotice}
            </div>
          )}
          {!ready ? (
            <div className="empty">
              {loadError ? (
                <>
                  <p role="alert">{loadError}</p>
                  <button className="secondary-button" onClick={refresh}>
                    Try again
                  </button>
                </>
              ) : (
                "Preparing your workspace…"
              )}
            </div>
          ) : view === "Projects" ? (
            <ProjectPortfolio data={presented} open={open} />
          ) : view === "Tasks" ? (
            <Tasks
              data={presented}
              company={company}
              open={open}
              complete={complete}
            />
          ) : view === "Pipeline" ? (
            <Pipeline data={presented} company={company} />
          ) : view === "Sources" ? (
            <DataHub
              data={data}
              cloud={cloud}
              save={update}
              refresh={refresh}
              expectedRevision={service.getRevision}
            />
          ) : view === "Google" ? (
            <GoogleWorkspace />
          ) : view === "Today" ? (
            <>
              <Today
                data={presented}
                node={businessNode}
                onScope={onScope}
                company={company}
                navigate={navigate}
                open={open}
                complete={complete}
              />
              <GoogleAgenda />
            </>
          ) : (
            <WorkspaceViews
              key={view}
              view={view}
              data={view === "Settings" ? data : presented}
              company={company}
              open={open}
              complete={complete}
              triage={(id, status) =>
                update(processInbox(data, id, status), "Inbox updated")
              }
              delegate={delegate}
              commitmentDone={(id) =>
                update(
                  {
                    ...data,
                    commitments: data.commitments.map((c) =>
                      c.id === id
                        ? {
                            ...c,
                            status: c.status === "Done" ? "Open" : "Done",
                          }
                        : c,
                    ),
                  },
                  "Commitment updated",
                )
              }
              reset={() => setResetConfirm(true)}
              cloud={cloud}
              email={email}
              onSignOut={onSignOut}
              refresh={refresh}
              googleNavigate={() => navigate("Google")}
            />
          )}
          <footer className="page-footer">
            <span>
              <span className="footer-mark">k◦</span> Less noise. More clarity.
            </span>
            <span>Built around what matters.</span>
          </footer>
        </main>
      </div>
      {detail && (
        <DetailDialog
          detail={detail}
          data={presented}
          onClose={() => setDetail(undefined)}
          decide={decide}
          open={open}
          complete={complete}
          delegate={delegate}
        />
      )}
      {delegation && (
        <Modal
          title="Delegate with clear ownership"
          onClose={() => setDelegation(undefined)}
        >
          <p>
            {data.inbox.find((i) => i.id === delegation)?.title ||
              data.actions.find((a) => a.id === delegation)?.description ||
              "Give someone a focused next action."}
          </p>
          <label className="field-label">
            Owner
            <select value={owner} onChange={(e) => setOwner(e.target.value)}>
              {data.people.map((p) => (
                <option key={p.id}>{p.name}</option>
              ))}
            </select>
          </label>
          {!data.inbox.some((i) => i.id === delegation) &&
            !data.actions.some((a) => a.id === delegation) && (
              <label className="field-label">
                Action
                <textarea
                  placeholder="What needs to move forward?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </label>
            )}
          <p className="muted">
            {cloud
              ? "Saved to your private cloud workspace."
              : "Saved in the local workspace."}{" "}
            No message is sent.
          </p>
          <button className="primary-button" onClick={saveDelegation}>
            Delegate action
            <ArrowUpRight size={15} />
          </button>
        </Modal>
      )}
      {resetConfirm && (
        <Modal
          title="Reset your sample workspace?"
          onClose={() => setResetConfirm(false)}
        >
          <p>
            This clears saved decisions, actions, and inbox changes, and
            restores the original samples.
          </p>
          <button
            className="primary-button"
            onClick={() => {
              update(removeDemo(mockWorkspace), "Empty workspace restored");
              setResetConfirm(false);
            }}
          >
            Reset sample data
          </button>
        </Modal>
      )}
      {saving && (
        <div className="saving-overlay" role="status" aria-live="polite">
          <span>Saving your workspace…</span>
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
