import React, { useState, useEffect } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import { DashboardProvider } from "../contexts/DashboardContext";
import {
  AuthGate,
  isAuthenticated,
  getStoredProfile,
} from "./components/AuthGate";
import { useThemeInit } from "./components/ThemeProvider";

// ── Google Calendar OAuth: capture callback result at module-eval time ───────
(function captureGoogleOAuthResult() {
  try {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("gcal_access_token");
    const error = params.get("gcal_error");
    if (!accessToken && !error) return;

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );

    const returnedNonce = params.get("gcal_nonce");
    const expectedNonce = localStorage.getItem("gcal_oauth_nonce");
    if (!returnedNonce || returnedNonce !== expectedNonce) {
      console.error(
        "[GCal OAuth] State nonce mismatch — ignoring callback result",
      );
      localStorage.setItem("gcal_token_fresh", "error");
      localStorage.setItem(
        "gcal_token_error",
        "Google Calendar connection failed state verification. Try reconnecting.",
      );
      return;
    }

    localStorage.removeItem("gcal_oauth_nonce");
    if (error) {
      console.error("[GCal OAuth] Callback error:", error);
      localStorage.setItem("gcal_token_fresh", "error");
      localStorage.setItem("gcal_token_error", error);
      return;
    }

    const oauthUser =
      params.get("gcal_user") ?? localStorage.getItem("gcal_oauth_user");
    if (!oauthUser || !accessToken) {
      localStorage.setItem("gcal_token_fresh", "error");
      localStorage.setItem(
        "gcal_token_error",
        "Google Calendar connection returned no token. Try reconnecting.",
      );
      return;
    }

    localStorage.setItem("gcal_access_token", accessToken);
    localStorage.setItem(
      `gcal_token_${oauthUser.toUpperCase()}`,
      accessToken,
    );
    const refreshToken = params.get("gcal_refresh_token");
    if (refreshToken) {
      localStorage.setItem(
        `gcal_refresh_token_${oauthUser.toUpperCase()}`,
        refreshToken,
      );
    }
    localStorage.setItem("gcal_token_fresh", "ready");
    console.log(`[GCal OAuth] Token exchange successful for ${oauthUser}`);
  } catch (e) {
    console.error("[GCal OAuth] Callback capture error:", e);
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
      icon.href =
        "/assets/26b5a4fd9027610adb3ddb9ed89749cb683707dd.png";
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

  const [authed, setAuthed] = useState(() => isAuthenticated());
  const [chatActiveUser, setChatActiveUser] = useState(() => {
    const p = getStoredProfile();
    return p && p !== "event-support" ? p : "monny";
  });

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
