import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ConnectProvider, ConnectButton } from "@apkaya/connect/react";
import "@apkaya/connect/styles.css";
import { useSettings } from "../context/SettingsContext";
import { PipelineRail } from "../components/PipelineRail";
import type { TransactionRecord, BackendWallet } from "@apkaya/sdk";

export function Overview() {
  const { client, isConfigured, settings } = useSettings();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [wallets, setWallets] = useState<BackendWallet[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const connectConfig = useMemo(
    () => ({
      chainId: 80002,
      walletConnectProjectId: import.meta.env.VITE_WALLETCONNECT_PROJECT_ID,
      engine: {
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
      },
      siwe: {
        domain: typeof window !== "undefined" ? window.location.host : "localhost",
        uri: typeof window !== "undefined" ? window.location.origin : "http://localhost:5173",
        statement: "Sign in to the ApkayA dashboard Connect demo.",
      },
    }),
    [settings.baseUrl, settings.apiKey]
  );

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const [tx, w] = await Promise.all([
          client.transactions.list({ limit: 200 }),
          client.wallets.list(),
        ]);
        if (!cancelled) {
          setTransactions(tx);
          setWallets(w);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load Engine data");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 4000); // live-ish refresh, matches the rail's "pulse" feel
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [client, isConfigured]);

  if (!isConfigured) {
    return (
      <div className="content">
        <div className="empty-state card">
          <h3>Connect to your Engine instance</h3>
          <p>Add your Engine base URL and API key in Settings to see live data here.</p>
          <Link to="/settings" className="btn btn-primary" style={{ marginTop: 16, display: "inline-flex" }}>
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  const counts = {
    queued: transactions.filter((t) => t.status === "queued").length,
    sent: transactions.filter((t) => t.status === "sent").length,
    mined: transactions.filter((t) => t.status === "mined").length,
    reverted: transactions.filter((t) => t.status === "reverted" || t.status === "errored").length,
  };

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>Overview</h1>
          <div className="subtitle">Live status of your Engine instance</div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--reverted)", marginBottom: 24, color: "var(--reverted)" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <PipelineRail counts={counts} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15 }}>Backend Wallets</h3>
            <Link to="/wallets" style={{ fontSize: 12, color: "var(--accent)" }}>
              View all →
            </Link>
          </div>
          {loading ? (
            <div style={{ color: "var(--text-dim)" }}>Loading…</div>
          ) : wallets.length === 0 ? (
            <div style={{ color: "var(--text-dim)", fontSize: 13 }}>No wallets yet.</div>
          ) : (
            <div style={{ fontSize: 24, fontFamily: "var(--font-display)" }}>{wallets.length}</div>
          )}
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
            <h3 style={{ fontSize: 15 }}>Total Transactions</h3>
            <Link to="/transactions" style={{ fontSize: 12, color: "var(--accent)" }}>
              View all →
            </Link>
          </div>
          <div style={{ fontSize: 24, fontFamily: "var(--font-display)" }}>{transactions.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 style={{ fontSize: 15, marginBottom: 8 }}>@apkaya/connect demo</h3>
        <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>
          End-user wallet modal (injected, WalletConnect, email in-app wallet). This dogfoods the shared
          theme contract — not required for operating Engine itself.
        </p>
        <ConnectProvider config={connectConfig}>
          <ConnectButton />
        </ConnectProvider>
      </div>
    </div>
  );
}
