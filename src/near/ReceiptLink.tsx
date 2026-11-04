import { useState } from "react";
import { explorerUrl } from "./onboarding";
export function ReceiptLink({ hash }: { hash: string }) {
  const [status, setStatus] = useState("");
  let url: string;
  try { url = explorerUrl(hash); } catch { return <span>Hash không hợp lệ; chưa mở Explorer.</span>; }
  async function copy(value: string) {
    try { await navigator.clipboard.writeText(value); setStatus("Đã sao chép."); }
    catch { setStatus("Trình duyệt chưa cho sao chép. Chọn mã bên dưới, nhấn Ctrl+C."); }
  }
  return <div><a target="_blank" rel="noreferrer" href={url}>Mở Explorer ↗</a><button onClick={() => void copy(hash)}>Sao chép hash</button><button onClick={() => void copy(url)}>Sao chép link</button><code className="near-hash" tabIndex={0}>{hash}</code><small role="status">{status}</small></div>;
}
