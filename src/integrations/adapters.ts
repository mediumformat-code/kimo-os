export interface SourceRecord {
  id: string;
  source: string;
  capturedAt: string;
  payload: unknown;
}
export interface IntegrationAdapter {
  readonly id: string;
  readonly name: string;
  isConnected(): Promise<boolean>;
  fetch(since?: string): Promise<SourceRecord[]>;
}
export const plannedIntegrations = [
  "Google Calendar",
  "Gmail",
  "Google Drive",
  "Google Sheets",
  "Plaud",
  "GitHub",
];
// Implement IntegrationAdapter per source when credentials and ingestion are introduced.
