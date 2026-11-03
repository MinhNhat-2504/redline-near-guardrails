export interface RpcBudget { beforeRequest(): Promise<void>; coolDown(ms: number): void }

/** Process-wide per-endpoint budget shared by auth, API reads, indexer and broadcast. */
export class RequestBudget implements RpcBudget {
  private tail: Promise<void> = Promise.resolve();
  private nextStart = 0;
  private blockedUntil = 0;
  constructor(private readonly intervalMs = 2_000, private readonly now = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms))) {}
  async beforeRequest(): Promise<void> {
    const previous = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      for (;;) {
        const delay = Math.max(this.nextStart, this.blockedUntil) - this.now();
        if (delay <= 0) break;
        await this.sleep(delay);
      }
      this.nextStart = this.now() + this.intervalMs;
    } finally { release(); }
  }
  coolDown(ms: number): void { this.blockedUntil = Math.max(this.blockedUntil, this.now() + ms); }
}

const originalFetch = globalThis.fetch;
const budgets = new Map<string, RequestBudget>();
export function networkBudget(url: string, transport: typeof fetch): RpcBudget | undefined {
  if (transport !== originalFetch) return undefined; // injected unit-test transports; supply a fake-clock budget explicitly
  const key = new URL(url).href;
  let budget = budgets.get(key);
  if (!budget) { budget = new RequestBudget(); budgets.set(key, budget); }
  return budget;
}

export function retryAfterMs(value: string | null, now = Date.now()): number {
  const delay = value && /^\d+$/.test(value) ? Number(value) * 1_000 : value ? Date.parse(value) - now : 0;
  return Math.max(30_000, Math.min(Number.isFinite(delay) ? delay : 0, 300_000));
}
