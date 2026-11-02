// QA probe pack runner (STACK-03).
//
// One command:  npm run probes           (from qa/probes, after npm install)
// Strict mode:  npm run probes:all       (NOT VERIFIED legs also fail the run)
//
// Prints one VERIFY-shaped evidence block: a header, one line per leg with
// PASS / FAIL / NOT VERIFIED plus its evidence, and a summary count.
// Exit code is 1 when any leg FAILs (or, with --require-all, when any leg
// is NOT VERIFIED). Probes are read-only; credentials come from the
// environment (see README.md) and are never committed.

import * as anonGrants from "./probes/anon-grants.mjs";
import * as homeCounts from "./probes/home-counts.mjs";
import * as fe13Drawer from "./probes/fe13-drawer.mjs";

const requireAll = process.argv.includes("--require-all");
const probes = [
  ["anon-grants", anonGrants],
  ["home-counts", homeCounts],
  ["fe13-drawer", fe13Drawer],
];

const stamp = new Date().toISOString();
console.log(`VERIFY qa-probe-pack @ ${stamp} · owner QA · read-only`);
let pass = 0;
let fail = 0;
let notVerified = 0;
for (const [name, mod] of probes) {
  let legs;
  try {
    legs = await mod.run();
  } catch (e) {
    legs = [{ status: "FAIL", leg: name, evidence: `probe crashed: ${String(e.message || e)}` }];
  }
  for (const l of legs) {
    console.log(`${l.status} ${l.leg} — ${l.evidence}`);
    if (l.status === "PASS") pass += 1;
    else if (l.status === "FAIL") fail += 1;
    else notVerified += 1;
  }
}
console.log(`Summary: ${pass} PASS / ${fail} FAIL / ${notVerified} NOT VERIFIED`);
if (fail > 0 || (requireAll && notVerified > 0)) {
  process.exit(1);
}
