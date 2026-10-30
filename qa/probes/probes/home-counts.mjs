// Probe: signed-in Home care counts (the PR #64 landing probe).
//
// Replaces the hand-run post-merge production probe. On Home's Needs care
// panel, PR #64's Unanswered asks count must render beside the FE-5
// Consent gaps count. The expected strings are the landing receipt's armed
// expectations; counts are live data, so they are parameters, not truths:
//   CW_EXPECT_ASKS     default "9 of 65"   (OPEN ASKS census, 2026-10-30)
//   CW_EXPECT_CONSENT  default "28 of 28"  (PEOPLE census, 2026-10-30)
// Before PR #64 lands, the asks leg FAILs on production by design: the
// count does not exist yet. That is the probe working, not a defect in it.
//
// Read-only. Env: CW_QA_BASE_URL (default the production origin),
// CW_QA_ID + CW_QA_PASSWORD for the signed-in legs. The surface leg runs
// without credentials and proves the harness end to end.

import { leg, envGate, launchBrowser, signIn } from "../lib.mjs";

const BASE = () => process.env.CW_QA_BASE_URL || "https://createdwell.vercel.app";

export async function run() {
  const legs = [];
  const { browser, error } = await launchBrowser();
  if (!browser) {
    return [leg("NOT VERIFIED", "home-counts", error)];
  }
  try {
    const page = await browser.newPage();
    // Surface leg: the origin loads and the sign-in gate renders.
    try {
      await page.goto(BASE(), { waitUntil: "domcontentloaded" });
      await page.locator("#cr8w-email").waitFor({ state: "visible", timeout: 20000 });
      await page.locator("#cr8w-password").waitFor({ state: "visible", timeout: 5000 });
      legs.push(leg("PASS", "home-counts/surface", "sign-in gate renders (#cr8w-email, #cr8w-password)"));
    } catch (e) {
      legs.push(
        leg("FAIL", "home-counts/surface", `origin or sign-in gate unreachable: ${String(e.message || e).split("\n")[0]}`),
      );
      return legs;
    }

    const missing = envGate(["CW_QA_ID", "CW_QA_PASSWORD"]);
    if (missing) {
      legs.push(leg("NOT VERIFIED", "home-counts/counts", `env not set: ${missing.join(", ")}`));
      return legs;
    }
    try {
      await signIn(page, BASE(), process.env.CW_QA_ID, process.env.CW_QA_PASSWORD);
    } catch (e) {
      legs.push(leg("FAIL", "home-counts/counts", `sign-in did not complete: ${String(e.message || e).split("\n")[0]}`));
      return legs;
    }
    await page.waitForTimeout(1500);
    const text = await page.locator("body").innerText();
    const asks = process.env.CW_EXPECT_ASKS || "9 of 65";
    const consent = process.env.CW_EXPECT_CONSENT || "28 of 28";
    legs.push(
      text.includes("Needs care")
        ? leg("PASS", "home-counts/panel", "Needs care panel renders on Home")
        : leg("FAIL", "home-counts/panel", "Needs care panel not found on Home"),
    );
    legs.push(
      text.includes("Unanswered asks") && text.includes(asks)
        ? leg("PASS", "home-counts/unanswered-asks", `"Unanswered asks" renders "${asks}"`)
        : leg("FAIL", "home-counts/unanswered-asks", `"Unanswered asks" with "${asks}" not found on Home`),
    );
    legs.push(
      text.includes("Consent gaps") && text.includes(consent)
        ? leg("PASS", "home-counts/consent-gaps", `"Consent gaps" renders "${consent}"`)
        : leg("FAIL", "home-counts/consent-gaps", `"Consent gaps" with "${consent}" not found on Home`),
    );
    return legs;
  } finally {
    await browser.close();
  }
}
