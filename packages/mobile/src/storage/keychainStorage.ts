import type { SecureStorage } from "@apkaya/connect";
import * as Keychain from "react-native-keychain";

const SERVICE = "apkaya.mobile.sdk";

/**
 * iOS Keychain / Android Keystore secure storage for session tokens.
 * Implements the same SecureStorage interface @apkaya/connect uses.
 */
export function createKeychainStorage(service = SERVICE): SecureStorage {
  return {
    async getItem(key: string): Promise<string | null> {
      try {
        const credentials = await Keychain.getGenericPassword({ service: `${service}:${key}` });
        if (!credentials) return null;
        return credentials.password;
      } catch {
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      await Keychain.setGenericPassword(key, value, {
        service: `${service}:${key}`,
        accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    },
    async removeItem(key: string): Promise<void> {
      await Keychain.resetGenericPassword({ service: `${service}:${key}` });
    },
  };
}

/** Persist SIWE / email session JWT separately from in-app adapter blob. */
export async function saveSiweSessionToken(
  storage: SecureStorage,
  token: string
): Promise<void> {
  await storage.setItem("apkaya_siwe_session_token", token);
}

export async function loadSiweSessionToken(storage: SecureStorage): Promise<string | null> {
  return storage.getItem("apkaya_siwe_session_token");
}

export async function clearSiweSessionToken(storage: SecureStorage): Promise<void> {
  await storage.removeItem("apkaya_siwe_session_token");
}
