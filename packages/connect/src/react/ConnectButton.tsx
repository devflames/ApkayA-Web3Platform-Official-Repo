import { useState } from "react";
import type { ConnectTheme } from "../core/theme.js";
import { ConnectProvider } from "./ConnectProvider.js";
import { ConnectPanel } from "./ConnectPanel.js";
import { useAddress, useBalance, useConnect, useDisconnect } from "./hooks.js";
import "./connect.css";

export interface ConnectButtonProps {
  theme?: ConnectTheme;
}

function ConnectButtonInner({ onOpen }: { onOpen: () => void }) {
  const { isConnected } = useConnect();
  const { address } = useAddress();
  const { balance } = useBalance();
  const disconnect = useDisconnect();

  if (isConnected && address) {
    const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
    return (
      <div className="apkaya-connect__connected">
        <button type="button" className="apkaya-connect__btn apkaya-connect__btn-primary" onClick={onOpen}>
          {short}
        </button>
        {balance && <span className="apkaya-connect__balance">{balance}</span>}
        <button type="button" className="apkaya-connect__btn" onClick={() => void disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button type="button" className="apkaya-connect__btn apkaya-connect__btn-primary" onClick={onOpen}>
      Connect wallet
    </button>
  );
}

export function ConnectButton({ theme }: ConnectButtonProps) {
  const [open, setOpen] = useState(false);
  const { setStep } = useConnect();

  return (
    <>
      <ConnectButtonInner
        onOpen={() => {
          setStep("options");
          setOpen(true);
        }}
      />
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
              <ConnectPanel onClose={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Wrapper that includes ConnectProvider — use when not already wrapped. */
export function ConnectButtonWithProvider(props: ConnectButtonProps & { config: import("../core/types.js").ConnectConfig }) {
  const { config, theme } = props;
  return (
    <ConnectProvider config={config} theme={theme}>
      <ConnectButton theme={theme} />
    </ConnectProvider>
  );
}

export interface ConnectEmbedProps {
  theme?: ConnectTheme;
}

export function ConnectEmbed({ theme: _theme }: ConnectEmbedProps) {
  return (
    <div className="apkaya-connect__embed">
      <ConnectPanel />
    </div>
  );
}

export function ConnectEmbedWithProvider(props: ConnectEmbedProps & { config: import("../core/types.js").ConnectConfig }) {
  const { config, theme } = props;
  return (
    <ConnectProvider config={config} theme={theme}>
      <ConnectEmbed theme={theme} />
    </ConnectProvider>
  );
}
