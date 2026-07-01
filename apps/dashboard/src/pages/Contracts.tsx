import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import type { DeployedContract } from "@apkaya/sdk";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Contracts() {
  const { client, isConfigured } = useSettings();
  const [contracts, setContracts] = useState<DeployedContract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    client.contracts
      .list({ limit: 100 })
      .then(setContracts)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load contracts"))
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
          <h1>Contracts</h1>
          <div className="subtitle">Registered deployments you can read and write through Engine</div>
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
        ) : contracts.length === 0 ? (
          <div className="empty-state">
            <h3>No contracts registered yet</h3>
            <p>
              Deploy with <code>packages/contracts/scripts/deploy.ts</code> (set{" "}
              <code>ENGINE_URL</code> + <code>ENGINE_API_KEY</code>) or POST to{" "}
              <code>/contract/register</code>.
            </p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Chain</th>
                <th>Address</th>
                <th>Deployed</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td style={{ color: "var(--text-dim)" }}>{c.chain_id}</td>
                  <td className="truncate-hash">{truncateAddress(c.address)}</td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {new Date(c.deployed_at).toLocaleString()}
                  </td>
                  <td>
                    <Link to={`/contracts/${c.id}`} className="btn" style={{ padding: "5px 10px", fontSize: 12 }}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
