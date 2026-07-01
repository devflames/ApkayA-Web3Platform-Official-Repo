import type { CSSProperties } from "react";

interface PipelineRailProps {
  counts: {
    queued: number;
    sent: number;
    mined: number;
    reverted: number;
  };
}

const STAGES: Array<{ key: keyof PipelineRailProps["counts"]; label: string; color: string }> = [
  { key: "queued", label: "Queued", color: "var(--queued)" },
  { key: "sent", label: "Sent", color: "var(--sent)" },
  { key: "mined", label: "Mined", color: "var(--mined)" },
];

/**
 * Renders the real transaction lifecycle as a horizontal rail. Node size/glow
 * reflects the live count at that stage; connectors animate ("flow") only
 * when there's something actually queued behind them, so an idle Engine
 * reads as idle rather than performing motion for its own sake.
 */
export function PipelineRail({ counts }: PipelineRailProps) {
  return (
    <div className="pipeline-rail" aria-label="Transaction pipeline status">
      {STAGES.map((stage, i) => {
        const count = counts[stage.key];
        const nextHasFlow = i === 0 ? count > 0 : counts[STAGES[i - 1].key] > 0;

        return (
          <div key={stage.key} style={{ display: "flex", alignItems: "center", flex: i < STAGES.length - 1 ? 1 : "initial" }}>
            <div
              className={`pipeline-node${count > 0 ? " has-count" : ""}`}
              style={{ "--node-color": stage.color } as CSSProperties}
            >
              <div className="ring">{count}</div>
              <div className="label">{stage.label}</div>
            </div>
            {i < STAGES.length - 1 && (
              <div className={`pipeline-connector${nextHasFlow ? " flowing" : ""}`} />
            )}
          </div>
        );
      })}
      {counts.reverted > 0 && (
        <div style={{ display: "flex", alignItems: "center", marginLeft: 24 }}>
          <div className="pipeline-connector" style={{ minWidth: 24, background: "var(--reverted)" }} />
          <div className="pipeline-node has-count" style={{ "--node-color": "var(--reverted)" } as CSSProperties}>
            <div className="ring">{counts.reverted}</div>
            <div className="label">Reverted</div>
          </div>
        </div>
      )}
    </div>
  );
}
