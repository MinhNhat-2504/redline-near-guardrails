export async function copyReceiptText(value: string, clipboard?: Pick<Clipboard, "writeText">): Promise<{ copied: boolean; fallback: string }> {
  try { if (!clipboard) throw Error("Clipboard unavailable"); await clipboard.writeText(value); return { copied: true, fallback: "" }; }
  catch { return { copied: false, fallback: value }; }
}
