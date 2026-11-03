// All amounts, nonces and nanosecond times cross JSON boundaries as strings.
export const U128_MAX = (1n << 128n) - 1n;
export const U64_MAX = (1n << 64n) - 1n;
const YOCTO = 10n ** 24n;

export function unsignedDecimal(value: unknown, max: bigint): bigint {
  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 39) {
    throw new Error("Expected a canonical unsigned decimal string");
  }
  const number = BigInt(value);
  if (number > max) throw new Error("Unsigned integer overflow");
  return number;
}

export const yocto = (value: unknown): bigint => unsignedDecimal(value, U128_MAX);
export const u64 = (value: unknown): bigint => unsignedDecimal(value, U64_MAX);

export function parseNear(value: string): string {
  if (typeof value !== "string" || value.length > 65 || !/^(0|[1-9][0-9]*)(\.[0-9]{1,24})?$/.test(value)) {
    throw new Error("Expected decimal NEAR with at most 24 fractional digits");
  }
  const [whole, fraction = ""] = value.split(".");
  const amount = BigInt(whole) * YOCTO + BigInt(fraction.padEnd(24, "0"));
  if (amount > U128_MAX) throw new Error("NEAR amount overflow");
  return amount.toString();
}

export function formatNear(value: string): string {
  const amount = yocto(value);
  const fraction = (amount % YOCTO).toString().padStart(24, "0").replace(/0+$/, "");
  return `${amount / YOCTO}${fraction ? `.${fraction}` : ""}`;
}

export function secondsToNanoseconds(value: string): string {
  const ns = u64(value) * 1_000_000_000n;
  if (ns > U64_MAX) throw new Error("Nanosecond timestamp overflow");
  return ns.toString();
}

export function nanosecondsToSeconds(value: string): { seconds: string; remainderNs: string } {
  const ns = u64(value);
  return { seconds: (ns / 1_000_000_000n).toString(), remainderNs: (ns % 1_000_000_000n).toString() };
}
