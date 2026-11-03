import { ensureBrowserBuffer } from "./browser-runtime";
import { setupWalletSelector } from "@near-wallet-selector/core";
import { setupIntearWallet } from "@near-wallet-selector/intear-wallet";
import { Buffer } from "buffer";
import { api, setToken } from "./api";
const selector = () => setupWalletSelector({ network: { networkId: "testnet", nodeUrl: "https://test.rpc.fastnear.com", helperUrl: "https://helper.testnet.near.org", explorerUrl: "https://explorer.testnet.near.org", indexerUrl: "https://test.api.fastnear.com/v0" }, modules: [setupIntearWallet({ walletUrl: "https://wallet.intear.tech" })] });
let instance: ReturnType<typeof selector> | undefined;
export async function wallet() { ensureBrowserBuffer(); const s = await (instance ??= selector()); const w = await s.wallet("intear-wallet"); if (w.type !== "injected") throw Error("Loại ví khác cấu hình đã duyệt."); return w; }
type Challenge = { challengeId: string; state: string; accountId: string; message: string; nonce: string; recipient: string; callbackUrl: string };
export async function login(): Promise<string> {
  const w = await wallet();
  const selected = (accounts: { accountId: string }[]) => accounts.find(a => typeof a?.accountId === "string" && a.accountId.length >= 2 && a.accountId.length <= 64 && /^[a-z0-9]+(?:[-_.][a-z0-9]+)*$/.test(a.accountId))?.accountId;
  let account = selected(await w.getAccounts());
  // Identity-only: do not request an on-chain FunctionCall key or any contract authority.
  // Intear stores a separate local app-auth key for its revocable wallet connection.
  if (!account) account = selected(await w.signIn({}));
  if (!account) throw Error("Chưa chọn tài khoản ví Testnet.");
  const c = await api<Challenge>("/near/auth/challenge", { accountId: account, clientType: "wallet" });
  if (c.callbackUrl !== `${location.origin}/near/auth/callback` || c.recipient !== location.host || c.accountId !== account) throw Error("Origin hoặc tài khoản ký không khớp cấu hình backend.");
  sessionStorage.setItem("near-challenge", JSON.stringify(c));
  const result = await w.signMessage({ message: c.message, recipient: c.recipient, nonce: Buffer.from(c.nonce, "base64"), callbackUrl: c.callbackUrl, state: c.state });
  if (!result) throw Error("Tiếp tục xác nhận trong ví.");
  return verify(c, result);
}
async function verify(c: Challenge, result: { accountId: string; publicKey: string; signature: string; state?: string }) {
  if (result.accountId !== c.accountId || (result.state && result.state !== c.state)) throw Error("Callback khác tài khoản hoặc state.");
  const session = await api<{ token: string; accountId: string }>("/near/auth/verify", { challengeId: c.challengeId, state: c.state, accountId: result.accountId, publicKey: result.publicKey, signature: result.signature });
  setToken(session.token); sessionStorage.removeItem("near-challenge"); return session.accountId;
}
export async function finishCallback(): Promise<string | undefined> {
  if (location.pathname !== "/near/auth/callback") return;
  const q = new URLSearchParams(location.hash.slice(1));
  const saved = sessionStorage.getItem("near-challenge");
  history.replaceState(null, "", "/near");
  if (!saved || !q.get("signature") || !q.get("state")) throw Error("Thiếu challenge hoặc chữ ký callback.");
  const c = JSON.parse(saved) as Challenge;
  if (q.get("state") !== c.state) throw Error("Callback state không khớp.");
  return verify(c, { accountId: q.get("accountId") ?? "", publicKey: q.get("publicKey") ?? "", signature: q.get("signature")!, state: q.get("state")! });
}
