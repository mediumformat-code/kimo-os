import { createHash, randomUUID } from "node:crypto";
import { googleGet } from "./adapters";
import { businessSources } from "./sources";
import type { SourceSheet } from "@/services/business-import";
import { GoogleHttpError } from "./server";
export const SHEETS_WRITE_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets";
export interface LiveSheet extends SourceSheet {
  spreadsheetId: string;
  sheetId: number;
  columnCount: number;
  rowCount: number;
  formulas: string[][];
}
export interface CellPatch {
  sheet: string;
  row: number;
  column: number;
  value: string;
  formula: boolean;
  reason: string;
}
const range = (title: string) => `'${title.replaceAll("'", "''")}'`;
const wanted = [
  "DDO TASK",
  "Project Pipeline 2026",
  "Seedlist 2026",
  "Pipeline 2026 Detail",
  "Budget & Timeline Finance ",
  "Pipeline 2026",
  "Year",
];
export async function readLiveSheets(token: string): Promise<LiveSheet[]> {
  const all = await Promise.all(
    businessSources.map(async (source) => {
      const meta = await googleGet<{
        properties: { title: string };
        sheets: {
          properties: {
            sheetId: number;
            title: string;
            gridProperties: { columnCount: number; rowCount: number };
          };
        }[];
      }>(
        `https://sheets.googleapis.com/v4/spreadsheets/${source.id}?fields=properties(title),sheets(properties(sheetId,title,gridProperties))`,
        token,
      );
      const sheets = meta.sheets.filter((s) =>
        wanted.includes(s.properties.title),
      );
      if (!sheets.length)
        throw new GoogleHttpError(
          409,
          `${source.name}: tab yang dikenal tidak ditemukan.`,
        );
      const query = new URLSearchParams();
      sheets.forEach((s) => query.append("ranges", range(s.properties.title)));
      const [formatted, formulas] = await Promise.all(
        ["FORMATTED_VALUE", "FORMULA"].map((render) =>
          googleGet<{ valueRanges: { values?: unknown[][] }[] }>(
            `https://sheets.googleapis.com/v4/spreadsheets/${source.id}/values:batchGet?${query}&valueRenderOption=${render}`,
            token,
          ),
        ),
      );
      return sheets.map((s, i) => {
        const rows = (formatted.valueRanges[i].values ?? []).map((r) =>
          r.map((v) => String(v)),
        );
        if (rows.length > 2000)
          throw new GoogleHttpError(
            409,
            `${s.properties.title} melebihi 2000 baris; sync dihentikan agar data tidak terpotong.`,
          );
        return {
          id: `google:${source.id}:${s.properties.sheetId}`,
          file: source.name,
          title: s.properties.title,
          rows,
          live: true,
          spreadsheetId: source.id,
          sheetId: s.properties.sheetId,
          columnCount: s.properties.gridProperties.columnCount,
          rowCount: s.properties.gridProperties.rowCount,
          formulas: (formulas.valueRanges[i].values ?? []).map((r) =>
            r.map((v) => String(v)),
          ),
        };
      });
    }),
  );
  return all.flat();
}
export function sourceHash(sheets: LiveSheet[]) {
  return createHash("sha256")
    .update(JSON.stringify(sheets.map((s) => [s.id, s.rows, s.formulas])))
    .digest("hex");
}
// FORMULA render includes literal input cells. Ignore recalculated display values
// when checking for edits during backup (NOW/TODAY must not invalidate a backup).
export function sourceInputHash(sheets: LiveSheet[]) {
  return createHash("sha256")
    .update(JSON.stringify(sheets.map((s) => [s.id, s.title, s.formulas])))
    .digest("hex");
}
export function refinementPlan(sheets: LiveSheet[]) {
  const patches: CellPatch[] = [];
  const warnings: string[] = [];
  const statuses: Record<
    string,
    { sheet: LiveSheet; column: number; start: number }
  > = {};
  const patch = (
    s: LiveSheet,
    row: number,
    column: number,
    value: string,
    reason: string,
    formula = true,
  ) => {
    if (
      (s.formulas[row - 1]?.[column - 1] ??
        s.rows[row - 1]?.[column - 1] ??
        "") !== value
    )
      patches.push({ sheet: s.id, row, column, value, formula, reason });
  };
  for (const s of sheets) {
    if (s.title === "Seedlist 2026" && s.file === "DDS commercial pipeline")
      continue;
    const h = s.rows.findIndex(
      (r, i) =>
        i < 30 &&
        (r.some((c) => /^(task title|project name)$/i.test(c.trim())) ||
          (r.some((c) => /^company$/i.test(c.trim())) &&
            r.some((c) => /^commercial pic$/i.test(c.trim())))),
    );
    if (h >= 0) {
      const heads = s.rows[h].map((c) => c.trim().toLowerCase());
      const name = heads.indexOf(
        heads.includes("task title")
          ? "task title"
          : heads.includes("commercial pic")
            ? "company"
            : "project name",
      );
      let key = heads.indexOf("kimo row key");
      if (key < 0) {
        key = Math.max(heads.length, ...s.rows.map((r) => r.length));
        patch(
          s,
          h + 1,
          key + 1,
          "KIMO Row Key",
          "Stable identity for source rows",
          false,
        );
      }
      const seen = new Set<string>();
      for (let r = h + 1; r < s.rows.length; r++) {
        const label = s.rows[r][name]?.trim();
        if (
          !label ||
          /^(last update|total|grand total|project name)$/i.test(label)
        )
          continue;
        const old = s.rows[r][key]?.trim();
        if (old && seen.has(old))
          throw new GoogleHttpError(
            409,
            `${s.title}: KIMO Row Key duplikat di row ${r + 1}.`,
          );
        if (old) seen.add(old);
        else
          patch(
            s,
            r + 1,
            key + 1,
            `kimo-${randomUUID()}`,
            "Add stable source identity without changing native ID",
            false,
          );
      }
      if (s.title === "DDO TASK") {
        const col = heads.indexOf("status");
        statuses[s.id] = { sheet: s, column: col, start: h + 1 };
      }
    }
    if (s.title === "Pipeline 2026 Detail") {
      const expected = [
        "Lost",
        "Pre - Project Value",
        "Project Value",
        "Agency Fee",
        "Tax",
        "Expected Revenue",
        "Total Expenses",
        "Margin",
        "Profit",
      ];
      if (!expected.every((v, i) => s.rows[11]?.[9 + i]?.trim() === v))
        throw new GoogleHttpError(
          409,
          "Header financial berbeda; review manual diperlukan sebelum refine.",
        );
      const end = s.rows.length;
      for (let c = 10; c <= 18; c++) {
        const letter = String.fromCharCode(64 + c);
        patch(
          s,
          11,
          c,
          c === 17
            ? '=IF(O11=0,"",R11/O11)'
            : `=SUMIF($D$13:$D,"<>",${letter}13:${letter})`,
          "Complete source totals and weighted margin",
        );
      }
      for (let r = 13; r <= end; r++)
        if (s.formulas[r - 1]?.[16]?.startsWith("="))
          patch(
            s,
            r,
            17,
            `=IF(O${r}=0,"",R${r}/O${r})`,
            "Avoid division by zero; preserve unknown margin",
          );
      if (s.rows[52]?.[0]?.trim() === "Dunhill") {
        patch(s, 53, 14, "=(L53+M53)*2%", "Repair shifted financial reference");
        patch(s, 53, 15, "=L53-N53", "Repair shifted financial reference");
      }
      if (s.rows[56]?.[0]?.trim() === "Enervon C Maybank")
        patch(s, 57, 14, "=(L57+M57)*2%", "Repair shifted financial reference");
      warnings.push(
        "Revenue/profit/agency-fee basis on commercial rows 53, 54, 55, 57 remains for accounting review. No business values inferred.",
      );
    }
    if (s.title === "Budget & Timeline Finance ") {
      if (s.rows[1]?.[11]?.trim() !== "Expected Revenue")
        throw new GoogleHttpError(409, "Finance headers changed.");
      for (let c = 8; c <= 13; c++)
        patch(
          s,
          3,
          c,
          `=SUM(${String.fromCharCode(64 + c)}4:${String.fromCharCode(64 + c)}52)`,
          "Include first financial row in total",
        );
      patch(s, 3, 14, '=IF(L3=0,"",M3/L3)', "Weighted margin");
      for (let r = 4; r <= 52; r++)
        if (s.formulas[r - 1]?.[13]?.startsWith("="))
          patch(
            s,
            r,
            14,
            `=IF(L${r}=0,"",M${r}/L${r})`,
            "Zero denominator guard",
          );
    }
    if (
      s.title === "Pipeline 2026" &&
      s.rows[1]?.some((v) => v.trim() === "Project Name")
    ) {
      patch(
        s,
        1,
        8,
        "=SUM(H3:H24)",
        "Exclude existing grand total from summary",
      );
      patch(
        s,
        1,
        11,
        "=SUM(K3:K24)",
        "Exclude existing grand total from summary",
      );
      patch(s, 1, 10, '=IF(H1=0,"",K1/H1)', "Weighted margin");
    }
    if (s.title === "Year")
      for (let m = 1; m <= 12; m++)
        for (let week = 0; week < 6; week++)
          for (let day = 0; day < 7; day++) {
            const r = 4 + Math.floor((m - 1) / 3) * 9 + week;
            const c = 2 + ((m - 1) % 3) * 8 + day;
            const n = `${week * 7 + day + 2}-WEEKDAY(DATE($Z$1,${m},1))`;
            patch(
              s,
              r,
              c,
              `=IF(AND(${n}>=1,${n}<=DAY(EOMONTH(DATE($Z$1,${m},1),0))),${n},"")`,
              "Locale-independent calendar formula",
            );
          }
  }
  return { patches, warnings, statuses };
}
export async function googlePost<T>(
  url: string,
  token: string,
  body: unknown,
  stage = "Google Sheets",
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new GoogleHttpError(
      503,
      `${stage}: koneksi Google terputus atau timeout. Baca preview kembali sebelum retry.`,
    );
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const raw =
      typeof payload?.error?.message === "string"
        ? payload.error.message
        : "Google menolak operasi.";
    const detail = raw
      .replaceAll(token, "[redacted]")
      .replace(/(?:ya29\.|GOCSPX-)[A-Za-z0-9._-]+/g, "[redacted]")
      .slice(0, 400);
    throw new GoogleHttpError(
      [400, 401, 403, 404, 409, 429].includes(response.status)
        ? response.status
        : 503,
      `${stage} · Google ${response.status}: ${detail}`,
    );
  }
  return response.json();
}
export async function applyRefinements(
  token: string,
  sheets: LiveSheet[],
  plan: ReturnType<typeof refinementPlan>,
  beforeWrite?: (backups: { source: string; url: string }[]) => Promise<void>,
) {
  const backups: { source: string; url: string }[] = [];
  const groups = [
    ...new Set(
      plan.patches.map(
        (p) => sheets.find((s) => s.id === p.sheet)!.spreadsheetId,
      ),
    ),
  ];
  // Finish every backup before any source is edited.
  for (const id of groups) {
    const tabs = sheets.filter(
      (s) =>
        s.spreadsheetId === id && plan.patches.some((p) => p.sheet === s.id),
    );
    const created = await googlePost<{ spreadsheetId: string }>(
      "https://sheets.googleapis.com/v4/spreadsheets",
      token,
      {
        properties: {
          title: `KIMO pre-refine backup ${new Date().toISOString()} — ${tabs[0].file}`,
        },
      },
      `Membuat backup ${tabs[0].file}`,
    );
    for (const tab of tabs)
      await googlePost(
        `https://sheets.googleapis.com/v4/spreadsheets/${id}/sheets/${tab.sheetId}:copyTo`,
        token,
        { destinationSpreadsheetId: created.spreadsheetId },
        `Menyalin backup ${tab.file} / ${tab.title}`,
      );
    backups.push({
      source: id,
      url: `https://docs.google.com/spreadsheets/d/${created.spreadsheetId}/edit`,
    });
  }
  await beforeWrite?.(backups);
  for (const id of groups) {
    const changes = plan.patches.filter(
      (p) => sheets.find((s) => s.id === p.sheet)!.spreadsheetId === id,
    );
    const requests: unknown[] = [];
    const tabs = sheets.filter((s) => s.spreadsheetId === id);
    for (const s of tabs) {
      const max = Math.max(
        s.columnCount,
        ...changes.filter((p) => p.sheet === s.id).map((p) => p.column),
      );
      if (max > s.columnCount)
        requests.push({
          appendDimension: {
            sheetId: s.sheetId,
            dimension: "COLUMNS",
            length: max - s.columnCount,
          },
        });
    }
    for (const p of changes) {
      const s = sheets.find((s) => s.id === p.sheet)!;
      requests.push({
        updateCells: {
          range: {
            sheetId: s.sheetId,
            startRowIndex: p.row - 1,
            endRowIndex: p.row,
            startColumnIndex: p.column - 1,
            endColumnIndex: p.column,
          },
          rows: [
            {
              values: [
                {
                  userEnteredValue: p.formula
                    ? { formulaValue: p.value }
                    : { stringValue: p.value },
                },
              ],
            },
          ],
          fields: "userEnteredValue",
        },
      });
    }
    for (const value of Object.values(plan.statuses).filter(
      (v) => v.sheet.spreadsheetId === id && v.column >= 0,
    ))
      requests.push({
        setDataValidation: {
          range: {
            sheetId: value.sheet.sheetId,
            startRowIndex: value.start,
            endRowIndex: value.sheet.rowCount,
            startColumnIndex: value.column,
            endColumnIndex: value.column + 1,
          },
          rule: {
            condition: {
              type: "ONE_OF_LIST",
              values: [
                "In Pipeline",
                "In Progress",
                "Stuck",
                "Completed",
                "To Do",
                "On Hold",
              ].map((userEnteredValue) => ({ userEnteredValue })),
            },
            strict: true,
            showCustomUi: true,
          },
        },
      });
    await googlePost(
      `https://sheets.googleapis.com/v4/spreadsheets/${id}:batchUpdate`,
      token,
      { requests },
      `Memperbaiki ${tabs[0].file}`,
    );
  }
  return backups;
}
