import type { SecureStorage } from "../core/types.js";

/** Browser localStorage adapter — default for web. */
export const localStorageAdapter: SecureStorage = {
  getItem(key: string) {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(key, value);
  },
  removeItem(key: string) {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(key);
  },
};

export async function storageGet(
  storage: SecureStorage | undefined,
  key: string
): Promise<string | null> {
  const value = storage ? storage.getItem(key) : localStorageAdapter.getItem(key);
  return Promise.resolve(value);
}

export async function storageSet(
  storage: SecureStorage | undefined,
  key: string,
  value: string
): Promise<void> {
  const target = storage ?? localStorageAdapter;
  await Promise.resolve(target.setItem(key, value));
}

export async function storageRemove(storage: SecureStorage | undefined, key: string): Promise<void> {
  const target = storage ?? localStorageAdapter;
  await Promise.resolve(target.removeItem(key));
}
