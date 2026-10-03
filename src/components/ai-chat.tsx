"use client";
import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { getSupabase } from "@/lib/supabase";
export function AiChat({ cloud }: { cloud: boolean }) {
  const [messages, setMessages] = useState<
    { role: "user" | "assistant"; content: string }[]
  >([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
