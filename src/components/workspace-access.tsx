"use client";
import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, Mail, ShieldCheck, LogOut } from "lucide-react";
import { cloudConfiguration, getSupabase } from "@/lib/supabase";
import { createCloudWorkspaceService } from "@/services/cloud-workspace";
import { CommandCenter } from "./command-center";
const configuration = cloudConfiguration();
function CloudWorkspace({ session }: { session: Session }) {
  const service = useMemo(
    () => createCloudWorkspaceService(getSupabase(), session.user.id),
    [session.user.id],
  );
  const [signOutError, setSignOutError] = useState("");
  async function signOut() {
    const { error } = await getSupabase().auth.signOut({ scope: "local" });
    if (error)
      setSignOutError(
        "Could not sign out. Check your connection and try again.",
      );
  }
  return (
    <>
      <CommandCenter
        key={session.user.id}
        service={service}
        cloud
        email={session.user.email}
        onSignOut={signOut}
      />
      {signOutError && (
        <div className="auth-error-floating" role="alert">
          {signOutError}
          <button onClick={() => setSignOutError("")}>Dismiss</button>
        </div>
      )}
    </>
  );
}
export function WorkspaceAccess() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(configuration === "cloud");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  useEffect(() => {
    if (configuration !== "cloud") return;
    let active = true;
    try {
      const client = getSupabase();
      const { data: listener } = client.auth.onAuthStateChange(
        (_event, next) => {
          if (active) {
            setSession(next);
            setLoading(false);
          }
        },
      );
      client.auth
        .getSession()
        .then(({ data, error }) => {
          if (!active) return;
          setSession(data.session);
          if (error)
            setError("Could not restore your session. Please sign in again.");
          setLoading(false);
        })
        .catch(() => {
          if (active) {
            setError(
              "Could not connect to authentication. Check the project settings and your connection.",
            );
            setLoading(false);
          }
        });
      return () => {
        active = false;
        listener.subscription.unsubscribe();
      };
    } catch {
      queueMicrotask(() => {
        if (active) {
          setError(
            "Supabase configuration is invalid. Check the project URL and publishable key.",
          );
          setLoading(false);
        }
      });
      return () => {
        active = false;
      };
    }
  }, []);
  async function sendLink(event: React.FormEvent) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false,
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;
      setSent(true);
    } catch {
      setError(
        "Could not send a sign-in link. Check your connection, email, and Supabase email configuration.",
      );
    } finally {
      setSending(false);
    }
  }
  if (configuration === "demo") return <CommandCenter />;
  if (session) return <CloudWorkspace session={session} />;
  return (
    <div className="access-shell">
      <div className="access-brand">
        <div className="brand-symbol">
          k<span>◦</span>
        </div>
        KIMO OS
      </div>
      <section className="access-card">
        <span className="eyebrow">YOUR PERSONAL EXECUTIVE WORKSPACE</span>
        <h1>
          {configuration === "incomplete"
            ? "Finish connecting your workspace"
            : loading
              ? "Opening your workspace…"
              : sent
                ? "Check your email."
                : "A clear head starts here."}
        </h1>
        <p>
          {configuration === "incomplete"
            ? "Set both the Supabase project URL and public publishable key, then rebuild the app."
            : loading
              ? "Restoring your secure session."
              : sent
                ? "If your account is authorized, you’ll receive a secure sign-in link. Open it in this browser to continue."
                : "Sign in to keep your priorities, decisions, and commitments together across your devices."}
        </p>
        {error && (
          <div className="access-error" role="alert">
            {error}
          </div>
        )}
        {!loading && configuration === "cloud" && !sent && (
          <form onSubmit={sendLink}>
            <label className="field-label">
              Email address
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={sending}
              />
            </label>
            <button className="primary-button" type="submit" disabled={sending}>
              {sending ? "Sending…" : "Email me a sign-in link"}
              <ArrowRight size={16} />
            </button>
          </form>
        )}
        {sent && (
          <div className="access-sent">
            <Mail size={20} />
            <span>Sent to {email}</span>
            <button
              className="text-button"
              onClick={() => {
                setSent(false);
                setError("");
              }}
            >
              Use another email
            </button>
          </div>
        )}
        <div className="access-footnote">
          <ShieldCheck size={15} />
          <span>
            Access is limited to accounts created by the workspace owner.
          </span>
        </div>
        {configuration === "incomplete" && (
          <small>
            Configure NEXT_PUBLIC_SUPABASE_URL and
            NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.
          </small>
        )}
      </section>
      <div className="access-footer">
        <LogOut size={13} /> Your workspace stays private. Your data stays
        yours.
      </div>
    </div>
  );
}
