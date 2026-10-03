import { GoogleEvent, GoogleMail, GoogleFile, GoogleSnapshot } from "./types";
export class GoogleApiError extends Error {
  constructor(public status: number) {
    super(`Google API returned ${status}`);
  }
}
export async function googleGet<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!response.ok) throw new GoogleApiError(response.status);
  return response.json();
}
interface CalendarEvent {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  location?: string;
  htmlLink?: string;
  attendees?: { email?: string }[];
  status?: string;
}
export class GoogleCalendarAdapter {
  constructor(private token: string) {}
  async fetch(): Promise<GoogleEvent[]> {
    const calendars = await googleGet<{
      items?: {
        id: string;
        summary: string;
        selected?: boolean;
        primary?: boolean;
      }[];
    }>(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100",
      this.token,
    );
    const selected = (calendars.items ?? [])
      .filter((c) => c.selected || c.primary)
      .slice(0, 10);
    const now = new Date();
    now.setUTCHours(0, 0, 0, 0);
    now.setUTCDate(now.getUTCDate() - 1);
    const end = new Date(now);
    end.setUTCDate(end.getUTCDate() + 15);
    const results = await Promise.allSettled(
      selected.map(async (c) => {
        const query = new URLSearchParams({
          singleEvents: "true",
          orderBy: "startTime",
          timeMin: now.toISOString(),
          timeMax: end.toISOString(),
          maxResults: "40",
        });
        const data = await googleGet<{ items?: CalendarEvent[] }>(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(c.id)}/events?${query}`,
          this.token,
        );
        return (data.items ?? [])
          .filter(
            (e) =>
              e.status !== "cancelled" &&
              !!(e.start?.dateTime || e.start?.date),
          )
          .map((e) => ({
            id: `${c.id}:${e.id}`,
            calendar: c.summary,
            title: e.summary || "Untitled meeting",
            start: e.start!.dateTime ?? e.start!.date!,
            end: e.end?.dateTime ?? e.end?.date ?? "",
            allDay: !e.start?.dateTime,
            location: e.location ?? "",
            url: e.htmlLink ?? "https://calendar.google.com",
            attendees: (e.attendees ?? [])
              .map((a) => a.email ?? "")
              .filter(Boolean),
          }));
      }),
    );
    if (results.some((r) => r.status === "rejected"))
      throw new GoogleApiError(403);
    return results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .sort((a, b) => a.start.localeCompare(b.start));
  }
}
export class GmailAdapter {
  constructor(private token: string) {}
  async fetch(): Promise<GoogleMail[]> {
    const list = await googleGet<{ messages?: { id: string }[] }>(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=in%3Ainbox%20newer_than%3A30d",
      this.token,
    );
    return Promise.all(
      (list.messages ?? []).map(async (item) => {
        const message = await googleGet<{
          id: string;
          threadId: string;
          snippet?: string;
          internalDate?: string;
          labelIds?: string[];
          payload?: { headers?: { name: string; value: string }[] };
        }>(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(item.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From`,
          this.token,
        );
        const header = (name: string) =>
          message.payload?.headers?.find((h) => h.name.toLowerCase() === name)
            ?.value ?? "";
        return {
          id: message.id,
          subject: header("Subject") || "(No subject)",
          from: header("From"),
          snippet: message.snippet ?? "",
          date: new Date(Number(message.internalDate ?? 0)).toISOString(),
          unread: message.labelIds?.includes("UNREAD") ?? false,
          url: `https://mail.google.com/mail/u/0/#inbox/${message.threadId}`,
        };
      }),
    );
  }
}
export class GoogleDriveAdapter {
  constructor(private token: string) {}
  async fetch(): Promise<GoogleFile[]> {
    const query = new URLSearchParams({
      pageSize: "40",
      orderBy: "modifiedTime desc",
      q: "trashed = false",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      fields:
        "files(id,name,mimeType,modifiedTime,webViewLink,owners(displayName,emailAddress))",
    });
    const result = await googleGet<{
      files?: {
        id: string;
        name: string;
        mimeType: string;
        modifiedTime: string;
        webViewLink?: string;
        owners?: { displayName?: string; emailAddress?: string }[];
      }[];
    }>(`https://www.googleapis.com/drive/v3/files?${query}`, this.token);
    return (result.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      modifiedAt: f.modifiedTime,
      url: f.webViewLink ?? `https://drive.google.com/file/d/${f.id}/view`,
      owner: f.owners?.[0]?.displayName ?? f.owners?.[0]?.emailAddress ?? "",
    }));
  }
}
export async function syncGoogle(
  token: string,
  previous?: GoogleSnapshot | null,
): Promise<GoogleSnapshot> {
  const timestamp = new Date().toISOString();
  const adapters = [
    new GoogleCalendarAdapter(token),
    new GmailAdapter(token),
    new GoogleDriveAdapter(token),
  ];
  const results = await Promise.allSettled(adapters.map((a) => a.fetch()));
  if (results.every((r) => r.status === "rejected"))
    throw new Error("No Google sources available");
  const snapshot: GoogleSnapshot = {
    events: previous?.events ?? [],
    mail: previous?.mail ?? [],
    files: previous?.files ?? [],
    updatedAt: timestamp,
    sourceUpdatedAt: { ...previous?.sourceUpdatedAt },
    warnings: [],
  };
  const keys = ["events", "mail", "files"] as const;
  const names = ["Calendar", "Gmail", "Drive"];
  results.forEach((result, i) => {
    if (result.status === "fulfilled") {
      Object.assign(snapshot, { [keys[i]]: result.value });
      snapshot.sourceUpdatedAt[keys[i]] = timestamp;
    } else
      snapshot.warnings.push(
        `${names[i]} belum diperbarui. Periksa izin Google atau coba sync lagi; data sebelumnya tetap ditampilkan.`,
      );
  });
  return snapshot;
}
export function documentText(value: unknown, depth = 0): string {
  if (depth > 30 || !value || typeof value !== "object") return "";
  if (Array.isArray(value))
    return value
      .map((v) => documentText(v, depth + 1))
      .join("")
      .slice(0, 70000);
  const obj = value as Record<string, unknown>;
  if (obj.textRun && typeof obj.textRun === "object") {
    const text = (obj.textRun as { content?: unknown }).content;
    return typeof text === "string" ? text : "";
  }
  return Object.values(obj)
    .map((v) => documentText(v, depth + 1))
    .join("")
    .slice(0, 70000);
}
