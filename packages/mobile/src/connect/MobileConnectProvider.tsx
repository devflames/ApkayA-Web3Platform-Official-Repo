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
import {
  InAppWalletAdapter,
  completeEmailLogin,
  requestEmailCode,
  requestSiweNonce,
  verifySiwe,
  type ConnectConfig,
  type SecureStorage,
  type WalletAdapter,
} from "@apkaya/connect";
import { ApkayaClient } from "@apkaya/sdk";
import { WalletConnectMobileAdapter, type WalletConnectMobileOptions } from "../adapters/walletConnectMobile.js";
import {
  clearSiweSessionToken,
  createKeychainStorage,
  loadSiweSessionToken,
  saveSiweSessionToken,
} from "../storage/keychainStorage.js";

export type MobileConnectStep = "idle" | "options" | "email" | "email-code" | "connecting";

export interface MobileConnectContextValue {
  client: ApkayaClient;
  config: ConnectConfig;
  address: string | null;
  sessionToken: string | null;
  adapter: WalletAdapter | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  step: MobileConnectStep;
  setStep: (step: MobileConnectStep) => void;
  connectWalletConnect: () => Promise<void>;
  connectInAppEmail: (email: string) => Promise<{ devCode?: string }>;
  verifyInAppEmail: (email: string, code: string) => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: string) => Promise<string>;
  sendTransaction: (tx: {
    to: string;
    value?: bigint;
    data?: string;
    chainId?: number;
  }) => Promise<string>;
  walletConnectUri: string | null;
}

const MobileConnectContext = createContext<MobileConnectContextValue | null>(null);

export function useMobileConnect(): MobileConnectContextValue {
  const ctx = useContext(MobileConnectContext);
  if (!ctx) throw new Error("useMobileConnect must be used within MobileConnectProvider.");
  return ctx;
}

export interface MobileConnectProviderProps {
  engineBaseUrl: string;
  engineApiKey: string;
  insightBaseUrl?: string;
  chainId: number;
  walletConnectProjectId?: string;
  walletConnectMobile: WalletConnectMobileOptions;
  storage?: SecureStorage;
  siwe?: ConnectConfig["siwe"];
  children: ReactNode;
}

export function MobileConnectProvider({
  engineBaseUrl,
  engineApiKey,
  insightBaseUrl,
  chainId,
  walletConnectProjectId,
  walletConnectMobile,
  storage: storageProp,
  siwe,
  children,
}: MobileConnectProviderProps) {
  const storage = useMemo(() => storageProp ?? createKeychainStorage(), [storageProp]);

  const config = useMemo<ConnectConfig>(
    () => ({
      chainId,
      engine: { baseUrl: engineBaseUrl, apiKey: engineApiKey },
      walletConnectProjectId,
      storage,
      siwe,
    }),
    [chainId, engineBaseUrl, engineApiKey, walletConnectProjectId, storage, siwe]
  );

  const client = useMemo(
    () =>
      new ApkayaClient({
        baseUrl: engineBaseUrl,
        apiKey: engineApiKey,
        insightBaseUrl,
      }),
    [engineBaseUrl, engineApiKey, insightBaseUrl]
  );

  const wcRef = useRef(new WalletConnectMobileAdapter(config, walletConnectMobile));
  const inAppRef = useRef(new InAppWalletAdapter(config));

  const [adapter, setAdapter] = useState<WalletAdapter | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<MobileConnectStep>("idle");
  const [walletConnectUri, setWalletConnectUri] = useState<string | null>(null);

  useEffect(() => {
    wcRef.current = new WalletConnectMobileAdapter(
      config,
      { ...walletConnectMobile, onDisplayUri: (uri) => setWalletConnectUri(uri) }
    );
    inAppRef.current = new InAppWalletAdapter(config);
    inAppRef.current.initialize().then(async () => {
      const addr = await inAppRef.current.getAddress();
      if (addr) {
        setAdapter(inAppRef.current);
        setAddress(addr);
        setSessionToken(inAppRef.current.getSessionToken());
      }
    });
    loadSiweSessionToken(storage).then(setSessionToken);
  }, [config, storage, walletConnectMobile]);

  const runSiweIfConfigured = useCallback(
    async (activeAdapter: WalletAdapter, activeAddress: string) => {
      if (!config.siwe) return null;
      const { message } = await requestSiweNonce(config.engine, {
        address: activeAddress,
        chainId: config.chainId,
        domain: config.siwe.domain,
        uri: config.siwe.uri,
        statement: config.siwe.statement,
      });
      const signature = await activeAdapter.signMessage(message);
      const session = await verifySiwe(config.engine, { message, signature });
      await saveSiweSessionToken(storage, session.sessionToken);
      setSessionToken(session.sessionToken);
      return session;
    },
    [config, storage]
  );

  const connectWalletConnect = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setStep("connecting");
    try {
      const wc = wcRef.current;
      await wc.connect();
      const addr = await wc.getAddress();
      if (!addr) throw new Error("No account returned from wallet.");
      await runSiweIfConfigured(wc, addr);
      setAdapter(wc);
      setAddress(addr);
      setStep("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
      setStep("options");
      throw err;
    } finally {
      setIsConnecting(false);
    }
  }, [runSiweIfConfigured]);

  const connectInAppEmail = useCallback(
    async (email: string) => {
      setError(null);
      const result = await requestEmailCode(config.engine, email);
      setStep("email-code");
      return { devCode: result.devCode };
    },
    [config.engine]
  );

  const verifyInAppEmail = useCallback(
    async (email: string, code: string) => {
      setIsConnecting(true);
      setError(null);
      try {
        const session = await completeEmailLogin(config, email, code);
        await inAppRef.current.establishSession(session);
        setAdapter(inAppRef.current);
        setAddress(session.address);
        setSessionToken(session.sessionToken);
        await saveSiweSessionToken(storage, session.sessionToken);
        setStep("idle");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Email verification failed");
        throw err;
      } finally {
        setIsConnecting(false);
      }
    },
    [config, storage]
  );

  const disconnect = useCallback(async () => {
    if (adapter) await adapter.disconnect();
    await clearSiweSessionToken(storage);
    setAdapter(null);
    setAddress(null);
    setSessionToken(null);
    setWalletConnectUri(null);
    setStep("idle");
  }, [adapter, storage]);

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

  const value: MobileConnectContextValue = {
    client,
    config,
    address,
    sessionToken,
    adapter,
    isConnected: Boolean(address),
    isConnecting,
    error,
    step,
    setStep,
    connectWalletConnect,
    connectInAppEmail,
    verifyInAppEmail,
    disconnect,
    signMessage,
    sendTransaction,
    walletConnectUri,
  };

  return <MobileConnectContext.Provider value={value}>{children}</MobileConnectContext.Provider>;
}
