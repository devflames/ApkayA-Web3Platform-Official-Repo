import React from "react";
import ReactDOM from "react-dom/client";
import { ApkayaClient } from "@apkaya/sdk";

const client = new ApkayaClient({
  baseUrl: import.meta.env.VITE_ENGINE_URL ?? "http://localhost:3005",
  apiKey: import.meta.env.VITE_ENGINE_API_KEY ?? "",
});

function App() {
  const [chains, setChains] = React.useState<Array<{ chainId: number; name: string }>>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    client.chains
      .list()
      .then(setChains)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to connect to Engine"));
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: 40 }}>
      <h1>{{PROJECT_NAME}}</h1>
      <p>Wired up to Engine via @apkaya/sdk. Set VITE_ENGINE_URL and VITE_ENGINE_API_KEY in a .env file.</p>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <ul>
        {chains.map((c) => (
          <li key={c.chainId}>
            {c.name} ({c.chainId})
          </li>
        ))}
      </ul>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
