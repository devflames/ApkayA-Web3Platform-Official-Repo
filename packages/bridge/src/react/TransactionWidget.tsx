import { useCallback, useEffect, useState } from "react";
import { useSendTransaction, useConnectContext } from "@apkaya/connect/react";
import { useBridgeContext } from "./BridgeProvider.js";

export interface PreparedTransaction {
  to: string;
  data?: string;
  valueWei?: string;
  chainId: number;
}

export interface TransactionWidgetProps {
  prepared?: PreparedTransaction;
  /** Engine transaction id when using backend queue instead of wallet send */
  engineTransactionId?: string;
  onComplete?: (result: { txHash?: string; status: string }) => void;
}

const TERMINAL = new Set(["mined", "reverted", "errored", "cancelled"]);

export function TransactionWidget({ prepared, engineTransactionId, onComplete }: TransactionWidgetProps) {
  const { engine } = useBridgeContext();
  const { sendTransaction, isConnected } = useSendTransaction();
  const { adapter } = useConnectContext();

  const [status, setStatus] = useState<string>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pollEngineTx = useCallback(
    async (id: string) => {
      setStatus("pending");
      const start = Date.now();
      while (Date.now() - start < 120_000) {
        const res = await fetch(`${engine.baseUrl.replace(/\/$/, "")}/transaction/status/${id}`, {
          headers: { Authorization: `Bearer ${engine.apiKey}` },
        });
        const body = (await res.json()) as { result?: { status: string; tx_hash?: string | null } };
        const tx = body.result;
        if (!tx) break;

        setStatus(tx.status);
        if (tx.tx_hash) setTxHash(tx.tx_hash);

        if (TERMINAL.has(tx.status)) {
          onComplete?.({ txHash: tx.tx_hash ?? undefined, status: tx.status });
          return;
        }

        await new Promise((r) => setTimeout(r, 2000));
      }
      setError("Timed out waiting for transaction.");
    },
    [engine, onComplete]
  );

  useEffect(() => {
    if (engineTransactionId) {
      void pollEngineTx(engineTransactionId);
    }
  }, [engineTransactionId, pollEngineTx]);

  const submit = async () => {
    if (!prepared) return;
    if (!isConnected || !adapter) {
      setError("Connect a wallet first.");
      return;
    }

    setBusy(true);
    setError(null);
    setStatus("signing");

    try {
      const hash = await sendTransaction({
        to: prepared.to,
        data: prepared.data,
        value: prepared.valueWei ? BigInt(prepared.valueWei) : 0n,
        chainId: prepared.chainId,
      });
      setTxHash(hash);
      setStatus("pending");
      onComplete?.({ txHash: hash, status: "pending" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transaction failed.");
      setStatus("error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="apkaya-bridge__panel">
      <h2 className="apkaya-bridge__title">Transaction</h2>
      <p className="apkaya-bridge__subtitle">Submit a prepared transaction and track its status.</p>

      {prepared && (
        <div className="apkaya-bridge__mono" style={{ marginBottom: 12 }}>
          To: {prepared.to}
          {prepared.valueWei ? ` · value: ${prepared.valueWei} wei` : ""}
        </div>
      )}

      {engineTransactionId && (
        <div className="apkaya-bridge__mono" style={{ marginBottom: 12 }}>
          Engine tx: {engineTransactionId}
        </div>
      )}

      {prepared && !engineTransactionId && (
        <button
          type="button"
          className="apkaya-bridge__btn apkaya-bridge__btn-primary"
          disabled={busy}
          onClick={() => void submit()}
        >
          Submit transaction
        </button>
      )}

      {(status !== "idle" || error) && (
        <div
          className={`apkaya-bridge__status ${
            status === "mined" ? "success" : status === "error" || status === "reverted" ? "error" : "pending"
          }`}
        >
          {error ?? `Status: ${status}`}
          {txHash && <div className="apkaya-bridge__mono">{txHash}</div>}
        </div>
      )}
    </div>
  );
}

export interface TransactionButtonProps extends TransactionWidgetProps {
  label?: string;
}

export function TransactionButton({ label = "Submit transaction", ...props }: TransactionButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="apkaya-bridge__btn apkaya-bridge__btn-primary"
        onClick={() => setOpen(true)}
      >
        {label}
      </button>
      {open && (
        <div className="apkaya-connect__overlay" role="dialog" aria-modal="true">
          <div className="apkaya-connect__modal-wrap">
            <button
              type="button"
              className="apkaya-connect__close"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              ×
            </button>
            <div className="apkaya-connect__modal">
              <TransactionWidget {...props} onComplete={(r) => { props.onComplete?.(r); setOpen(false); }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
