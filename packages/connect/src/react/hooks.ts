import { useConnectContext } from "./ConnectProvider.js";

export function useConnect() {
  const ctx = useConnectContext();
  return {
    connect: ctx.connectAdapter,
    disconnect: ctx.disconnect,
    isConnected: ctx.isConnected,
    isConnecting: ctx.isConnecting,
    adapter: ctx.adapter,
    error: ctx.error,
    availableAdapters: ctx.availableAdapters,
    step: ctx.step,
    setStep: ctx.setStep,
    requestEmailOtp: ctx.requestEmailOtp,
    verifyEmailOtp: ctx.verifyEmailOtp,
  };
}

export function useDisconnect() {
  const { disconnect } = useConnectContext();
  return disconnect;
}

export function useAddress() {
  const { address, isConnected } = useConnectContext();
  return { address, isConnected };
}

export function useBalance() {
  const { balance, refreshBalance } = useConnectContext();
  return { balance, refreshBalance };
}

export function useSignMessage() {
  const { signMessage, isConnected } = useConnectContext();
  return { signMessage, isConnected };
}

export function useSendTransaction() {
  const { sendTransaction, isConnected } = useConnectContext();
  return { sendTransaction, isConnected };
}
