import { useEffect, useState } from "react";

interface Agent {
  id: number;
  chain_agent_id: number;
  owner: string;
  agent_address: string;
  active: number;
  created_at: string;
}

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => {
        setAgents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading agents...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="card">
      <h2>Registered Agents</h2>
      {agents.length === 0 ? (
        <div className="empty-state">No agents registered</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Address</th>
                <th>Owner</th>
                <th>Active</th>
                <th>Registered At</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((agent) => (
                <tr key={agent.id}>
                  <td>{agent.chain_agent_id || agent.id}</td>
                  <td className="address">
                    {agent.agent_address.slice(0, 10)}...
                    {agent.agent_address.slice(-6)}
                  </td>
                  <td className="address">
                    {agent.owner.slice(0, 10)}...
                    {agent.owner.slice(-6)}
                  </td>
                  <td>
                    <span
                      className={`badge ${agent.active ? "badge-green" : "badge-red"}`}
                    >
                      {agent.active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{agent.created_at || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
