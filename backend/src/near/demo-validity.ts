import assert from "node:assert/strict";
import { z } from "zod";
import { u64 } from "./units.js";

const hoursSchema = z.number().int().min(1).max(8);
const validitySchema = z.object({ hours: hoursSchema, preparedAtMs: z.number().int().nonnegative().safe(), expiresAtNs: z.string() }).strict();

type DemoMode = "initial" | "after-key-reset" | "renew-expired-grant";
export function parseDemoGrantOptions(argv: string[]): { mode: DemoMode; hours: number | undefined } {
  let mode: DemoMode = "initial";
  let hours: number | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--grant-hours") {
      assert(hours === undefined, "Duplicate --grant-hours");
      const raw = argv[++i];
      assert(raw && /^[1-8]$/.test(raw), "--grant-hours must be a whole number from 1 to 8");
      hours = Number(raw);
    } else if (arg === "--after-key-reset" || arg === "--renew-expired-grant") {
      assert.equal(mode, "initial", "Choose only one preparation mode");
      mode = arg === "--after-key-reset" ? "after-key-reset" : "renew-expired-grant";
    } else throw new Error("Use --help, optional preparation mode and --grant-hours <1..8>");
  }
  return { mode, hours };
}

export function makeDemoValidity(hours = 1, nowMs = Date.now()) {
  hoursSchema.parse(hours);
  assert(Number.isSafeInteger(nowMs) && nowMs >= 0, "Invalid preparation clock");
  const expiresAtNs = ((BigInt(nowMs) + BigInt(hours) * 3600000n) * 1000000n).toString();
  u64(expiresAtNs);
  return { hours, preparedAtMs: nowMs, expiresAtNs };
}

/** Retry never moves the deadline or changes an already reviewed duration. */
export function checkStoredDemoValidity(metadata: unknown, policyExpiry: string, requestedHours?: number, nowMs = Date.now()) {
  if (requestedHours !== undefined) hoursSchema.parse(requestedHours);
  if (metadata === undefined) {
    assert(requestedHours === undefined || requestedHours === 1, "Legacy one-hour proposal retained unchanged; do not extend it on retry");
    return 1;
  }
  const saved = validitySchema.parse(metadata);
  assert.equal(makeDemoValidity(saved.hours, saved.preparedAtMs).expiresAtNs, saved.expiresAtNs, "Stored validity does not match preparation time");
  assert.equal(saved.expiresAtNs, policyExpiry, "Policy deadline differs from reviewed validity");
  assert(saved.preparedAtMs <= nowMs + 30000, "Preparation clock is in the future; reconcile before signing");
  if (requestedHours !== undefined) assert.equal(saved.hours, requestedHours, "Stored proposal duration differs; retained unchanged");
  return saved.hours;
}
