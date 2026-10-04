// Used by an authenticated MCP operator. No credentials or provider URLs are read.
import { readFileSync, writeFileSync } from "node:fs";
import { ingestPlaud } from "../src/services/plaud";
import { isWorkspace } from "../src/services/validation";
const [snapshotPath, recordingPath, outputPath] = process.argv.slice(2);
if (!snapshotPath || !recordingPath || !outputPath)
  throw new Error(
    "Usage: prepare-plaud-sync snapshot.json recording.json output.sql",
  );
const row = JSON.parse(readFileSync(snapshotPath, "utf8"));
const recording = JSON.parse(readFileSync(recordingPath, "utf8"));
if (
  !/^[0-9a-f-]{36}$/i.test(row.owner_id) ||
  !Number.isSafeInteger(row.revision) ||
  !isWorkspace(row.data)
)
  throw new Error("Invalid workspace snapshot");
const next = ingestPlaud(row.data, recording, new Date().toISOString());
if (!isWorkspace(next)) throw new Error("Invalid sync result");
if (next === row.data) {
  writeFileSync(outputPath, "-- Duplicate Plaud ID: no write required.\n", {
    mode: 0o600,
  });
  console.log(JSON.stringify({ status: "duplicate", id: recording.id }));
} else {
  // Replace only the four changed JSON fields, guarded by the exact revision.
  // Sheets, source records, manual actions/decisions and all other state stay intact.
  const delta = {
    plaudSources: next.plaudSources,
    plaudSync: next.plaudSync,
    meetings: next.meetings,
    ...(recording.projectId ? { projects: next.projects } : {}),
  };
  const literal = JSON.stringify(delta).replaceAll("'", "''");
  const sql = `update public.workspaces set data = data || '${literal}'::jsonb, revision = revision + 1, updated_at = now()\nwhere owner_id = '${row.owner_id}'::uuid and revision = ${row.revision}\nand not exists (select 1 from jsonb_array_elements(coalesce(data->'plaudSources','[]'::jsonb)) s where s->>'id' = '${recording.id.replaceAll("'", "''")}')\nreturning revision, jsonb_array_length(data->'plaudSources') as sources, jsonb_array_length(data->'meetings') as meetings;\n`;
  writeFileSync(outputPath, sql, { mode: 0o600 });
  writeFileSync(
    outputPath + ".workspace.json",
    JSON.stringify({ ...row, revision: row.revision + 1, data: next }),
    { mode: 0o600 },
  );
  console.log(
    JSON.stringify({
      status: "prepared",
      id: recording.id,
      expectedRevision: row.revision,
      drafts: next.plaudSources!.at(-1)!.drafts.length,
    }),
  );
}
