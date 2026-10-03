"use client";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
export function AiChat({ cloud }: { cloud: boolean }) {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [configured, setConfigured] = useState<boolean>();
  const [statusError, setStatusError] = useState("");
  useEffect(() => {
    if (!cloud) return;
    let active = true;
    async function check() {
      try {
        const { data } = await getSupabase().auth.getSession();
        if (!data.session) throw new Error("Login untuk mengecek koneksi AI.");
        const response = await fetch("/api/ai/status", {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
        });
        const result = await response.json();
        if (!response.ok)
          throw new Error(result.error || "Status AI belum dapat diperiksa.");
        if (active) setConfigured(result.configured);
      } catch (e) {
        if (active)
          setStatusError(
            e instanceof Error ? e.message : "Status belum tersedia.",
          );
      }
    }
    void check();
    return () => {
      active = false;
    };
  }, [cloud]);
  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const next = [
      ...messages,
      { role: "user" as const, content: input.trim() },
    ].slice(-10);
    setBusy(true);
    setError("");
    try {
      const { data } = await getSupabase().auth.getSession();
      if (!data.session) throw new Error("Silakan login.");
      const result = await fetch("/api/ai/chat", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: next }),
      });
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error ?? "AI belum tersedia.");
      setMessages([...next, { role: "assistant", content: payload.answer }]);
      setInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "AI belum tersedia.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel ai-chat">
      <h2>
        <Sparkles size={17} />
        Ask your Chief of Staff
      </h2>
      <p>
        Jawaban menggunakan workspace tersimpan. Saat kamu mengirim prompt,
        konteks workspace dikirim ke OpenAI. Tidak ada perubahan otomatis.
      </p>
      <div className="chief-connection-status">
        <p>
          <strong>OpenAI:</strong>{" "}
          {!cloud
            ? "Login required"
            : configured === undefined
              ? statusError || "Checking configuration…"
              : configured
                ? "Server key configured · kirim prompt untuk uji koneksi"
                : "Belum dikonfigurasi"}
        </p>
        {configured === false && (
          <p>
            Vercel → project KIMO OS → Environment Variables: tambahkan{" "}
            <code>OPENAI_API_KEY</code> sebagai Secret untuk Production, lalu
            redeploy. API memakai billing OpenAI terpisah dari langganan
            ChatGPT. Jangan kirim key di chat.
          </p>
        )}
        <p>
          <strong>GPT / Plaud context:</strong> konteks yang sudah disimpan di
          Sources dapat dibaca Chief of Staff. Private ChatGPT history dan akun
          Plaud belum tersinkron otomatis.
        </p>
        <button
          type="button"
          onClick={() => window.location.assign("/#sources")}
        >
          Import GPT Projects / Plaud in Sources →
        </button>
        <p>
          Custom GPT → Configure → Actions → Import from URL:{" "}
          <code>https://kimo-os-rbcy.vercel.app/api/gpt/schema</code>. Pilih API
          Key / Bearer dan gunakan key yang dibuat melalui Sources → GPT ↔ KIMO
          OS.
        </p>
      </div>
      {messages.map((m, i) => (
        <div className={`chat-message ${m.role}`} key={i}>
          <small>{m.role === "user" ? "You" : "KIMO OS"}</small>
          <p>{m.content}</p>
        </div>
      ))}
      {error && (
        <div className="access-error" role="alert">
          {error}
        </div>
      )}
      <form onSubmit={send}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={10000}
          placeholder="Apa yang membutuhkan perhatian saya?"
          disabled={!cloud || busy}
        />
        <button
          className="primary-button"
          disabled={!cloud || busy || !input.trim()}
        >
          {busy ? "Thinking…" : "Ask KIMO OS"}
          <ArrowRight size={15} />
        </button>
      </form>
      {!cloud && <p>Login ke cloud workspace untuk menggunakan AI.</p>}
    </section>
  );
}
