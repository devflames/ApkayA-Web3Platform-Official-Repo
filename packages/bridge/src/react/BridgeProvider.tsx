import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { ConnectTheme } from "@apkaya/connect";
import { defaultDarkTheme, themeToCssVars } from "@apkaya/connect";
import type { BridgeEngineConfig, BridgeSupportedResponse } from "../core/types.js";
import { fetchBridgeSupported } from "../core/client.js";
import { CoinbaseOnrampProvider, type OnrampProvider } from "../providers/onramp.js";
import { CoinbaseSwapProvider, type SwapProvider } from "../providers/swap.js";

export interface BridgeContextValue {
  engine: BridgeEngineConfig;
  theme: ConnectTheme;
  onramp: OnrampProvider;
  swap: SwapProvider;
  supported: BridgeSupportedResponse | null;
  loadingSupported: boolean;
}

const BridgeContext = createContext<BridgeContextValue | null>(null);

export function useBridgeContext(): BridgeContextValue {
  const ctx = useContext(BridgeContext);
  if (!ctx) throw new Error("Bridge components must be used within BridgeProvider.");
  return ctx;
}

export interface BridgeProviderProps {
  engine: BridgeEngineConfig;
  theme?: ConnectTheme;
  onrampProvider?: OnrampProvider;
  swapProvider?: SwapProvider;
  children: ReactNode;
}

export function BridgeProvider({
  engine,
  theme,
  onrampProvider,
  swapProvider,
  children,
}: BridgeProviderProps) {
  const mergedTheme = useMemo(() => ({ ...defaultDarkTheme, ...theme }), [theme]);
  const cssVars = useMemo(() => themeToCssVars(mergedTheme), [mergedTheme]);

  const onramp = useMemo(
    () => onrampProvider ?? new CoinbaseOnrampProvider(engine),
    [onrampProvider, engine]
  );
  const swap = useMemo(() => swapProvider ?? new CoinbaseSwapProvider(engine), [swapProvider, engine]);

  const [supported, setSupported] = useState<BridgeSupportedResponse | null>(null);
  const [loadingSupported, setLoadingSupported] = useState(true);

  useEffect(() => {
    fetchBridgeSupported(engine)
      .then(setSupported)
      .catch(() => setSupported(null))
      .finally(() => setLoadingSupported(false));
  }, [engine]);

  const value: BridgeContextValue = {
    engine,
    theme: mergedTheme,
    onramp,
    swap,
    supported,
    loadingSupported,
  };

  return (
    <BridgeContext.Provider value={value}>
      <div className="apkaya-bridge" style={cssVars as React.CSSProperties}>
        {children}
      </div>
    </BridgeContext.Provider>
  );
}
