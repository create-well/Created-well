// Shared helpers for the QA probe pack.
//
// Every probe returns a list of legs: { status, leg, evidence }
// status is one of PASS, FAIL, NOT VERIFIED (the VERIFY packet vocabulary).
// A probe never throws for an expected gate (missing env, missing browser);
// it reports the leg NOT VERIFIED and names the gate. Unexpected errors are
// reported as FAIL with the error message, never swallowed silently.

export function leg(status, name, evidence) {
  return { status, leg: name, evidence };
}

export function envGate(names) {
  const missing = names.filter((n) => !process.env[n]);
  return missing.length ? missing : null;
}

// Loads Playwright if the pack has been installed. Returns null (and the
// caller reports the setup gate) when the package or browser is absent.
export async function loadChromium() {
  try {
    const { chromium } = await import("playwright");
    return chromium;
  } catch {
    return null;
  }
}

export async function launchBrowser() {
  const chromium = await loadChromium();
  if (!chromium) return { error: "playwright not installed (npm install in qa/probes)" };
  try {
    // Chromium does not inherit the shell's proxy environment on its own.
    // When the run environment routes egress through a proxy (the QA VM
    // does), pass it through from the environment, credentials and all;
    // the value is used for the launch only and never printed.
    const proxyServer =
      process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
    let launchOpts = {};
    if (proxyServer) {
      try {
        const u = new URL(proxyServer);
        launchOpts = { proxy: { server: `${u.protocol}//${u.host}` } };
        if (u.username) launchOpts.proxy.username = decodeURIComponent(u.username);
        if (u.password) launchOpts.proxy.password = decodeURIComponent(u.password);
      } catch {
        launchOpts = { proxy: { server: proxyServer } };
      }
    }
    const browser = await chromium.launch(launchOpts);
    return { browser };
  } catch (e) {
    return {
      error: `chromium launch failed: ${String(e.message || e).split("\n")[0]} (npx playwright install chromium)`,
    };
  }
}

// Signs in through the AuthGate form. Selectors are the component's own ids
// (src/app/components/AuthGate.tsx): #cr8w-email accepts an email address or
// a username; #cr8w-password is the password field. The caller supplies the
// identifier and password from the environment; nothing is stored.
export async function signIn(page, baseUrl, id, password) {
  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  const email = page.locator("#cr8w-email");
  const pw = page.locator("#cr8w-password");
  await email.waitFor({ state: "visible", timeout: 20000 });
  await email.fill(id);
  await pw.fill(password);
  await page.locator('form button[type="submit"]').first().click();
  // Signed in when the password field leaves the DOM.
  await pw.waitFor({ state: "detached", timeout: 30000 });
}
