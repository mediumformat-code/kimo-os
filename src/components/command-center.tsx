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
  Settings,
  ChevronDown,
  Bell,
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
import { mockWorkspace } from "@/data/mock";
import {
  processInbox,
  workspaceService,
  WorkspaceService,
} from "@/services/workspace";
import { Today } from "./today";
import { WorkspaceViews } from "./workspace-views";
import { Avatar, Badge, Modal } from "./ui";
import { DataHub } from "./data-hub";
import { operatingDate } from "@/services/import-workspace";
import { GoogleWorkspace, GoogleAgenda } from "./google/workspace";
import { DetailDialog, Detail } from "./detail-dialog";
const nav = [
  { name: "Today", icon: Sun },
  { name: "Priorities", icon: ListTodo },
  { name: "Decisions", icon: GitBranch },
  { name: "Projects", icon: Layers },
  { name: "People", icon: Users },
  { name: "Meetings", icon: CalendarDays },
  { name: "Inbox", icon: Inbox },
  { name: "Search", icon: Search },
  { name: "Google", icon: Layers },
  { name: "Sources", icon: Layers },
];
const subtitles: Record<string, string> = {
  Today: "A clear head. A focused day.",
  Priorities: "The few things that move everything forward.",
  Decisions: "Your direction, where it matters most.",
  Projects: "The group picture. Without the noise.",
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
  const [data, setData] = useState<Workspace>(mockWorkspace);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const saveLock = useRef(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState("Today");
  const [company, setCompany] = useState<CompanyId>();
  const [detail, setDetail] = useState<Detail>();
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState("");
  const [delegation, setDelegation] = useState<string>();
  const [owner, setOwner] = useState("Iyas");
  const [description, setDescription] = useState("");
  const [resetConfirm, setResetConfirm] = useState(false);
  useEffect(() => {
    let active = true;
    service
      .load()
      .then((d) => {
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
  const complete = (id: string) =>
    update(
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
    setDelegation(id);
    setOwner(data.people.some((p) => p.name === id) ? id : "Iyas");
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
  const scopedDecisions = data.decisions.filter(
    (d) =>
      d.status === "Needs Kimo" &&
      (!company ||
        data.projects.find((p) => p.id === d.project)?.company === company),
  ).length;
  const scopedInbox = data.inbox.filter(
    (i) =>
      i.status === "Review" &&
      (!company ||
        data.projects.find((p) => p.id === i.project)?.company === company),
  ).length;
  return (
    <div className="app-shell">
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
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-symbol">
            k<span>◦</span>
          </div>
          <span>
            KIMO<span className="brand-os"> OS</span>
          </span>
          <button
            className="mobile-close icon-button"
            onClick={() => setMobile(false)}
            aria-label="Close navigation"
          >
            <X size={18} />
          </button>
        </div>
        <button
          className="workspace-switch"
          onClick={() => navigate("Settings")}
        >
          <span className="workspace-logo">dd.</span>
          <span>
            Double Deer Group<small>Personal workspace</small>
          </span>
          <ChevronDown size={14} />
        </button>
        <div className="nav-caption">WORKSPACE</div>
        <nav>
          {nav.map((n) => (
            <button
              key={n.name}
              className={`nav-item ${view === n.name ? "selected" : ""}`}
              onClick={() => navigate(n.name)}
            >
              <n.icon size={18} strokeWidth={1.65} />
              <span>{n.name}</span>
              {n.name === "Decisions" && scopedDecisions > 0 && (
                <span className="nav-count">{scopedDecisions}</span>
              )}
              {n.name === "Inbox" && scopedInbox > 0 && (
                <span className="nav-count inbox-count">{scopedInbox}</span>
              )}
              {n.name === "Search" && <kbd>⌘ K</kbd>}
            </button>
          ))}
        </nav>
        <div className="nav-caption companies-caption">
          COMPANIES
          <button
            aria-label="View all companies"
            onClick={() => setCompany(undefined)}
          >
            +
          </button>
        </div>
        <div className="company-nav">
          {data.companies.map((c) => (
            <button
              key={c.id}
              className={company === c.id ? "company-selected" : ""}
              onClick={() => setCompany(company === c.id ? undefined : c.id)}
            >
              <span className={`company-dot ${c.id}`} />
              {c.name}
              {company === c.id && <Check size={13} />}
            </button>
          ))}
        </div>
        <div className="sidebar-bottom">
          <div className="workspace-status">
            <span className="status-dot" />
            {cloud ? "Cloud workspace" : "Local workspace"}
            <Badge>V1.1</Badge>
          </div>
          <button
            className={`nav-item ${view === "Settings" ? "selected" : ""}`}
            onClick={() => navigate("Settings")}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button className="profile" onClick={() => navigate("Settings")}>
            <Avatar name="Kimo" />
            <span>
              <strong>Kimo Rizky</strong>
              <small>Founder & Group CEO</small>
            </span>
            <ChevronDown size={14} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>
            <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <span className="sample-indicator">
              <span className="status-dot" />
              {data.metadata?.dataset === "live"
                ? "Workspace data"
                : cloud
                  ? "Cloud · Sample business data"
                  : "Sample workspace"}
            </span>
            <button
              className="icon-button"
              aria-label="Search workspace"
              onClick={() => navigate("Search")}
            >
              <Search size={17} />
            </button>
            <button
              className="icon-button notification"
              aria-label="Open intelligence inbox"
              onClick={() => navigate("Inbox")}
            >
              <Bell size={18} />
              {scopedInbox > 0 && <i />}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === "Today"
                  ? data.metadata?.dataset === "live"
                    ? operatingDate(data)
                    : "SATURDAY, OCTOBER 3, 2026"
                  : "YOUR EXECUTIVE WORKSPACE"}
              </div>
              <h1>
                {view === "Today"
                  ? "Good morning, Kimo."
                  : view === "Search"
                    ? "Ask KIMO OS"
                    : view}
              </h1>
              <p>{subtitles[view]}</p>
            </div>
            <button className="ask-button" onClick={() => navigate("Search")}>
              <Sparkles size={16} />
              Ask KIMO OS<kbd>⌘ K</kbd>
            </button>
          </div>
          {company && (
            <div className="filter-banner">
              <span>
                Viewing {data.companies.find((c) => c.id === company)?.name}
              </span>
              <button onClick={() => setCompany(undefined)}>
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
              <GoogleAgenda />
              <Today
                data={data}
                company={company}
                navigate={navigate}
                open={open}
                complete={complete}
              />
            </>
          ) : (
            <WorkspaceViews
              key={view}
              view={view}
              data={data}
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
          data={data}
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
              update(structuredClone(mockWorkspace), "Sample data restored");
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
