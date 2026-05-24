import { useEffect, useState } from "react";

interface Batch {
  id: number;
  tx_hash: string;
  batch_size: number;
  intent_count: number;
  success_count: number;
  failed_count: number;
  gas_used: number;
  confirmed_at: string;
}

export default function Batches() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/batches")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((data) => {
        setBatches(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading batches...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="card">
      <h2>Batch History</h2>
      {batches.length === 0 ? (
        <div className="empty-state">No batches executed</div>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Tx Hash</th>
                <th>Batch Size</th>
                <th>Intents</th>
                <th>Success</th>
                <th>Failed</th>
                <th>Gas Used</th>
                <th>Success Rate</th>
                <th>Confirmed</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => {
                const rate =
                  batch.intent_count > 0
                    ? (batch.success_count / batch.intent_count) * 100
                    : 0;
                return (
                  <tr key={batch.id}>
                    <td>
                      <span className="tx-link" title={batch.tx_hash}>
                        {batch.tx_hash.slice(0, 10)}...
                        {batch.tx_hash.slice(-6)}
                      </span>
                    </td>
                    <td>{batch.batch_size}</td>
                    <td>{batch.intent_count}</td>
                    <td>
                      <span className="badge badge-green">
                        {batch.success_count}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-red">
                        {batch.failed_count}
                      </span>
                    </td>
                    <td>{batch.gas_used?.toLocaleString() || "-"}</td>
                    <td>
                      <div className="success-bar">
                        <div
                          className="success-bar-fill"
                          style={{ width: `${rate}%` }}
                        />
                        <div
                          className="success-bar-fail"
                          style={{ width: `${100 - rate}%` }}
                        />
                      </div>
                    </td>
                    <td>{batch.confirmed_at || "-"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
