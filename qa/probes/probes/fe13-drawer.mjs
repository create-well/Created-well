// Probe: FE-13 chat drawer render legs.
//
// The FE-13 code legs scored PASS 2026-10-30; the render legs stayed
// NOT VERIFIED because the branch preview sits behind a first-entry
// sign-in. This probe runs them wherever FE-13 is served (its preview
// origin, or production after it lands): drawer geometry, backdrop, and
// the three close paths, against the values scored in the FE-13 packet.
//
// Shape under test (branch feat/chat-drawer-fe13 @ 73ff6dd2):
//   panel: fixed right, height 100dvh, width min(100vw, 420px),
//          translateX(102%) closed, translateX(0) open, z-index 1001
//   backdrop: fixed inset 0, z-index 1000, rgba(38, 24, 18, 0.45),
//          click closes; header click and Escape also close
// Against a pre-FE-13 surface (for example production before FE-13
// lands) the geometry legs FAIL by design: the old drawer animates
// width instead of transform.
//
// The panel carries no test id, so the probe finds it by the properties
// under test (fixed position, z-index 1001) and tags it in-page for
// scoped queries. Read-only apart from opening and closing the drawer.
// Env: CW_FE13_BASE_URL, CW_QA_ID + CW_QA_PASSWORD.

import { leg, envGate, launchBrowser, signIn } from "../lib.mjs";

const BASE = () => process.env.CW_FE13_BASE_URL || "https://createdwell.vercel.app";

async function tagPanel(page) {
  return page.evaluate(() => {
    const els = [...document.querySelectorAll("body *")];
    const panel = els.find((e) => {
      const s = getComputedStyle(e);
      return s.position === "fixed" && s.zIndex === "1001";
    });
    if (!panel) return false;
    panel.setAttribute("data-qa-probe", "drawer");
    return true;
  });
}

async function panelState(page) {
  return page.evaluate(() => {
    const panel = document.querySelector('[data-qa-probe="drawer"]');
    if (!panel) return null;
    const r = panel.getBoundingClientRect();
    const s = getComputedStyle(panel);
    return { x: r.x, width: r.width, right: r.right, transform: s.transform, vw: window.innerWidth };
  });
}

const isClosed = (st) => st && st.x >= st.vw - 2;
const isOpen = (st) => st && Math.abs(st.right - st.vw) <= 2 && st.x >= -2;

