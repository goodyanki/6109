import { useEffect, useState } from "react";

interface Intent {
  id: number;
  chain_intent_id: number;
  agent_address: string;
  intent_type: string;
  token_in: string;
  token_out: string;
  amount_in: string;
  status: string;
  created_at: string;
  executed_at: string;
  deadline: string;
  tx_hash: string;
}

const STATUS_BADGES: Record<string, string> = {
  PENDING: "badge-yellow",
  BATCHED: "badge-blue",
  EXECUTED: "badge-green",
  FAILED: "badge-red",
  EXPIRED: "badge-gray",
  CANCELLED: "badge-purple",
};

export default function Intents() {
  const [intents, setIntents] = useState<Intent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const fetchIntents = (statusFilter: string) => {
    setLoading(true);
    const url =
      statusFilter === "ALL"
        ? "/api/intents?status=ALL&limit=200"
        : `/api/intents?status=${statusFilter}&limit=200`;

    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => {
        setIntents(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchIntents(filter);
  }, [filter]);

  const toggleExpand = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (error) return <div className="error">{error}</div>;

  return (
    <div className="card">
      <h2>Intent Pool</h2>
      <div className="filter-bar">
        <label>Status:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="ALL">ALL</option>
          <option value="PENDING">PENDING</option>
          <option value="BATCHED">BATCHED</option>
          <option value="EXECUTED">EXECUTED</option>
          <option value="FAILED">FAILED</option>
          <option value="EXPIRED">EXPIRED</option>
          <option value="CANCELLED">CANCELLED</option>
        </select>
      </div>

      {loading ? (
        <div className="loading">Loading intents...</div>
      ) : intents.length === 0 ? (
        <div className="empty-state">No intents found</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Agent</th>
                <th>Token In</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {intents.map((intent) => (
                <>
                  <tr
                    key={intent.id}
                    className="expandable-row"
                    onClick={() => toggleExpand(intent.id)}
                  >
                    <td>{intent.chain_intent_id || intent.id}</td>
                    <td>
                      <span
                        className={`badge ${intent.intent_type === "SWAP" ? "badge-blue" : "badge-purple"}`}
                      >
                        {intent.intent_type}
                      </span>
                    </td>
                    <td className="address">
                      {intent.agent_address?.slice(0, 8)}...
                    </td>
                    <td className="address">
                      {intent.token_in?.slice(0, 8)}...
                    </td>
                    <td>{intent.amount_in || "-"}</td>
                    <td>
                      <span
                        className={`badge ${STATUS_BADGES[intent.status] || "badge-gray"}`}
                      >
                        {intent.status}
                      </span>
                    </td>
                    <td>{intent.created_at || "-"}</td>
                  </tr>
                  {expanded.has(intent.id) && (
                    <tr key={`detail-${intent.id}`}>
                      <td colSpan={7}>
                        <div className="expand-detail">
                          <span>Token Out: {intent.token_out || "-"}</span>
                          <span>Deadline: {intent.deadline || "-"}</span>
                          <span>Executed: {intent.executed_at || "-"}</span>
                          <span>Tx: {intent.tx_hash || "-"}</span>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
