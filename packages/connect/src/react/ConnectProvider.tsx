import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { BrowserProvider, formatEther } from "ethers";
import type { ConnectConfig, WalletAdapter } from "../core/types.js";
import type { ConnectTheme } from "../core/theme.js";
import { defaultDarkTheme, themeToCssVars } from "../core/theme.js";
import { InjectedAdapter, detectInjectedWalletName } from "../adapters/injected.js";
import { WalletConnectAdapter } from "../adapters/walletConnect.js";
import { InAppWalletAdapter, completeEmailLogin } from "../adapters/inApp.js";
import { requestEmailCode, requestSiweNonce, verifySiwe } from "../core/siwe.js";

async function fetchAdapterBalance(
  adapter: WalletAdapter,
  address: string,
  chainId: number
): Promise<string | null> {
  if (adapter.type === "in-app") return null;

  let provider: BrowserProvider | null = null;
  if (adapter instanceof InjectedAdapter) {
    provider = adapter.getEthersProvider();
  } else if (adapter instanceof WalletConnectAdapter) {
    provider = adapter.getEthersProvider();
  }

  if (!provider) return null;
  const wei = await provider.getBalance(address);
  return `${formatEther(wei).slice(0, 8)} ETH`;
}

export type ConnectStep = "idle" | "options" | "email" | "email-code" | "connecting";

export interface ConnectContextValue {
  config: ConnectConfig;
  theme: ConnectTheme;
  address: string | null;
  balance: string | null;
  adapter: WalletAdapter | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  step: ConnectStep;
  setStep: (step: ConnectStep) => void;
  connectAdapter: (adapter: WalletAdapter) => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  sendTransaction: (tx: {
    to: string;
    value?: bigint;
    data?: string;
    chainId?: number;
  }) => Promise<string>;
  requestEmailOtp: (email: string) => Promise<{ devCode?: string }>;
  verifyEmailOtp: (email: string, code: string) => Promise<void>;
  availableAdapters: Array<{ adapter: WalletAdapter; label: string; enabled: boolean }>;
  refreshBalance: () => Promise<void>;
}

const ConnectContext = createContext<ConnectContextValue | null>(null);

export function useConnectContext(): ConnectContextValue {
  const ctx = useContext(ConnectContext);
  if (!ctx) throw new Error("Connect hooks must be used within ConnectProvider.");
  return ctx;
}

export interface ConnectProviderProps {
  config: ConnectConfig;
  theme?: ConnectTheme;
  children: ReactNode;
}

export function ConnectProvider({ config, theme, children }: ConnectProviderProps) {
  const mergedTheme = useMemo(() => ({ ...defaultDarkTheme, ...theme }), [theme]);
  const cssVars = useMemo(() => themeToCssVars(mergedTheme), [mergedTheme]);

  const injectedRef = useRef(new InjectedAdapter(config.chainId));
  const wcRef = useRef(new WalletConnectAdapter(config));
  const inAppRef = useRef(new InAppWalletAdapter(config));

  useEffect(() => {
    inAppRef.current.initialize().then(() => {
      inAppRef.current.getAddress().then((addr) => {
        if (addr) {
          setAdapter(inAppRef.current);
          setAddress(addr);
        }
      });
    });
  }, [config]);

  const [adapter, setAdapter] = useState<WalletAdapter | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<ConnectStep>("idle");

  const availableAdapters = useMemo(
    () => [
      {
        adapter: injectedRef.current,
        label: detectInjectedWalletName(),
        enabled: injectedRef.current.isAvailable(),
      },
      {
        adapter: wcRef.current,
        label: "WalletConnect",
        enabled: wcRef.current.isAvailable(),
      },
      {
        adapter: inAppRef.current,
        label: "Continue with email",
        enabled: inAppRef.current.isAvailable(),
      },
    ],
    [config]
  );

  const refreshBalance = useCallback(async () => {
    if (!address || !adapter) {
      setBalance(null);
      return;
    }
    try {
      const formatted = await fetchAdapterBalance(adapter, address, config.chainId);
      setBalance(formatted);
    } catch {
      setBalance(null);
    }
  }, [address, adapter, config.chainId]);

  useEffect(() => {
    void refreshBalance();
  }, [refreshBalance]);

  useEffect(() => {
    if (!adapter) return;
    return adapter.subscribeAccountChange((next) => {
      setAddress(next);
      if (!next) setBalance(null);
    });
  }, [adapter]);

  useEffect(() => {
    void inAppRef.current.getAddress().then((addr) => {
      if (addr) {
        setAdapter(inAppRef.current);
        setAddress(addr);
      }
    });
  }, []);

  const connectAdapter = useCallback(
    async (next: WalletAdapter) => {
      setIsConnecting(true);
      setError(null);
      try {
        if (next.type === "in-app") {
          setStep("email");
          return;
        }

        await next.connect();
        const addr = await next.getAddress();
        setAdapter(next);
        setAddress(addr);
        setStep("idle");

        if (config.siwe && addr) {
          const nonce = await requestSiweNonce(config.engine, {
            address: addr,
            chainId: config.chainId,
            domain: config.siwe.domain,
            uri: config.siwe.uri,
            statement: config.siwe.statement,
          });
          const signature = await next.signMessage(nonce.message);
          await verifySiwe(config.engine, { message: nonce.message, signature });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Connection failed.");
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [config]
  );

  const disconnect = useCallback(async () => {
    setError(null);
    if (adapter) await adapter.disconnect();
    setAdapter(null);
    setAddress(null);
    setBalance(null);
    setStep("idle");
  }, [adapter]);

  const signMessage = useCallback(
    async (message: string) => {
      if (!adapter) throw new Error("Not connected.");
      return adapter.signMessage(message);
    },
    [adapter]
  );

  const sendTransaction = useCallback(
    async (tx: { to: string; value?: bigint; data?: string; chainId?: number }) => {
      if (!adapter) throw new Error("Not connected.");
      return adapter.sendTransaction(tx);
    },
    [adapter]
  );

  const requestEmailOtp = useCallback(
    async (email: string) => {
      setError(null);
      const result = await requestEmailCode(config.engine, email);
      setStep("email-code");
      return { devCode: result.devCode };
    },
    [config.engine]
  );

  const verifyEmailOtp = useCallback(async (email: string, code: string) => {
    setIsConnecting(true);
    setError(null);
    try {
      const session = await completeEmailLogin(config, email, code);
      await inAppRef.current.establishSession(session);
      setAdapter(inAppRef.current);
      setAddress(session.address);
      setStep("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [config]);

  const value: ConnectContextValue = {
    config,
    theme: mergedTheme,
    address,
    balance,
    adapter,
    isConnected: Boolean(address),
    isConnecting,
    error,
    step,
    setStep,
    connectAdapter,
    disconnect,
    signMessage,
    sendTransaction,
    requestEmailOtp,
    verifyEmailOtp,
    availableAdapters,
    refreshBalance,
  };

  return (
    <ConnectContext.Provider value={value}>
      <div className="apkaya-connect" style={cssVars as React.CSSProperties}>
        {children}
      </div>
    </ConnectContext.Provider>
  );
}
