import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import type { BackendWallet } from "@apkaya/sdk";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function Wallets() {
  const { client, isConfigured } = useSettings();
  const [wallets, setWallets] = useState<BackendWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function refresh() {
    try {
      const result = await client.wallets.list();
      setWallets(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallets");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isConfigured) refresh();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConfigured]);

  async function handleCreate() {
    if (!newLabel.trim()) return;
    setCreating(true);
    try {
      await client.wallets.create(newLabel.trim());
      setNewLabel("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create wallet");
    } finally {
      setCreating(false);
    }
  }

  function copyAddress(id: string, address: string) {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  }

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
          <h1>Backend Wallets</h1>
          <div className="subtitle">Managed wallets that sign and send transactions on your behalf</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <label htmlFor="wallet-label">Create a new wallet</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            id="wallet-label"
            placeholder="e.g. checkout-wallet"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !newLabel.trim()}>
            {creating ? "Creating…" : "Create wallet"}
          </button>
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
        ) : wallets.length === 0 ? (
          <div className="empty-state">
            <h3>No backend wallets yet</h3>
            <p>Create one above to start sending transactions through Engine.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Address</th>
                <th>Type</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {wallets.map((w) => (
                <tr key={w.id}>
                  <td style={{ fontWeight: 600 }}>{w.label}</td>
                  <td className="truncate-hash">{truncateAddress(w.address)}</td>
                  <td style={{ color: "var(--text-dim)" }}>{w.key_type}</td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {new Date(w.created_at + "Z").toLocaleDateString()}
                  </td>
                  <td>
                    <button className="btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => copyAddress(w.id, w.address)}>
                      {copiedId === w.id ? "Copied" : "Copy address"}
                    </button>
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
