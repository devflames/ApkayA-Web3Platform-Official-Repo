import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { StatusPill } from "../components/StatusPill";
import { PipelineRail } from "../components/PipelineRail";
import type { TransactionRecord } from "@apkaya/sdk";

function truncate(str: string, len = 10): string {
  if (str.length <= len) return str;
  return `${str.slice(0, len)}…`;
}

export function Transactions() {
  const { client, isConfigured } = useSettings();
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const result = await client.transactions.list({
          limit: 200,
          status: statusFilter || undefined,
        });
        if (!cancelled) {
          setTransactions(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load transactions");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [client, isConfigured, statusFilter]);

  async function handleCancel(id: string) {
    try {
      await client.transactions.cancel(id);
      setTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, status: "cancelled" } : t)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel transaction");
    }
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
          <h1>Transactions</h1>
          <div className="subtitle">Everything queued, sent, or confirmed through Engine</div>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All statuses</option>
          <option value="queued">Queued</option>
          <option value="sent">Sent</option>
          <option value="mined">Mined</option>
          <option value="reverted">Reverted</option>
          <option value="errored">Errored</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <PipelineRail counts={counts} />
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--reverted)", marginBottom: 24, color: "var(--reverted)" }}>
          {error}
        </div>
      )}

      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 20, color: "var(--text-dim)" }}>Loading…</div>
        ) : transactions.length === 0 ? (
          <div className="empty-state">
            <h3>No transactions yet</h3>
            <p>Send one via the SDK or API — it'll show up here as soon as it's queued.</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Chain</th>
                <th>To</th>
                <th>Hash</th>
                <th>Queued</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id}>
                  <td>
                    <StatusPill status={tx.status} />
                  </td>
                  <td style={{ color: "var(--text-dim)" }}>
                    <span className="status-badge" style={{ marginRight: 6 }}>
                      {tx.chain_family as string}
                    </span>
                    {tx.chain_id as string}
                  </td>
                  <td className="truncate-hash">{truncate(tx.to_address as string)}</td>
                  <td className="truncate-hash">{tx.tx_hash ? truncate(tx.tx_hash as string) : "—"}</td>
                  <td style={{ color: "var(--text-dim)" }}>
                    {new Date((tx.created_at as string) + "Z").toLocaleTimeString()}
                  </td>
                  <td>
                    {tx.status === "queued" && (
                      <button
                        className="btn"
                        style={{ padding: "5px 10px", fontSize: 12 }}
                        onClick={() => handleCancel(tx.id)}
                      >
                        Cancel
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
