import { useEffect, useState } from "react";
import { useSettings } from "../context/SettingsContext";
import type { InsightEvent, IndexerChainStatus } from "@apkaya/sdk";

function truncate(str: string, len = 10): string {
  if (str.length <= len) return str;
  return `${str.slice(0, len)}…`;
}

export function Insight() {
  const { client, isConfigured, settings } = useSettings();
  const [chainId, setChainId] = useState<number>(80002);
  const [transfers, setTransfers] = useState<InsightEvent[]>([]);
  const [status, setStatus] = useState<IndexerChainStatus[]>([]);
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
        const [transferRows, statusRows] = await Promise.all([
          client.insight.transfers({ chainId, limit: 50 }),
          client.insight.status(),
        ]);
        if (!cancelled) {
          setTransfers(transferRows);
          setStatus(statusRows);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Insight data");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [client, isConfigured, chainId]);

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

  const chainStatus = status.find((row) => row.chain_id === chainId);

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>Insight</h1>
          <div className="subtitle">
            Indexed ERC20 / ERC721 / ERC1155 transfers from {settings.insightBaseUrl.replace(/^https?:\/\//, "")}
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="insight-chain">Chain ID</label>
          <input
            id="insight-chain"
            type="number"
            value={chainId}
            onChange={(e) => setChainId(Number(e.target.value))}
            style={{ width: 140 }}
          />
        </div>
      </div>

      {error && (
        <div className="card" style={{ borderColor: "var(--reverted)", marginBottom: 16 }}>
          {error}
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Indexer status for chain {chainId}:{" "}
          {chainStatus
            ? `block ${chainStatus.last_indexed_block} (updated ${chainStatus.updated_at ?? "—"})`
            : loading
              ? "loading…"
              : "not indexed yet — start the Insight worker"}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recent transfers</h3>
        {loading && transfers.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>Loading…</p>
        ) : transfers.length === 0 ? (
          <p style={{ color: "var(--text-muted)" }}>
            No indexed transfers yet. Ensure the Insight worker is running and chains are configured.
          </p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Block</th>
                <th>Event</th>
                <th>Contract</th>
                <th>From</th>
                <th>To</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((row) => {
                const args = row.decoded_args_json;
                const from = String(args.from ?? "—");
                const to = String(args.to ?? "—");
                return (
                  <tr key={`${row.tx_hash}-${row.log_index}`}>
                    <td>{row.block_number}</td>
                    <td>{row.event_name}</td>
                    <td title={row.contract_address}>{truncate(row.contract_address, 12)}</td>
                    <td title={from}>{truncate(from, 12)}</td>
                    <td title={to}>{truncate(to, 12)}</td>
                    <td title={row.tx_hash}>{truncate(row.tx_hash, 12)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
