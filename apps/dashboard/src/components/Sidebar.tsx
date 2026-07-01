import { NavLink } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";

const links = [
  { to: "/", label: "Overview", end: true },
  { to: "/wallets", label: "Backend Wallets" },
  { to: "/transactions", label: "Transactions" },
  { to: "/contracts", label: "Contracts" },
  { to: "/api-keys", label: "API Keys" },
  { to: "/chains", label: "Chains" },
  { to: "/settings", label: "Settings" },
];

export function Sidebar() {
  const { isConfigured, settings } = useSettings();

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="mark" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="13" height="13">
            <path d="M12 2 L22 21 L17.2 21 L15.1 16.6 L8.9 16.6 L6.8 21 L2 21 Z M12 8.4 L9.7 13 L14.3 13 Z" fill="#0b0b0d" />
          </svg>
        </div>
        <span>ApkayA</span>
      </div>

      <nav className="nav-group">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="conn-indicator">
          <span
            className="dot"
            style={{ background: isConfigured ? "var(--mined)" : "var(--reverted)" }}
          />
          {isConfigured ? settings.baseUrl.replace(/^https?:\/\//, "") : "Not configured"}
        </div>
      </div>
    </aside>
  );
}
