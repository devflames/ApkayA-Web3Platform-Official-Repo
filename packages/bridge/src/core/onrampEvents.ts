import type { OnrampPostMessageEvent } from "./types.js";

const COINBASE_ORIGINS = ["https://pay.coinbase.com", "https://www.coinbase.com"];

export function parseOnrampMessage(data: unknown): OnrampPostMessageEvent | null {
  if (!data) return null;

  if (typeof data === "string") {
    try {
      return parseOnrampMessage(JSON.parse(data));
    } catch {
      return null;
    }
  }

  if (typeof data !== "object") return null;

  const obj = data as Record<string, unknown>;
  if (typeof obj.eventName === "string") {
    return obj as unknown as OnrampPostMessageEvent;
  }

  if (obj.data && typeof obj.data === "object") {
    const inner = obj.data as Record<string, unknown>;
    if (typeof inner.eventName === "string") {
      return inner as unknown as OnrampPostMessageEvent;
    }
  }

  return null;
}

export function listenForOnrampEvents(
  handler: (event: OnrampPostMessageEvent) => void
): () => void {
  const listener = (messageEvent: MessageEvent) => {
    if (!COINBASE_ORIGINS.some((o) => messageEvent.origin.startsWith(o))) return;
    const parsed = parseOnrampMessage(messageEvent.data);
    if (parsed) handler(parsed);
  };

  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

export function openOnrampPopup(popupUrl: string, width = 460, height = 720): Window | null {
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  return window.open(
    popupUrl,
    "apkaya-coinbase-onramp",
    `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`
  );
}
