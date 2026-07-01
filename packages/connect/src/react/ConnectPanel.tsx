import { useState } from "react";
import { useConnectContext } from "./ConnectProvider.js";

function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export interface ConnectPanelProps {
  onClose?: () => void;
}

export function ConnectPanel({ onClose }: ConnectPanelProps) {
  const {
    step,
    setStep,
    availableAdapters,
    connectAdapter,
    isConnecting,
    error,
    requestEmailOtp,
    verifyEmailOtp,
    isConnected,
    address,
    balance,
    disconnect,
  } = useConnectContext();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [devHint, setDevHint] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  if (isConnected && address) {
    return (
      <div>
        <h2 className="apkaya-connect__title">Connected</h2>
        <p className="apkaya-connect__subtitle">Your wallet is linked to this app.</p>
        <div className="apkaya-connect__connected">
          <span className="apkaya-connect__address">{truncateAddress(address)}</span>
          {balance && <span className="apkaya-connect__balance">{balance}</span>}
        </div>
        <div className="apkaya-connect__actions">
          <button type="button" className="apkaya-connect__btn" onClick={() => void disconnect()}>
            Disconnect
          </button>
          {onClose && (
            <button type="button" className="apkaya-connect__btn apkaya-connect__btn-primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    );
  }

  if (step === "email") {
    return (
      <div>
        <h2 className="apkaya-connect__title">Continue with email</h2>
        <p className="apkaya-connect__subtitle">No browser extension required.</p>
        {(error || localError) && <div className="apkaya-connect__error">{error ?? localError}</div>}
        <div className="apkaya-connect__field">
          <label htmlFor="apkaya-email">Email address</label>
          <input
            id="apkaya-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </div>
        <div className="apkaya-connect__actions">
          <button type="button" className="apkaya-connect__btn" onClick={() => setStep("options")}>
            Back
          </button>
          <button
            type="button"
            className="apkaya-connect__btn apkaya-connect__btn-primary"
            disabled={isConnecting || !email.includes("@")}
            onClick={() => {
              setLocalError(null);
              void requestEmailOtp(email)
                .then((r) => {
                  if (r.devCode) setDevHint(`Dev code: ${r.devCode}`);
                })
                .catch((err) =>
                  setLocalError(err instanceof Error ? err.message : "Failed to send code.")
                );
            }}
          >
            Send code
          </button>
        </div>
      </div>
    );
  }

  if (step === "email-code") {
    return (
      <div>
        <h2 className="apkaya-connect__title">Enter verification code</h2>
        <p className="apkaya-connect__subtitle">We sent a code to {email}.</p>
        {devHint && <div className="apkaya-connect__subtitle">{devHint}</div>}
        {(error || localError) && <div className="apkaya-connect__error">{error ?? localError}</div>}
        <div className="apkaya-connect__field">
          <label htmlFor="apkaya-code">Verification code</label>
          <input
            id="apkaya-code"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
        </div>
        <div className="apkaya-connect__actions">
          <button type="button" className="apkaya-connect__btn" onClick={() => setStep("email")}>
            Back
          </button>
          <button
            type="button"
            className="apkaya-connect__btn apkaya-connect__btn-primary"
            disabled={isConnecting || code.length < 4}
            onClick={() => {
              setLocalError(null);
              void verifyEmailOtp(email, code).catch((err) =>
                setLocalError(err instanceof Error ? err.message : "Invalid code.")
              );
            }}
          >
            Verify
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="apkaya-connect__title">Connect wallet</h2>
      <p className="apkaya-connect__subtitle">Choose how you want to connect.</p>
      {error && <div className="apkaya-connect__error">{error}</div>}
      <div className="apkaya-connect__options">
        {availableAdapters.map(({ adapter, label, enabled }) => (
          <button
            key={adapter.id}
            type="button"
            className="apkaya-connect__option"
            disabled={!enabled || isConnecting}
            onClick={() => {
              if (adapter.type === "in-app") {
                setStep("email");
                return;
              }
              void connectAdapter(adapter).catch(() => undefined);
            }}
          >
            <span>{label}</span>
            {!enabled && <span className="apkaya-connect__badge">Unavailable</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
