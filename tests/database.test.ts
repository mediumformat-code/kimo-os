import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { mockWorkspace } from "../src/data/mock";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
test("PostgreSQL migration enforces owner isolation, revisions and authentication", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; insert into auth.users values ('${alice}'),('${bob}');`,
    );
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202610030001_workspace.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      alice,
    ]);
    const first = await db.query<{ revision: number }>(
      "select public.save_workspace($1::jsonb,0) as revision",
      [JSON.stringify(mockWorkspace)],
    );
    assert.equal(first.rows[0].revision, 1);
    await assert.rejects(
      db.query("select public.save_workspace($1::jsonb,0)", [
        JSON.stringify(mockWorkspace),
      ]),
      (e) => (e as { code: string }).code === "40001",
    );
    await assert.rejects(
      db.query("update public.workspaces set revision=99"),
      (e) => (e as { code: string }).code === "42501",
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      bob,
    ]);
    assert.equal(
      (await db.query("select * from public.workspaces")).rows.length,
      0,
    );
    await db.query("select public.save_workspace($1::jsonb,0)", [
      JSON.stringify(mockWorkspace),
    ]);
    const bobRows = await db.query<{ owner_id: string }>(
      "select owner_id from public.workspaces",
    );
    assert.deepEqual(
      bobRows.rows.map((r) => r.owner_id),
      [bob],
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      alice,
    ]);
    const second = await db.query<{ revision: number }>(
      "select public.save_workspace($1::jsonb,1) as revision",
      [JSON.stringify(mockWorkspace)],
    );
    assert.equal(second.rows[0].revision, 2);
    await assert.rejects(
      db.query("select public.save_workspace($1::jsonb,2)", [
        JSON.stringify({}),
      ]),
      (e) => (e as { code: string }).code === "23514",
    );
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    await assert.rejects(
      db.query("select public.save_workspace($1::jsonb,2)", [
        JSON.stringify(mockWorkspace),
      ]),
      (e) => (e as { code: string }).code === "42501",
    );
    await db.exec("reset role; set role anon");
    await assert.rejects(
      db.query("select * from public.workspaces"),
      (e) => (e as { code: string }).code === "42501",
    );
    await assert.rejects(
      db.query("select public.save_workspace($1::jsonb,0)", [
        JSON.stringify(mockWorkspace),
      ]),
      (e) => (e as { code: string }).code === "42501",
    );
  } finally {
    await db.close();
  }
});
