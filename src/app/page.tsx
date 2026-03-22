import { azava } from "@/lib/azava";

export const dynamic = "force-dynamic";

export default async function Home() {
  const schema = await azava.schema();
  const nodeTypes: Array<{ name?: string; label?: string; category?: string }> =
    schema.nodeTypes ?? schema.node_types ?? [];

  return (
    <>
      <h1 style={{ fontSize: "1.5rem", fontWeight: 600, marginBottom: "1.5rem" }}>
        Dashboard
      </h1>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "1rem",
        marginBottom: "2rem",
      }}>
        <Card label="Node Types" value={nodeTypes.length} />
      </div>

      {nodeTypes.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Category</Th>
            </tr>
          </thead>
          <tbody>
            {nodeTypes.map((t, i) => (
              <tr key={i}>
                <Td>{t.name ?? t.label}</Td>
                <Td>{t.category ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      border: "1px solid var(--border)",
      borderRadius: 8,
      padding: "1.5rem",
    }}>
      <div style={{
        fontSize: "0.75rem",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--text-secondary)",
        marginBottom: "0.25rem",
      }}>
        {label}
      </div>
      <div style={{ fontSize: "2rem", fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      textAlign: "left",
      padding: "0.5rem",
      borderBottom: "1px solid var(--border)",
      fontSize: "0.75rem",
      textTransform: "uppercase",
      letterSpacing: "0.05em",
      color: "var(--text-secondary)",
    }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{
      textAlign: "left",
      padding: "0.5rem",
      borderBottom: "1px solid var(--border)",
    }}>
      {children}
    </td>
  );
}
