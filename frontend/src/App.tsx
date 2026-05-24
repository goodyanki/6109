import { useState } from "react";
import Agents from "./pages/Agents";
import Intents from "./pages/Intents";
import Batches from "./pages/Batches";
import Metrics from "./pages/Metrics";

const TABS = ["Agents", "Intents", "Batches", "Metrics"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>("Agents");

  return (
    <div className="app">
      <header className="app-header">
        <h1>Macro-Intent Agent Network</h1>
        <p>AI-Powered On-Chain Agent Protocol &mdash; Debug Dashboard</p>
      </header>

      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`tab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      <main>
        {activeTab === "Agents" && <Agents />}
        {activeTab === "Intents" && <Intents />}
        {activeTab === "Batches" && <Batches />}
        {activeTab === "Metrics" && <Metrics />}
      </main>
    </div>
  );
}
