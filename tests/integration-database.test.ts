import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile } from "node:fs/promises";
import { mockWorkspace } from "../src/data/mock";
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
test("Google credentials, GPT keys and proposals remain owner-scoped; proposal apply is atomic", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;insert into auth.users values('${alice}'),('${bob}');`,
    );
    for (const file of [
      "202610030001_workspace.sql",
      "202610030002_google.sql",
      "202610030003_gpt.sql",
    ])
      await db.exec(
        await readFile(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.query(
      "insert into public.google_connections(owner_id,email,credentials) values($1,$2,$3)",
      [alice, "alice@example.com", "ENCRYPTED"],
    );
    await db.query(
      "insert into public.gpt_bridge_keys(owner_id,secret_hash) values($1,$2)",
      [alice, "HASH"],
    );
    const { rows } = await db.query<{ id: string }>(
      "insert into public.gpt_proposals(owner_id,title,payload) values($1,$2,$3::jsonb) returning id",
      [alice, "New snapshot", JSON.stringify(mockWorkspace)],
    );
    const proposalId = rows[0].id;
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      alice,
    ]);
    assert.equal(
      (await db.query("select email from public.google_connections")).rows
        .length,
      1,
    );
    await assert.rejects(
      db.query("select credentials from public.google_connections"),
    );
    await assert.rejects(
      db.query("select secret_hash from public.gpt_bridge_keys"),
    );
    await assert.rejects(db.query("delete from public.google_connections"));
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      bob,
    ]);
    assert.equal(
      (await db.query("select email from public.google_connections")).rows
        .length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.gpt_proposals")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.apply_gpt_proposal($1,0)", [proposalId]),
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      alice,
    ]);
    const applied = await db.query<{ revision: number }>(
      "select public.apply_gpt_proposal($1,0) as revision",
      [proposalId],
    );
    assert.equal(applied.rows[0].revision, 1);
    await assert.rejects(
      db.query("select public.apply_gpt_proposal($1,1)", [proposalId]),
    );
    assert.equal(
      (
        await db.query<{ status: string }>(
          "select status from public.gpt_proposals",
        )
      ).rows[0].status,
      "Applied",
    );
  } finally {
    await db.close();
  }
});
