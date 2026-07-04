import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import type { ChainConfig } from "@apkaya/sdk";

export function Chains() {
  const { client, isConfigured } = useSettings();
  const [chains, setChains] = useState<ChainConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }
    client.chains
      .list()
      .then(setChains)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load chains"))
      .finally(() => setLoading(false));
  }, [client, isConfigured]);

  if (!isConfigured) {
    return (
      <div className="content">
        <div className="empty-state card">
          <h3>Not connected</h3>
          <p>Configure your Engine connection in Settings first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>Chains</h1>
          <div className="subtitle">Networks this Engine instance can send transactions on</div>
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--reverted)", marginBottom: 24, color: "var(--reverted)" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20, color: "var(--text-dim)" }}>Loading…</div>
        ) : chains.length === 0 ? (
          <div className="empty-state">
            <h3>No chains configured</h3>
            <p>
              Add <code>CHAIN_&lt;id&gt;_RPC_URL</code>, optional <code>CHAIN_&lt;id&gt;_FAMILY</code>{" "}
              (<code>evm</code> or <code>solana</code>), and <code>CHAIN_&lt;id&gt;_NAME</code> to Engine's{" "}
              <code>.env</code> and restart.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Family</th>
                <th>Chain ID</th>
                <th>Name</th>
                <th>RPC URL</th>
              </tr>
            </thead>
            <tbody>
              {chains.map((c) => (
                <tr key={`${c.chainFamily}:${c.chainId}`}>
                  <td>
                    <span className="status-badge">{c.chainFamily}</span>
                  </td>
                  <td className="mono">{c.chainId}</td>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td className="truncate-hash">{c.rpcUrl}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
