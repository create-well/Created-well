import React, { useState, useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { DashboardProvider } from "../contexts/DashboardContext";
import {
  AuthGate,
  isAuthenticated,
  getStoredProfile,
} from "./components/AuthGate";
import { captureRecoveryMarker, recoveryLatched } from "../lib/recoveryEntry";

// ── Password recovery: latch the marker at module-eval time (R-0) ───────────
// Runs when this module is first evaluated — before React mounts and before
// any Supabase client can parse and strip the URL hash. The Nov 5 hold read
// the hash from the gate's mount effect and subscribed for the
// PASSWORD_RECOVERY event; both are races the client can win, and on
// 2026-11-06 it won: a fresh recovery link signed straight into the
// dashboard with no set-password form. The latch in sessionStorage is the
// structural evidence: AuthGate holds on it, App refuses to enter on it,
// and only a completed password set or an explicit sign-out clears it.
(function captureRecoveryArrival() {
  try {
    captureRecoveryMarker(window.location.hash, sessionStorage);
  } catch {}
})();
import { useThemeInit } from "./components/ThemeProvider";
import { GCAL_CLIENT_ID, GCAL_REDIRECT_URI } from "./components/data";

// ── Dev bypass (VITE_DEV_BYPASS) ─────────────────────────────────────────────
// Set in .env.local to skip the auth gate during local development.
// Value: 'true' → monny profile; or any profile key: sunshine/bingle/omar/pia/event-support
// ── Supabase anon key (env only) ─────────────────────────────────────────────
// The GCal OAuth token exchange authenticates with the anon key.
// It resolves from env like every other client key (registers
// 1323/1340); a missing var fails the boot by name rather than
// falling back to the generated file's literal.
const SUPABASE_ANON_KEY: string = (() => {
  const v = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (!v) {
    throw new Error('VITE_SUPABASE_ANON_KEY is not set — the GCal token exchange cannot authenticate without it.');
  }
  return v;
})();

const _VALID_PROFILES = ['sunshine','monny','bingle','omar','pia','event-support'];
const DEV_BYPASS_PROFILE = (() => {
  const v = (import.meta.env.VITE_DEV_BYPASS as string | undefined) ?? '';
  if (!v || v === 'false') return null;
  return _VALID_PROFILES.includes(v) ? v : 'monny';
})();


// ── Google Calendar OAuth: capture auth code at module-eval time ──────────────
(function captureOAuthCode() {
  try {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (!code) return;

    const codeVerifier = localStorage.getItem(
      "gcal_pkce_verifier",
    );
    if (!codeVerifier) {
      console.error(
        "[GCal OAuth] No PKCE code_verifier in localStorage — ignoring ?code param",
      );
      return;
    }

    window.history.replaceState(
      null,
      "",
      window.location.pathname,
    );
    console.log(
      "[GCal OAuth] Auth code captured, exchanging for token via server...",
    );
    localStorage.setItem("gcal_token_fresh", "pending");

    import("/utils/supabase/info").then(
      ({ projectId }) => {
        const host = window.location.hostname;
        const isFirstPartyHost =
          host.endsWith(".vercel.app") ||
          host === "cr8w.com" ||
          host.endsWith(".cr8w.com") ||
          host === "cr8w.com" ||
          host.endsWith(".cr8w.com") ||
          host === "createwell.monnyfest.co" ||
          host.endsWith(".monnyfest.co") ||
          host.endsWith(".monnyfest.co") ||
          host === "localhost" ||
          host === "127.0.0.1";
        const apiBase =
          (import.meta.env.VITE_API_BASE as
            string | undefined) ??
          (isFirstPartyHost
            ? "/api/server"
            : `https://${projectId}.supabase.co/functions/v1/make-server-dabe1c74`);
        const serverUrl = `${apiBase}/gcal-token-exchange`;

        fetch(serverUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            code,
            code_verifier: codeVerifier,
            redirect_uri: GCAL_REDIRECT_URI,
            client_id: GCAL_CLIENT_ID,
          }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.error) {
              console.error(
                "[GCal OAuth] Token exchange error:",
                data.error,
                data.error_description,
              );
              localStorage.setItem("gcal_token_fresh", "error");
              localStorage.setItem(
                "gcal_token_error",
                data.error_description || data.error,
              );
              return;
            }
            if (data.access_token) {
              localStorage.setItem(
                "gcal_access_token",
                data.access_token,
              );
              const oauthUser = localStorage.getItem(
                "gcal_oauth_user",
              );
              if (oauthUser)
                localStorage.setItem(
                  `gcal_token_${oauthUser.toUpperCase()}`,
                  data.access_token,
                );
              localStorage.setItem("gcal_token_fresh", "ready");
              console.log(
                "[GCal OAuth] Token exchange successful" +
                  (oauthUser ? ` for ${oauthUser}` : ""),
              );
            }
            localStorage.removeItem("gcal_pkce_verifier");
          })
          .catch((err) => {
            console.error(
              "[GCal OAuth] Token exchange fetch error:",
              err,
            );
            localStorage.setItem("gcal_token_fresh", "error");
            localStorage.setItem(
              "gcal_token_error",
              String(err),
            );
          });
      },
    );
  } catch (e) {
    console.error("[GCal OAuth] Code capture error:", e);
  }
})();

