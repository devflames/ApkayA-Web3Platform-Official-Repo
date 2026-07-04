import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { ApkayaClient } from "@apkaya/sdk";

interface EngineSettings {
  baseUrl: string;
  apiKey: string;
  /** ENGINE_ADMIN_KEY — only needed for the API Keys page. */
  adminApiKey?: string;
  insightBaseUrl: string;
}

interface SettingsContextValue {
  settings: EngineSettings;
  updateSettings: (next: EngineSettings) => void;
  client: ApkayaClient;
  adminClient: ApkayaClient;
  isConfigured: boolean;
}

const STORAGE_KEY = "apkaya-dashboard:engine-settings";

const defaultSettings: EngineSettings = {
  baseUrl: import.meta.env.VITE_ENGINE_URL || "http://localhost:3005",
  apiKey: import.meta.env.VITE_DEFAULT_API_KEY || "",
  adminApiKey: import.meta.env.VITE_DEFAULT_ADMIN_KEY || "",
  insightBaseUrl: import.meta.env.VITE_INSIGHT_URL || "http://localhost:3006",
};

function loadSettings(): EngineSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<EngineSettings>(loadSettings);

  const updateSettings = (next: EngineSettings) => {
    setSettings(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const client = useMemo(
    () =>
      new ApkayaClient({
        baseUrl: settings.baseUrl,
        apiKey: settings.apiKey,
        insightBaseUrl: settings.insightBaseUrl,
      }),
    [settings.baseUrl, settings.apiKey, settings.insightBaseUrl]
  );

  const adminClient = useMemo(
    () =>
      new ApkayaClient({
        baseUrl: settings.baseUrl,
        apiKey: settings.adminApiKey?.trim() || settings.apiKey,
        insightBaseUrl: settings.insightBaseUrl,
      }),
    [settings.baseUrl, settings.apiKey, settings.adminApiKey, settings.insightBaseUrl]
  );

  const value: SettingsContextValue = {
    settings,
    updateSettings,
    client,
    adminClient,
    isConfigured: Boolean(settings.baseUrl && settings.apiKey),
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
