export { ApkayaClient } from "@apkaya/sdk";
export type * from "@apkaya/sdk";

export type {
  ConnectConfig,
  SecureStorage,
  WalletAdapter,
  SiweSessionResult,
} from "@apkaya/connect";
export {
  requestSiweNonce,
  verifySiwe,
  requestEmailCode,
  verifyEmailCode,
  InAppWalletAdapter,
  completeEmailLogin,
} from "@apkaya/connect";

export { createKeychainStorage, saveSiweSessionToken, loadSiweSessionToken, clearSiweSessionToken } from "./storage/keychainStorage.js";
export { WalletConnectMobileAdapter, handleWalletConnectDeepLink } from "./adapters/walletConnectMobile.js";
export type { WalletConnectMobileOptions } from "./adapters/walletConnectMobile.js";
export {
  MobileConnectProvider,
  useMobileConnect,
} from "./connect/MobileConnectProvider.js";
export type { MobileConnectContextValue, MobileConnectStep } from "./connect/MobileConnectProvider.js";
