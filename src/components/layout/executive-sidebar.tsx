"use client";
import {
  Home,
  ListTodo,
  GitBranch,
  FolderOpen,
  Users,
  CalendarDays,
  Inbox,
  Search,
  Settings,
  ChevronRight,
  X,
  Layers,
  Plug,
  ChevronDown,
} from "lucide-react";
import type { CompanyId } from "@/domain/models";
import { companies } from "@/presentation/hierarchy";
import { Avatar } from "../ui";
const main = [
  { name: "Today", icon: Home },
  { name: "Priorities", icon: ListTodo },
  { name: "Decisions", icon: GitBranch },
  { name: "Projects", icon: FolderOpen },
  { name: "People", icon: Users },
  { name: "Meetings", icon: CalendarDays },
  { name: "Inbox", icon: Inbox },
  { name: "Search", icon: Search },
  { name: "Settings", icon: Settings },
];
export function ExecutiveSidebar({
  view,
  company,
  node,
  navigate,
  onScope,
  mobile,
  onClose,
  decisions,
  inbox,
  cloud,
}: {
  view: string;
  company?: CompanyId;
  node?: string;
  navigate: (v: string) => void;
  onScope: (c?: CompanyId, node?: string) => void;
  mobile: boolean;
  onClose: () => void;
  decisions: number;
  inbox: number;
  cloud: boolean;
}) {
  const children = {
    studio: [
      ["ggi", "Gudang Garam International"],
      ["ggs", "Gudang Garam Signature"],
      ["other-clients", "Other client accounts"],
    ],
    originals: [
      ["fam", "Frekuensi Antara Music"],
      ["event-ip", "Event IP"],
      ["the-others", "The Others"],
      ["camponaria", "Camponaria"],
      ["retail", "Retail"],
      ["medium-format", "Medium Format"],
    ],
  };
  return (
    <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
      <div className="brand">
        <span>
          KIMO <span className="brand-os">OS</span>
        </span>
        <button
          className="mobile-close icon-button"
          aria-label="Close navigation"
          onClick={onClose}
        >
          <X size={18} />
        </button>
      </div>
      <nav className="main-navigation" aria-label="Main navigation">
        {main.map(({ name, icon: Icon }) => (
          <button
            key={name}
            className={`nav-item ${view === name ? "selected" : ""}`}
            onClick={() => navigate(name)}
          >
            <Icon size={17} strokeWidth={1.6} />
            <span>{name}</span>
            {name === "Decisions" && decisions > 0 && (
              <span className="nav-count">{decisions}</span>
            )}
            {name === "Inbox" && inbox > 0 && (
              <span className="nav-count">{inbox}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="company-navigation">
        <div className="nav-caption">
          COMPANY{" "}
          <button aria-label="View all companies" onClick={() => onScope()}>
            All
          </button>
        </div>
        {companies.map((c) => (
          <div className="company-branch" key={c.id}>
            <button
              className={`company-parent ${company === c.id && !node ? "company-selected" : ""}`}
              onClick={() =>
                onScope(company === c.id && !node ? undefined : c.id)
              }
            >
              <span className="company-initials">{c.initials}</span>
              <span>{c.label}</span>
              <ChevronRight size={12} />
            </button>
            <details open={company === c.id}>
              <summary aria-label={`Expand ${c.name}`}>
                <ChevronDown size={12} />
                <span>Accounts & business units</span>
              </summary>
              <div className="company-children">
                {children[c.id].map(([id, label]) => (
                  <button
                    key={id}
                    className={`${node === id ? "unit-selected" : ""} ${["the-others", "camponaria", "medium-format"].includes(id) ? "nested-unit" : ""}`}
                    onClick={() => onScope(c.id, id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </details>
          </div>
        ))}
      </div>
      <details
        className="workspace-tools"
        open={["Tasks", "Pipeline", "Google", "Sources"].includes(view)}
      >
        <summary>
          <Plug size={15} />
          Workspace tools
          <ChevronDown size={12} />
        </summary>
        <nav aria-label="Workspace tools">
          {["Tasks", "Pipeline", "Google", "Sources"].map((name) => (
            <button
              key={name}
              className={`nav-item ${view === name ? "selected" : ""}`}
              onClick={() => navigate(name)}
            >
              <Layers size={15} />
              {name}
            </button>
          ))}
        </nav>
      </details>
      <div className="sidebar-bottom">
        <div className="workspace-status">
          <span className="status-dot" />
          {cloud ? "Cloud workspace" : "Local workspace"}
        </div>
        <button className="profile" onClick={() => navigate("Settings")}>
          <Avatar name="Kimo" />
          <span>
            <strong>Kimo Rizky</strong>
            <small>Founder & CEO</small>
          </span>
          <ChevronRight size={14} />
        </button>
      </div>
    </aside>
  );
}
