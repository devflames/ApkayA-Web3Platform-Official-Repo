import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import type { ApiKeyRecord } from "@apkaya/sdk";

export function ApiKeys() {
  const { client, isConfigured } = useSettings();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [creating, setCreating] = useState(false);
  const [justCreated, setJustCreated] = useState<{ label: string; key: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function refresh() {
    try {
      const result = await client.apiKeys.list();
      setKeys(result);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} — key management requires Engine's admin key (ENGINE_ADMIN_KEY), not a regular customer key.`
          : "Failed to load API keys"
      );
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
      const created = await client.apiKeys.create(newLabel.trim());
      setJustCreated({ label: created.label, key: created.key });
      setNewLabel("");
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(id: string) {
    try {
      await client.apiKeys.revoke(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke key");
    }
  }

  async function handleReactivate(id: string) {
    try {
      await client.apiKeys.reactivate(id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reactivate key");
    }
  }

  function copyKey() {
    if (!justCreated) return;
    navigator.clipboard.writeText(justCreated.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
          <h1>API Keys</h1>
          <div className="subtitle">Issue and revoke keys for your customers' apps</div>
        </div>
      </div>

      <div
        className="card"
        style={{ marginBottom: 24, borderColor: "var(--accent)", background: "color-mix(in srgb, var(--accent) 6%, var(--surface))" }}
      >
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--text-dim)" }}>
          This page requires the connection in <b style={{ color: "var(--text)" }}>Settings</b> to use
          your Engine's <code>ENGINE_ADMIN_KEY</code> — the master key, separate from the keys you issue
          here. Keys created below are for your customers to use in their own apps and cannot manage
          other keys.
        </p>
      </div>

      {justCreated && (
        <div className="card" style={{ marginBottom: 24, borderColor: "var(--mined)" }}>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Key created: {justCreated.label}</h3>
          <p style={{ fontSize: 12, color: "var(--text-dim)", marginBottom: 12 }}>
            This is shown once. Store it now — Engine only keeps a hash and cannot show it again.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <code
              className="mono"
              style={{
                flex: 1,
                background: "var(--surface-raised)",
                border: "1px solid var(--border-strong)",
                padding: "10px 12px",
                borderRadius: "var(--radius)",
                fontSize: 12.5,
                overflowX: "auto",
                whiteSpace: "nowrap",
              }}
            >
              {justCreated.key}
            </code>
            <button className="btn btn-primary" onClick={copyKey}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 24 }}>
        <label htmlFor="key-label">Issue a new API key</label>
        <div style={{ display: "flex", gap: 10 }}>
          <input
            id="key-label"
            placeholder="e.g. acme-corp-production"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            style={{ flex: 1 }}
          />
          <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !newLabel.trim()}>
            {creating ? "Creating…" : "Create key"}
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
        ) : keys.length === 0 ? (
          <div className="empty-state">
            <h3>No API keys yet</h3>
            <p>Create one above to give a customer app access to your Engine instance.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Label</th>
                <th>Prefix</th>
                <th>Status</th>
                <th>Last used</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => (
                <tr key={k.id}>
                  <td style={{ fontWeight: 600 }}>{k.label}</td>
                  <td className="truncate-hash">{k.key_prefix}…</td>
                  <td>
                    <span style={{ color: k.is_active ? "var(--mined)" : "var(--reverted)", fontSize: 12.5, fontWeight: 600 }}>
                      {k.is_active ? "Active" : "Revoked"}
                    </span>
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {k.last_used_at ? new Date(k.last_used_at + "Z").toLocaleString() : "Never"}
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>{new Date(k.created_at + "Z").toLocaleDateString()}</td>
                  <td>
                    {k.is_active ? (
                      <button className="btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => handleRevoke(k.id)}>
                        Revoke
                      </button>
                    ) : (
                      <button className="btn" style={{ padding: "5px 10px", fontSize: 12 }} onClick={() => handleReactivate(k.id)}>
                        Reactivate
                      </button>
                    )}
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