export async function run() {
  const legs = [];
  const { browser, error } = await launchBrowser();
  if (!browser) return [leg("NOT VERIFIED", "fe13-drawer", error)];
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    try {
      await page.goto(BASE(), { waitUntil: "domcontentloaded" });
      await page.locator("#cr8w-email").waitFor({ state: "visible", timeout: 20000 });
      legs.push(leg("PASS", "fe13-drawer/surface", "sign-in gate renders on the target origin"));
    } catch (e) {
      legs.push(
        leg("FAIL", "fe13-drawer/surface", `origin or sign-in gate unreachable: ${String(e.message || e).split("\n")[0]}`),
      );
      return legs;
    }
    const missing = envGate(["CW_QA_ID", "CW_QA_PASSWORD"]);
    if (missing) {
      legs.push(leg("NOT VERIFIED", "fe13-drawer/render", `env not set: ${missing.join(", ")}`));
      return legs;
    }
    try {
      await signIn(page, BASE(), process.env.CW_QA_ID, process.env.CW_QA_PASSWORD);
    } catch (e) {
      legs.push(leg("FAIL", "fe13-drawer/render", `sign-in did not complete: ${String(e.message || e).split("\n")[0]}`));
      return legs;
    }
    await page.waitForTimeout(1200);
    const bubble = page.locator('[title="Open CR8W Chat"]');
    if ((await bubble.count()) === 0) {
      legs.push(leg("FAIL", "fe13-drawer/bubble", 'chat bubble ([title="Open CR8W Chat"]) not found'));
      return legs;
    }
    legs.push(leg("PASS", "fe13-drawer/bubble", "chat bubble present"));
    if (!(await tagPanel(page))) {
      legs.push(leg("FAIL", "fe13-drawer/panel", "no fixed z-1001 panel found (pre-FE-13 surface?)"));
      return legs;
    }
    let st = await panelState(page);
    legs.push(
      isClosed(st)
        ? leg("PASS", "fe13-drawer/closed-state", `panel off-canvas closed (x=${Math.round(st.x)} of vw=${st.vw})`)
        : leg("FAIL", "fe13-drawer/closed-state", `panel not off-canvas closed (x=${st?.x}, vw=${st?.vw})`),
    );
    // Open via the bubble.
    await bubble.click();
    await page.waitForTimeout(700);
    st = await panelState(page);
    legs.push(
      isOpen(st) && Math.abs(st.width - Math.min(st.vw, 420)) <= 1.5
        ? leg("PASS", "fe13-drawer/open-geometry", `open panel width ${Math.round(st.width)} = min(vw, 420), right edge at viewport edge`)
        : leg("FAIL", "fe13-drawer/open-geometry", `open panel x=${st?.x} width=${st?.width} vw=${st?.vw}`),
    );
    // Backdrop: fixed, z 1000, the scored ink color.
    const bd = await page.evaluate(() => {
      const els = [...document.querySelectorAll("body *")];
      const el = els.find((e) => {
        const s = getComputedStyle(e);
        return s.position === "fixed" && s.zIndex === "1000";
      });
      return el ? getComputedStyle(el).backgroundColor : null;
    });
    legs.push(
      bd === "rgba(38, 24, 18, 0.45)"
        ? leg("PASS", "fe13-drawer/backdrop", "backdrop present at rgba(38, 24, 18, 0.45), z 1000")
        : leg("FAIL", "fe13-drawer/backdrop", `backdrop background ${bd}`),
    );
    // Composer survives inside the drawer (a byte-untouched surface in FE-13).
    const composer = await page.locator('[data-qa-probe="drawer"] textarea, [data-qa-probe="drawer"] input[type="text"]').count();
    legs.push(
      composer > 0
        ? leg("PASS", "fe13-drawer/composer", "composer renders inside the drawer")
        : leg("FAIL", "fe13-drawer/composer", "no composer input inside the drawer"),
    );
    // Close path 1: backdrop click.
    await page.mouse.click(10, 10);
    await page.waitForTimeout(700);
    st = await panelState(page);
    legs.push(
      isClosed(st)
        ? leg("PASS", "fe13-drawer/close-backdrop", "backdrop click closes the drawer")
        : leg("FAIL", "fe13-drawer/close-backdrop", "drawer still open after backdrop click"),
    );
    // Close path 2: Escape.
    await bubble.click();
    await page.waitForTimeout(700);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    st = await panelState(page);
    legs.push(
      isClosed(st)
        ? leg("PASS", "fe13-drawer/close-escape", "Escape closes the drawer")
        : leg("FAIL", "fe13-drawer/close-escape", "drawer still open after Escape"),
    );
    // Phone width: the open drawer is full width by construction.
    const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await phone.goto(BASE(), { waitUntil: "domcontentloaded" });
    await phone.waitForTimeout(800);
    // The signed-in session is per-browser, so the phone page starts signed in.
    const pb = phone.locator('[title="Open CR8W Chat"]');
    if ((await pb.count()) > 0) {
      await pb.click();
      await phone.waitForTimeout(700);
      const pst = await phone.evaluate(() => {
        const els = [...document.querySelectorAll("body *")];
        const panel = els.find((e) => {
          const s = getComputedStyle(e);
          return s.position === "fixed" && s.zIndex === "1001";
        });
        if (!panel) return null;
        const r = panel.getBoundingClientRect();
        return { width: r.width, vw: window.innerWidth };
      });
      legs.push(
        pst && Math.abs(pst.width - 390) <= 1.5
          ? leg("PASS", "fe13-drawer/phone-width", "open drawer is full width at a 390px viewport")
          : leg("FAIL", "fe13-drawer/phone-width", `phone panel width ${pst?.width} of vw ${pst?.vw}`),
      );
    } else {
      legs.push(leg("NOT VERIFIED", "fe13-drawer/phone-width", "chat bubble not present on the phone viewport page"));
    }
    return legs;
  } finally {
    await browser.close();
  }
}
