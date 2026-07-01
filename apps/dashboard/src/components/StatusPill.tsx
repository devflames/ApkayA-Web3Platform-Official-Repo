const STATUS_STYLE: Record<string, { color: string; label: string }> = {
  queued: { color: "var(--queued)", label: "Queued" },
  sent: { color: "var(--sent)", label: "Sent" },
  mined: { color: "var(--mined)", label: "Mined" },
  reverted: { color: "var(--reverted)", label: "Reverted" },
  errored: { color: "var(--reverted)", label: "Errored" },
  cancelled: { color: "var(--text-faint)", label: "Cancelled" },
};

export function StatusPill({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? { color: "var(--text-dim)", label: status };

  return (
    <span
      className="status-pill"
      style={{ color: style.color, borderColor: style.color + "40" }}
    >
      <span className="dot" style={{ background: style.color }} />
      {style.label}
    </span>
  );
}