// ── PWA meta tags + service worker registration ───────────────────────────────
function usePWA() {
  useEffect(() => {
    const metaTags: { name: string; content: string }[] = [
      { name: "theme-color", content: "#C25B38" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      {
        name: "apple-mobile-web-app-status-bar-style",
        content: "black-translucent",
      },
      {
        name: "apple-mobile-web-app-title",
        content: "Create Well",
      },
    ];
    const injected: HTMLElement[] = [];
    for (const tag of metaTags) {
      if (
        document.head.querySelector(`meta[name="${tag.name}"]`)
      )
        continue;
      const el = document.createElement("meta");
      el.setAttribute("name", tag.name);
      el.setAttribute("content", tag.content);
      document.head.appendChild(el);
      injected.push(el);
    }
    if (!document.head.querySelector('link[rel="manifest"]')) {
      const manifest = document.createElement("link");
      manifest.rel = "manifest";
      manifest.href = "/manifest.json";
      document.head.appendChild(manifest);
      injected.push(manifest);
    }
    if (
      !document.head.querySelector(
        'link[rel="apple-touch-icon"]',
      )
    ) {
      const icon = document.createElement("link");
      icon.rel = "apple-touch-icon";
      icon.href = "/logo.svg";
      document.head.appendChild(icon);
      injected.push(icon);
    }
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) =>
          console.log(
            "[PWA] Service worker registered:",
            reg.scope,
          ),
        )
        .catch((err) =>
          console.log(
            "[PWA] Service worker registration failed:",
            err,
          ),
        );
    }
    return () => {
      injected.forEach((el) => el.remove());
    };
  }, []);
}

export default function App() {
  useThemeInit();
  usePWA();

  const [authed, setAuthed] = useState(
    // R-0: a latched recovery never enters on the stored session — the
    // gate renders instead and holds at the set-new-password form. The
    // latch is module-captured above, so this read cannot lose the race.
    () =>
      (!!DEV_BYPASS_PROFILE || isAuthenticated()) &&
      !recoveryLatched(sessionStorage)
  );
  const [chatActiveUser, setChatActiveUser] = useState(() => {
    if (DEV_BYPASS_PROFILE) return DEV_BYPASS_PROFILE;
    const p = getStoredProfile();
    return p && p !== "event-support" ? p : "monny";
  });

  // Seed localStorage so downstream reads of cr8w_user_profile work in bypass mode
  useEffect(() => {
    if (DEV_BYPASS_PROFILE) {
      localStorage.setItem("cr8w_user_profile", DEV_BYPASS_PROFILE);
    }
  }, []);

  function handleAuthenticated(profileKey: string) {
    setAuthed(true);
    setChatActiveUser(
      profileKey === "event-support" ? "monny" : profileKey,
    );
  }

  async function handleSignOut() {
    const { signOut } = await import("./components/AuthGate");
    await signOut();
    setAuthed(false);
    window.location.reload();
  }

  if (!authed) {
    return <AuthGate onAuthenticated={handleAuthenticated} />;
  }

  return (
    <DashboardProvider onSignOut={handleSignOut}>
      <RouterProvider router={router} />
    </DashboardProvider>
  );
}