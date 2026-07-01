import { useState } from "react";
import { useSettings } from "../context/SettingsContext";

export function Settings() {
  const { settings, updateSettings, client } = useSettings();
  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [insightBaseUrl, setInsightBaseUrl] = useState(settings.insightBaseUrl);
  const [apiKey, setApiKey] = useState(settings.apiKey);
  const [testResult, setTestResult] = useState<"idle" | "ok" | "fail">("idle");
  const [testing, setTesting] = useState(false);

  function handleSave() {
    updateSettings({
      baseUrl: baseUrl.trim(),
      insightBaseUrl: insightBaseUrl.trim(),
      apiKey: apiKey.trim(),
    });
    setTestResult("idle");
  }

  async function handleTest() {
    setTesting(true);
    try {
      updateSettings({
        baseUrl: baseUrl.trim(),
        insightBaseUrl: insightBaseUrl.trim(),
        apiKey: apiKey.trim(),
      });
      await client.chains.list();
      setTestResult("ok");
    } catch {
      setTestResult("fail");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="content">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <div className="subtitle">Connect this dashboard to your Engine instance</div>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <div className="field">
          <label htmlFor="base-url">Engine base URL</label>
          <input
            id="base-url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="http://localhost:3005"
            style={{ width: "100%" }}
          />
        </div>

        <div className="field">
          <label htmlFor="insight-base-url">Insight base URL</label>
          <input
            id="insight-base-url"
            value={insightBaseUrl}
            onChange={(e) => setInsightBaseUrl(e.target.value)}
            placeholder="http://localhost:3006"
            style={{ width: "100%" }}
          />
        </div>

        <div className="field">
          <label htmlFor="api-key">API key</label>
          <input
            id="api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="One of your ENGINE_ACCESS_KEYS values"
            style={{ width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button className="btn btn-primary" onClick={handleSave}>
            Save
          </button>
          <button className="btn" onClick={handleTest} disabled={testing}>
            {testing ? "Testing…" : "Test connection"}
          </button>
          {testResult === "ok" && <span style={{ color: "var(--mined)", fontSize: 13 }}>Connected</span>}
          {testResult === "fail" && (
            <span style={{ color: "var(--reverted)", fontSize: 13 }}>Could not reach Engine</span>
          )}
        </div>
      </div>

      <p style={{ color: "var(--text-faint)", fontSize: 12, marginTop: 16, maxWidth: 480 }}>
        Stored locally in your browser only. This dashboard talks directly to your
        Engine API — nothing passes through a third-party server.
      </p>
    </div>
  );
}
