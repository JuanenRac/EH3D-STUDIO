/* The drawing of a job: the board seen from above, every hole in the colour of its tool (the ones already drilled filled, the next one ringed) and the routing paths
 * over it. Millimetres in the box of the view; the Y axis points up as on the machine. */
import { holeRadius, holesDone, planBox, toolColour } from "../jobtools";
import type { JobView } from "../types";

export function PlanView({ view, itemsDone, label }: { view: JobView; itemsDone?: number; label: string }) {
  const box = planBox(view);
  const r = holeRadius(box);
  const done = itemsDone == null ? 0 : holesDone(view, itemsDone);
  const flip = (y: number) => 2 * box.y + box.h - y; // up is up
  const stroke = Math.max(Math.max(box.w, box.h) / 400, 0.15);
  return (
    <svg className="plan" viewBox={`${box.x} ${box.y} ${box.w} ${box.h}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
      <rect x={box.x} y={box.y} width={box.w} height={box.h} className="plan-bg" />
      {view.paths.map((p, i) => (
        <polyline
          key={`p${i}`}
          className="plan-path"
          fill="none"
          stroke={toolColour(p.tool ?? p.pen ?? 1)}
          strokeWidth={stroke * 2}
          strokeLinejoin="round"
          points={p.points_mm.map(([x, y]) => `${x},${flip(y)}`).join(" ")}
        />
      ))}
      {view.holes.map((h, i) => {
        const isDone = i < done;
        const next = itemsDone != null && i === done;
        return (
          <circle
            key={`h${i}`}
            cx={h.x_mm}
            cy={flip(h.y_mm)}
            r={next ? r * 1.5 : r}
            fill={isDone ? toolColour(h.tool) : "none"}
            stroke={toolColour(h.tool)}
            strokeWidth={stroke * (next ? 3 : 1.5)}
            opacity={isDone ? 0.55 : 1}
          />
        );
      })}
    </svg>
  );
}
