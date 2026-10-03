import { Search, Bell, Sun, Command } from "lucide-react";
import { Avatar } from "../ui";
export function ExecutiveTopbar({
  navigate,
  date,
  inbox,
  sample,
}: {
  navigate: (v: string) => void;
  date: string;
  inbox: number;
  sample: boolean;
}) {
  const label = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
  return (
    <header className="topbar">
      <button
        className="global-command"
        onClick={() => navigate("Search")}
        aria-label="Search workspace"
      >
        <Search size={18} />
        <span>
          Search anything…{" "}
          <span className="command-secondary">Ask Kimo OS…</span>
        </span>
        <kbd>
          <Command size={12} />K
        </kbd>
      </button>
      <div className="topbar-actions">
        <span className="sample-indicator">
          {sample ? "Sample workspace" : "Workspace data"}
        </span>
        <time className="workspace-date" dateTime={date}>
          {label}
        </time>
        <Sun size={17} className="ambient-icon" aria-hidden />
        <button
          className="icon-button notification"
          aria-label="Open intelligence inbox"
          onClick={() => navigate("Inbox")}
        >
          <Bell size={18} />
          {inbox > 0 && <i />}
        </button>
        <button
          className="topbar-avatar"
          aria-label="Open account settings"
          onClick={() => navigate("Settings")}
        >
          <Avatar name="Kimo" />
        </button>
      </div>
    </header>
  );
}
