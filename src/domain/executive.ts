import type { Project } from "./models";
export type ExecutiveCompanyId = "studio" | "originals";
export type BusinessUnitId = "fam" | "event-ip" | "retail" | "originals-other";
export interface BusinessUnit {
  id: BusinessUnitId;
  company: "originals";
  name: string;
  shortLabel: string;
}
export interface ClientAccount {
  id: string;
  company: "studio";
  name: string;
}
export interface Initiative {
  id: string;
  projectId: string;
  name: string;
  owner: string;
}
export interface Metric {
  id: string;
  company: ExecutiveCompanyId;
  node: string;
  date: string;
  value: number;
  currency: "IDR";
  kind: "revenue";
  provenance: "sample" | "verified";
}
export interface ProjectPlacement {
  company: ExecutiveCompanyId;
  node: string;
  group: string;
  label: string;
}
export interface ExecutiveProject extends Project {
  placement: ProjectPlacement;
}
