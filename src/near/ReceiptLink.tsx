import { useState } from "react";
import { explorerUrl } from "./onboarding";
import { copyReceiptText } from "./clipboard";
export function ReceiptLink({ hash }: { hash: string }) {
  const [status, setStatus] = useState("");
  const [fallback, setFallback] = useState("");
  let url: string;
  try { url = explorerUrl(hash); } catch { return <span>Hash không hợp lệ; chưa mở Explorer.</span>; }
  async function copy(value: string) {
    let clipboard: Clipboard | undefined;
    try { clipboard = navigator.clipboard; } catch { /* Browser denied even the property getter. */ }
    const result = await copyReceiptText(value, clipboard); setFallback(result.fallback);
    setStatus(result.copied ? "Đã sao chép." : "Trình duyệt chưa cho sao chép. Chọn nội dung bên dưới, nhấn Ctrl+C.");
  }
  return <div><a target="_blank" rel="noreferrer" href={url}>Mở Explorer ↗</a><button onClick={() => void copy(hash)}>Sao chép hash</button><button onClick={() => void copy(url)}>Sao chép link</button><code className="near-hash" tabIndex={0}>{hash}</code><small role="status">{status}</small>{fallback && <code className="near-hash nw-copy-fallback" tabIndex={0}>{fallback}</code>}</div>;
}
