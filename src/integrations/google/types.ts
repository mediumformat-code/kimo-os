export interface GoogleEvent {
  id: string;
  calendar: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  location: string;
  url: string;
  attendees: string[];
}
export interface GoogleMail {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
  unread: boolean;
  url: string;
}
export interface GoogleFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedAt: string;
  url: string;
  owner: string;
}
export interface GoogleSnapshot {
  events: GoogleEvent[];
  mail: GoogleMail[];
  files: GoogleFile[];
  updatedAt: string;
  sourceUpdatedAt: Record<string, string>;
  warnings: string[];
}
export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email?: string;
  scopes?: string[];
  lastSyncedAt?: string;
  snapshot?: GoogleSnapshot;
}
export interface GoogleCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}
export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/drive.readonly",
  "https://www.googleapis.com/auth/documents.readonly",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
];
