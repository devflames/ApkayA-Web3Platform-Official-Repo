import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import type { BackendWallet, ContractDetail, ContractFunctionInfo } from "@apkaya/sdk";

function isReadFunction(fn: ContractFunctionInfo): boolean {
  return fn.stateMutability === "view" || fn.stateMutability === "pure";
}

function parseArgValue(raw: string, type: string): unknown {
  if (type.endsWith("[]")) {
    return JSON.parse(raw || "[]");
  }
  if (type.startsWith("uint") || type.startsWith("int")) return raw;
  if (type === "bool") return raw === "true";
  return raw;
}

function FunctionCard({
  fn,
  contractId,
  wallets,
  onWriteQueued,
}: {
  fn: ContractFunctionInfo;
  contractId: string;
  wallets: BackendWallet[];
  onWriteQueued: (txId: string) => void;
}) {
  const { client } = useSettings();
  const [args, setArgs] = useState<string[]>(() => fn.inputs.map(() => ""));
  const [walletId, setWalletId] = useState(wallets[0]?.id ?? "");
  const [valueWei, setValueWei] = useState("0");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const readOnly = isReadFunction(fn);

  async function handleSubmit() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const parsedArgs = fn.inputs.map((input, i) => parseArgValue(args[i] ?? "", input.type));

      if (readOnly) {
        const { value } = await client.contracts.read(contractId, fn.name, parsedArgs);
        setResult(JSON.stringify(value, null, 2));
      } else {
        if (!walletId) throw new Error("Select a backend wallet to send the transaction.");
        const tx = await client.contracts.write(contractId, {
          fromWalletId: walletId,
          functionName: fn.name,
          args: parsedArgs,
          valueWei,
        });
        setResult(`Queued transaction ${tx.id} (status: ${tx.status})`);
        onWriteQueued(tx.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Call failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontFamily: "var(--font-mono)" }}>
          {fn.name}({fn.inputs.map((i) => `${i.type} ${i.name}`).join(", ")})
        </h3>
        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>{fn.stateMutability}</span>
      </div>

      {fn.inputs.map((input, index) => (
        <div key={`${fn.name}-${input.name}-${index}`} style={{ marginBottom: 10 }}>
          <label htmlFor={`${fn.name}-${index}`}>
            {input.name || `arg${index}`} <span style={{ color: "var(--text-dim)" }}>({input.type})</span>
          </label>
          <input
            id={`${fn.name}-${index}`}
            value={args[index]}
            onChange={(e) => {
              const next = [...args];
              next[index] = e.target.value;
              setArgs(next);
            }}
            placeholder={input.type.endsWith("[]") ? '["0x..."]' : input.type.startsWith("uint") ? "0" : ""}
            style={{ width: "100%" }}
          />
        </div>
      ))}

      {!readOnly && (
        <>
          <div style={{ marginBottom: 10 }}>
            <label htmlFor={`${fn.name}-wallet`}>Backend wallet</label>
            <select
              id={`${fn.name}-wallet`}
              value={walletId}
              onChange={(e) => setWalletId(e.target.value)}
              style={{ width: "100%" }}
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.label} ({w.address.slice(0, 8)}…)
                </option>
              ))}
            </select>
          </div>
          {fn.stateMutability === "payable" && (
            <div style={{ marginBottom: 10 }}>
              <label htmlFor={`${fn.name}-value`}>valueWei</label>
              <input
                id={`${fn.name}-value`}
                value={valueWei}
                onChange={(e) => setValueWei(e.target.value)}
                style={{ width: "100%" }}
              />
            </div>
          )}
        </>
      )}

      <button className="btn btn-primary" onClick={handleSubmit} disabled={loading}>
        {loading ? "Calling…" : readOnly ? "Read" : "Write (queue tx)"}
      </button>

      {error && <div style={{ marginTop: 12, color: "var(--reverted)", fontSize: 13 }}>{error}</div>}
      {result && (
        <pre
          style={{
            marginTop: 12,
            padding: 12,
            background: "var(--surface-raised)",
            borderRadius: "var(--radius)",
            fontSize: 12,
            overflowX: "auto",
          }}
        >
          {result}
        </pre>
      )}
    </div>
  );
}

export function ContractDetail() {
  const { id } = useParams<{ id: string }>();
  const { client, isConfigured } = useSettings();
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [wallets, setWallets] = useState<BackendWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastTxId, setLastTxId] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured || !id) {
      setLoading(false);
      return;
    }

    Promise.all([client.contracts.get(id), client.wallets.list()])
      .then(([c, w]) => {
        setContract(c);
        setWallets(w);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load contract"))
      .finally(() => setLoading(false));
  }, [client, isConfigured, id]);

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

  if (loading) {
    return (
      <div className="content">
        <div style={{ color: "var(--text-dim)" }}>Loading contract…</div>
      </div>
    );
  }

  if (error || !contract) {
    return (
      <div className="content">
        <div className="card" style={{ borderColor: "var(--reverted)", color: "var(--reverted)" }}>
          {error ?? "Contract not found"}
        </div>
        <Link to="/contracts" style={{ marginTop: 16, display: "inline-block" }}>
          ← Back to contracts
        </Link>
      </div>
    );
  }

  const readFns = contract.functions.filter(isReadFunction);
  const writeFns = contract.functions.filter((fn) => !isReadFunction(fn));

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <Link to="/contracts" style={{ fontSize: 12, color: "var(--accent)" }}>
            ← Contracts
          </Link>
          <h1>{contract.name}</h1>
          <div className="subtitle">
            Chain {contract.chain_id} · <span className="mono">{contract.address}</span>
          </div>
        </div>
      </div>

      {lastTxId && (
        <div
          className="card"
          style={{
            marginBottom: 24,
            borderColor: "var(--mined)",
            background: "color-mix(in srgb, var(--mined) 6%, var(--surface))",
          }}
        >
          Transaction <code>{lastTxId}</code> queued.{" "}
          <Link to="/transactions" style={{ color: "var(--accent)" }}>
            View in Transactions →
          </Link>
        </div>
      )}

      <h2 style={{ fontSize: 16, marginBottom: 12 }}>Read functions</h2>
      {readFns.length === 0 ? (
        <p style={{ color: "var(--text-dim)", marginBottom: 24 }}>No view/pure functions in ABI.</p>
      ) : (
        readFns.map((fn) => (
          <FunctionCard
            key={fn.name}
            fn={fn}
            contractId={contract.id}
            wallets={wallets}
            onWriteQueued={setLastTxId}
          />
        ))
      )}

      <h2 style={{ fontSize: 16, margin: "24px 0 12px" }}>Write functions</h2>
      {writeFns.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>No state-changing functions in ABI.</p>
      ) : wallets.length === 0 ? (
        <p style={{ color: "var(--text-dim)" }}>
          Create a backend wallet first to queue write calls.{" "}
          <Link to="/wallets" style={{ color: "var(--accent)" }}>
            Go to Wallets
          </Link>
        </p>
      ) : (
        writeFns.map((fn) => (
          <FunctionCard
            key={fn.name}
            fn={fn}
            contractId={contract.id}
            wallets={wallets}
            onWriteQueued={setLastTxId}
          />
        ))
      )}
    </div>
  );
}
