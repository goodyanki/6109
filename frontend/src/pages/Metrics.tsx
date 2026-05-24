import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface BenchmarkRun {
  id: number;
  mode: string;
  batch_size: number;
  total_intents: number;
  total_txs: number;
  avg_gas_per_intent: number;
  avg_latency_ms: number;
  throughput: number;
  failed_rate: number;
  created_at: string;
}

interface ComparisonData {
  baseline: BenchmarkRun | null;
  batching: BenchmarkRun | null;
}

export default function Metrics() {
  const [data, setData] = useState<ComparisonData>({
    baseline: null,
    batching: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/metrics/comparison")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading">Loading metrics...</div>;
  if (error) return <div className="error">{error}</div>;

  const hasData = data.baseline || data.batching;

  if (!hasData) {
    return (
      <div className="card">
        <h2>Metrics Comparison</h2>
        <div className="empty-state">
          Run benchmarks to see comparison
        </div>
      </div>
    );
  }

  const baseline = data.baseline;
  const batching = data.batching;

  const chartData = [
    {
      name: "Avg Gas/Intent",
      "No Batching": baseline?.avg_gas_per_intent || 0,
      "Batching (size=10)": batching?.avg_gas_per_intent || 0,
    },
    {
      name: "Throughput (intents/s)",
      "No Batching": baseline?.throughput || 0,
      "Batching (size=10)": batching?.throughput || 0,
    },
    {
      name: "Avg Latency (ms)",
      "No Batching": baseline?.avg_latency_ms || 0,
      "Batching (size=10)": batching?.avg_latency_ms || 0,
    },
    {
      name: "Failure Rate (%)",
      "No Batching": ((baseline?.failed_rate || 0) * 100),
      "Batching (size=10)": ((batching?.failed_rate || 0) * 100),
    },
  ];

  return (
    <div>
      <div className="card">
        <h2>Metrics Comparison</h2>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>No Batching</th>
                <th>Batching (size=10)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Tx Count</td>
                <td>{baseline?.total_txs || "-"}</td>
                <td>{batching?.total_txs || "-"}</td>
              </tr>
              <tr>
                <td>Avg Gas per Intent</td>
                <td>
                  {baseline?.avg_gas_per_intent?.toLocaleString() || "-"}
                </td>
                <td>
                  {batching?.avg_gas_per_intent?.toLocaleString() || "-"}
                </td>
              </tr>
              <tr>
                <td>Throughput (intents/s)</td>
                <td>{baseline?.throughput?.toFixed(2) || "-"}</td>
                <td>{batching?.throughput?.toFixed(2) || "-"}</td>
              </tr>
              <tr>
                <td>Avg Latency (ms)</td>
                <td>{baseline?.avg_latency_ms?.toFixed(0) || "-"}</td>
                <td>{batching?.avg_latency_ms?.toFixed(0) || "-"}</td>
              </tr>
              <tr>
                <td>Failure Rate (%)</td>
                <td>
                  {baseline
                    ? (baseline.failed_rate * 100).toFixed(1) + "%"
                    : "-"}
                </td>
                <td>
                  {batching
                    ? (batching.failed_rate * 100).toFixed(1) + "%"
                    : "-"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card chart-container">
        <h2>Gas per Intent Comparison</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={[{
              name: "Gas per Intent",
              "No Batching": baseline?.avg_gas_per_intent || 0,
              "Batching (size=10)": batching?.avg_gas_per_intent || 0,
            }]}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "1px solid #334155",
                borderRadius: "6px",
                color: "#e2e8f0",
              }}
            />
            <Legend />
            <Bar dataKey="No Batching" fill="#ef4444" />
            <Bar dataKey="Batching (size=10)" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
