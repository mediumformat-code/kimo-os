"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Workspace } from "@/domain/models";
import { liveGoogle } from "@/services/live-google";
export function useLiveSync(
  data: Workspace,
  cloud: boolean,
  revision: (() => number | undefined) | undefined,
  refresh: () => void,
) {
  const [notice, setNotice] = useState("");
  const busy = useRef(false);
  const config = useRef({ data, cloud, revision, refresh });
  useEffect(() => {
    config.current = { data, cloud, revision, refresh };
  }, [data, cloud, revision, refresh]);
  const sync = useCallback(async () => {
    const c = config.current;
    if (
      busy.current ||
      !c.cloud ||
      !c.data.businessSync?.enabled ||
      document.visibilityState !== "visible"
    )
      return;
    const expected = c.revision?.();
    if (expected === undefined) return;
    busy.current = true;
    try {
      const result = await liveGoogle<{ changed: boolean }>({
        action: "sync",
        expectedRevision: expected,
      });
      if (result.changed) c.refresh();
      setNotice(
        result.changed
          ? "Live Google Sheets updated in OS."
          : "Live sheets checked — no changes.",
      );
    } catch (e) {
      setNotice(
        e instanceof Error
          ? e.message
          : "Live sheet sync failed; existing OS data retained.",
      );
    } finally {
      busy.current = false;
    }
  }, []);
  const enabled = cloud && data.businessSync?.enabled;
  useEffect(() => {
    if (!enabled) return;
    const timeout = setTimeout(() => {
      void sync();
    }, 1000);
    const interval = setInterval(
      () => {
        void sync();
      },
      5 * 60 * 1000,
    );
    const visibility = () => {
      void sync();
    };
    window.addEventListener("kimo-business-sync", visibility);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
      window.removeEventListener("kimo-business-sync", visibility);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled, sync]);
  return enabled ? notice : "";
}
