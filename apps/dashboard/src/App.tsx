import { HashRouter, Routes, Route } from "react-router-dom";
import { SettingsProvider } from "./context/SettingsContext";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./pages/Overview";
import { Wallets } from "./pages/Wallets";
import { Transactions } from "./pages/Transactions";
import { ApiKeys } from "./pages/ApiKeys";
import { Chains } from "./pages/Chains";
import { Contracts } from "./pages/Contracts";
import { ContractDetail } from "./pages/ContractDetail";
import { Bridge } from "./pages/Bridge";
import { Insight } from "./pages/Insight";
import { Settings } from "./pages/Settings";

export function App() {
  return (
    <SettingsProvider>
      <HashRouter>
        <div className="app-shell">
          <Sidebar />
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/wallets" element={<Wallets />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/api-keys" element={<ApiKeys />} />
            <Route path="/chains" element={<Chains />} />
            <Route path="/contracts" element={<Contracts />} />
            <Route path="/contracts/:id" element={<ContractDetail />} />
            <Route path="/bridge" element={<Bridge />} />
            <Route path="/insight" element={<Insight />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </div>
      </HashRouter>
    </SettingsProvider>
  );
}
