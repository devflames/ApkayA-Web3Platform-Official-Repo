import { useCallback, useEffect, useMemo, useState } from "react";
import { useAddress, useConnectContext } from "@apkaya/connect/react";
import { parseUnits } from "ethers";
import { useBridgeContext } from "./BridgeProvider.js";
import { listenForOnrampEvents, openOnrampPopup } from "../core/onrampEvents.js";
import type { OnrampStatus, PaymentMethod, SwapStatus } from "../core/types.js";

export interface BuyFlowProps {
  mode?: "buy" | "swap" | "checkout";
  fixedFiatAmount?: number;
  fixedCryptoAmount?: string;
  receiverAddress?: string;
}

function truncate(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function BuyFlow({
  mode = "buy",
  fixedFiatAmount,
  fixedCryptoAmount,
  receiverAddress: receiverOverride,
}: BuyFlowProps) {
  const { onramp, swap, supported, loadingSupported } = useBridgeContext();
  const { address: connectedAddress } = useAddress();
  const { adapter } = useConnectContext();

  const chains = useMemo(() => {
    if (!supported) return [];
    return mode === "swap" ? supported.swapChains : supported.onrampChains;
  }, [supported, mode]);

  const [chainId, setChainId] = useState<number>(8453);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(mode === "swap" ? "crypto" : "card");
  const [amount, setAmount] = useState(fixedFiatAmount ? String(fixedFiatAmount) : "25");
  const [cryptoAmount, setCryptoAmount] = useState(fixedCryptoAmount ?? "0.01");
  const [fromSymbol, setFromSymbol] = useState("ETH");
  const [toSymbol, setToSymbol] = useState("USDC");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [onrampStatus, setOnrampStatus] = useState<OnrampStatus>("idle");
  const [swapStatus, setSwapStatus] = useState<SwapStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (chains.length > 0 && !chains.some((c) => c.chainId === chainId)) {
      setChainId(chains[0].chainId);
    }
  }, [chains, chainId]);

  useEffect(() => {
    if (connectedAddress && !receiverOverride) {
      setReceiverAddress(connectedAddress);
    }
  }, [connectedAddress, receiverOverride]);

  useEffect(() => {
    return listenForOnrampEvents((event) => {
      switch (event.eventName) {
        case "onramp_api.commit_success":
          setOnrampStatus("processing");
          setStatusMessage("Payment authorized — waiting for crypto delivery…");
          break;
        case "onramp_api.polling_success":
          setOnrampStatus("success");
          setStatusMessage("Onramp complete — crypto sent to your wallet.");
          break;
        case "onramp_api.polling_failed":
        case "onramp_api.commit_error":
          setOnrampStatus("error");
          setStatusMessage(event.data?.errorMessage ?? "Onramp failed.");
          break;
        case "onramp_api.cancel":
          setOnrampStatus("cancelled");
          setStatusMessage("Onramp cancelled.");
          break;
        default:
          break;
      }
    });
  }, []);

  const networkKey = useMemo(() => {
    const map: Record<number, string> = {
      1: "ethereum",
      8453: "base",
      42161: "arbitrum",
      10: "optimism",
      137: "polygon",
    };
    return map[chainId] ?? "base";
  }, [chainId]);

  const tokens = useMemo(() => {
    if (!supported?.swapTokens) return [];
    return supported.swapTokens[networkKey] ?? [];
  }, [supported, networkKey]);

  const effectiveReceiver = receiverOverride ?? receiverAddress;

  const handleCardOnramp = useCallback(async () => {
    if (!effectiveReceiver) {
      setStatusMessage("Connect a wallet or enter a receiver address.");
      return;
    }

    setBusy(true);
    setOnrampStatus("opening");
    setStatusMessage("Opening Coinbase onramp…");

    try {
      const session = await onramp.createSession({
        address: effectiveReceiver,
        chainId,
        presetFiatAmount: Number(amount) || undefined,
      });

      const popup = openOnrampPopup(session.popupUrl);
      if (!popup) throw new Error("Popup blocked. Allow popups for this site.");

      setOnrampStatus("processing");
      setStatusMessage("Complete purchase in the Coinbase popup.");
    } catch (err) {
      setOnrampStatus("error");
      setStatusMessage(err instanceof Error ? err.message : "Failed to open onramp.");
    } finally {
      setBusy(false);
    }
  }, [onramp, effectiveReceiver, chainId, amount]);

  const handleCryptoSwap = useCallback(async () => {
    if (!adapter || adapter.type === "in-app") {
      setStatusMessage("Connect an injected or WalletConnect wallet for crypto swaps.");
      return;
    }

    const fromToken = tokens.find((t) => t.symbol === fromSymbol);
    const toToken = tokens.find((t) => t.symbol === toSymbol);
    if (!fromToken || !toToken) {
      setStatusMessage("Select valid tokens.");
      return;
    }

    const taker = await adapter.getAddress();
    if (!taker) {
      setStatusMessage("Wallet not connected.");
      return;
    }

    setBusy(true);
    setSwapStatus("quoting");
    setStatusMessage("Fetching swap quote…");

    try {
      const fromAmount = parseUnits(cryptoAmount || "0", fromToken.decimals).toString();
      setSwapStatus("signing");
      setStatusMessage("Confirm swap in your wallet…");

      const hash = await swap.execute(
        {
          chainId,
          fromToken: fromToken.address,
          toToken: toToken.address,
          fromAmount,
          taker,
          slippageBps: 100,
        },
        adapter
      );

      setSwapStatus("success");
      setTxHash(hash);
      setStatusMessage(`Swap submitted: ${truncate(hash)}`);
    } catch (err) {
      setSwapStatus("error");
      setStatusMessage(err instanceof Error ? err.message : "Swap failed.");
    } finally {
      setBusy(false);
    }
  }, [adapter, tokens, fromSymbol, toSymbol, cryptoAmount, swap, chainId]);

  const title = mode === "checkout" ? "Checkout" : mode === "swap" ? "Swap" : "Buy crypto";

  if (loadingSupported) {
    return (
      <div className="apkaya-bridge__panel">
        <div className="apkaya-bridge__subtitle">Loading bridge config…</div>
      </div>
    );
  }

  if (supported && !supported.cdpConfigured) {
    return (
      <div className="apkaya-bridge__panel">
        <h2 className="apkaya-bridge__title">{title}</h2>
        <p className="apkaya-bridge__subtitle">
          CDP is not configured on Engine. Set CDP_API_KEY_ID and CDP_API_KEY_SECRET.
        </p>
      </div>
    );
  }

  return (
    <div className="apkaya-bridge__panel">
      <h2 className="apkaya-bridge__title">{title}</h2>
      <p className="apkaya-bridge__subtitle">
        {mode === "swap"
          ? "Swap tokens via CDP Trade API (DEX aggregated)."
          : "Buy with card (CDP onramp) or pay with crypto (swap)."}
      </p>

      <div className="apkaya-bridge__field">
        <label htmlFor="apkaya-bridge-chain">Network</label>
        <select
          id="apkaya-bridge-chain"
          value={chainId}
          onChange={(e) => setChainId(Number(e.target.value))}
        >
          {chains.map((c) => (
            <option key={c.chainId} value={c.chainId}>
              {c.name} ({c.chainId})
            </option>
          ))}
        </select>
      </div>

      {mode !== "swap" && (
        <div className="apkaya-bridge__toggle">
          <button
            type="button"
            className={paymentMethod === "card" ? "active" : ""}
            onClick={() => setPaymentMethod("card")}
          >
            Card
          </button>
          <button
            type="button"
            className={paymentMethod === "crypto" ? "active" : ""}
            onClick={() => setPaymentMethod("crypto")}
          >
            Crypto
          </button>
        </div>
      )}

      {(paymentMethod === "card" || mode === "checkout") && mode !== "swap" && (
        <>
          <div className="apkaya-bridge__field">
            <label htmlFor="apkaya-bridge-fiat">Amount (USD)</label>
            <input
              id="apkaya-bridge-fiat"
              type="number"
              min="5"
              value={amount}
              disabled={Boolean(fixedFiatAmount)}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="apkaya-bridge__field">
            <label htmlFor="apkaya-bridge-receiver">Receiver address</label>
            <input
              id="apkaya-bridge-receiver"
              type="text"
              value={effectiveReceiver}
              disabled={Boolean(receiverOverride || connectedAddress)}
              onChange={(e) => setReceiverAddress(e.target.value)}
              placeholder="0x…"
            />
          </div>
          <button
            type="button"
            className="apkaya-bridge__btn apkaya-bridge__btn-primary"
            disabled={busy}
            onClick={() => void handleCardOnramp()}
          >
            Buy with card
          </button>
        </>
      )}

      {(paymentMethod === "crypto" || mode === "swap") && (
        <>
          <div className="apkaya-bridge__row">
            <div className="apkaya-bridge__field">
              <label htmlFor="apkaya-bridge-from">From</label>
              <select id="apkaya-bridge-from" value={fromSymbol} onChange={(e) => setFromSymbol(e.target.value)}>
                {tokens.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol}
                  </option>
                ))}
              </select>
            </div>
            <div className="apkaya-bridge__field">
              <label htmlFor="apkaya-bridge-to">To</label>
              <select id="apkaya-bridge-to" value={toSymbol} onChange={(e) => setToSymbol(e.target.value)}>
                {tokens.map((t) => (
                  <option key={t.symbol} value={t.symbol}>
                    {t.symbol}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="apkaya-bridge__field">
            <label htmlFor="apkaya-bridge-crypto-amt">Amount</label>
            <input
              id="apkaya-bridge-crypto-amt"
              type="text"
              value={cryptoAmount}
              disabled={Boolean(fixedCryptoAmount)}
              onChange={(e) => setCryptoAmount(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="apkaya-bridge__btn apkaya-bridge__btn-primary"
            disabled={busy}
            onClick={() => void handleCryptoSwap()}
          >
            {mode === "swap" ? "Swap" : "Pay with crypto"}
          </button>
        </>
      )}

      {statusMessage && (
        <div
          className={`apkaya-bridge__status ${
            onrampStatus === "success" || swapStatus === "success"
              ? "success"
              : onrampStatus === "error" || swapStatus === "error"
                ? "error"
                : onrampStatus === "processing" || swapStatus === "signing" || swapStatus === "quoting"
                  ? "pending"
                  : ""
          }`}
        >
          {statusMessage}
          {txHash && <div className="apkaya-bridge__mono">{txHash}</div>}
        </div>
      )}
    </div>
  );
}
