export type CompanyId = "studio" | "originals" | "shared";
export interface Company {
  id: CompanyId;
  name: string;
  description: string;
}
export interface Project {
  id: string;
  name: string;
  company: CompanyId;
  owner: string;
  status: string;
  priority: number;
  deadline: string;
  health: "On track" | "Watch" | "At risk";
  latestUpdate: string;
  nextAction: string;
  blockers: string[];
  people: string[];
  meetings: string[];
  documents: string[];
}
export interface Person {
  id: string;
  name: string;
  role: string;
  company: CompanyId;
  projects: string[];
  lastInteraction: string;
  nextUpdate: string;
}
export interface Commitment {
  id: string;
  owner: string;
  description: string;
  source: string;
  createdAt: string;
  deadline: string;
  status: "Open" | "Done";
  project: string;
  importance: number;
}
export interface Decision {
  id: string;
  issue: string;
  context: string;
  owner: string;
  options: string[];
  deadline: string;
  status: "Needs Kimo" | "Waiting for others" | "Decided";
  finalDecision?: string;
  project: string;
}
export interface Meeting {
  id: string;
  title: string;
  participants: string[];
  date: string;
  source: string;
  summary: string;
  decisions: string[];
  commitments: string[];
  actions: string[];
  risks: string[];
  followUps: string[];
  project: string;
}
export interface Action {
  id: string;
  description: string;
  owner: string;
  dueDate: string;
  project: string;
  priority: number;
  status: "Open" | "Done";
  horizon: "Today" | "This week" | "Later";
}
export interface Risk {
  id: string;
  project: string;
  description: string;
  severity: "High" | "Medium";
  owner: string;
  mitigation: string;
  deadline: string;
}
export interface InboxItem {
  id: string;
  title: string;
  description: string;
  kind: string;
  source: string;
  project: string;
  status: "Review" | "Delegate" | "Action" | "Decision" | "Archived";
}
export interface Workspace {
  metadata?: {
    dataset: "sample" | "live";
    importedAt?: string;
    sourceName?: string;
  };
  companies: Company[];
  projects: Project[];
  people: Person[];
  commitments: Commitment[];
  decisions: Decision[];
  meetings: Meeting[];
  actions: Action[];
  risks: Risk[];
  inbox: InboxItem[];
}
