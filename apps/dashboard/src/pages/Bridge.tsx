import { useMemo } from "react";
import { ConnectProvider, ConnectButton } from "@apkaya/connect/react";
import { BridgeProvider, BuyWidget, SwapWidget } from "@apkaya/bridge/react";
import "@apkaya/connect/styles.css";
import "@apkaya/bridge/styles.css";
import { useSettings } from "../context/SettingsContext";

export function Bridge() {
  const { settings, isConfigured } = useSettings();

  const connectConfig = useMemo(
    () => ({
      chainId: 8453,
      engine: {
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
      },
      siwe: {
        domain: typeof window !== "undefined" ? window.location.host : "localhost",
        uri: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
      },
    }),
    [settings.baseUrl, settings.apiKey]
  );

  const bridgeEngine = useMemo(
    () => ({ baseUrl: settings.baseUrl, apiKey: settings.apiKey }),
    [settings.baseUrl, settings.apiKey]
  );

  if (!isConfigured) {
    return (
      <div className="content">
        <div className="empty-state card">
          <h3>Not connected</h3>
          <p>Configure Engine in Settings to demo Bridge widgets.</p>
        </div>
      </div>
    );
  }

  return (
    <ConnectProvider config={connectConfig}>
      <div className="content">
        <div className="page-header">
          <div>
            <h1>Payments / Bridge</h1>
            <div className="subtitle">
              BuyWidget and SwapWidget demo — CDP secrets live on Engine only
            </div>
          </div>
          <ConnectButton />
        </div>

        <BridgeProvider engine={bridgeEngine}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
            <BuyWidget />
            <SwapWidget />
          </div>
        </BridgeProvider>

        <p style={{ marginTop: 24, fontSize: 13, color: "var(--text-dim)" }}>
          Use a CDP sandbox/test key in Engine env (<code>CDP_API_KEY_ID</code>,{" "}
          <code>CDP_API_KEY_SECRET</code>). Swap requires a CDP-supported mainnet (Ethereum, Base,
          Arbitrum, Optimism, Polygon) configured in Engine chains.
        </p>
      </div>
    </ConnectProvider>
  );
}
