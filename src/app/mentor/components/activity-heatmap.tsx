import { useMemo } from "react";
import type { ActivityEvent, Student } from "./mentor-data";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 24 * 60 * 60 * 1000;
const CELL = 11;   // px — cell size
const GAP  = 3;    // px — gap between cells

function dateKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function parseEventDate(stamp: string): Date | null {
  const d = new Date(stamp);
  if (!isNaN(d.getTime())) return d;
  const m = stamp.match(/^([A-Z][a-z]{2})\s(\d{1,2})/);
  if (!m) return null;
  const month = MONTH_LABELS.indexOf(m[1]);
  if (month < 0) return null;
  return new Date(new Date().getFullYear(), month, Number(m[2]));
}

const LEVELS = [
  "#eef2f6",
  "#cfe2ef",
  "#8ec4dd",
  "#4493BF",
  "#0c3455",
];

export function ActivityHeatmap({ events, student }: { events: ActivityEvent[]; student: Student }) {
  const { columns, monthMarkers, totals } = useMemo(() => {
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);
    const firstSunday = new Date(yearStart);
    firstSunday.setDate(yearStart.getDate() - yearStart.getDay());

    const yearEnd = new Date(today.getFullYear(), 11, 31);
    const lastSaturday = new Date(yearEnd);
    lastSaturday.setDate(yearEnd.getDate() + (6 - yearEnd.getDay()));

    const weeks = Math.round((lastSaturday.getTime() - firstSunday.getTime()) / (7 * DAY_MS)) + 1;

    const counts = new Map<string, number>();
    for (const e of events) {
      if (e.kind === "inactivity") continue;
      const d = parseEventDate(e.timestamp);
      if (!d) continue;
      const k = dateKey(d);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }

    const cols: { date: Date; count: number; level: number; inRange: boolean }[][] = [];
    const months: { col: number; label: string }[] = [];
    let lastMonth = -1;

    for (let w = 0; w < weeks; w++) {
      const col: { date: Date; count: number; level: number; inRange: boolean }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = new Date(firstSunday.getTime() + (w * 7 + d) * DAY_MS);
        const inRange = date >= yearStart && date <= yearEnd;
        const count = inRange ? counts.get(dateKey(date)) ?? 0 : 0;
        const level = count === 0 ? 0 : count >= 4 ? 4 : count >= 3 ? 3 : count >= 2 ? 2 : 1;
        col.push({ date, count, level, inRange });
      }
      const firstOfMonth = col.find((c) => c.inRange && c.date.getDate() <= 7);
      if (firstOfMonth && firstOfMonth.date.getMonth() !== lastMonth) {
        months.push({ col: w, label: MONTH_LABELS[firstOfMonth.date.getMonth()] });
        lastMonth = firstOfMonth.date.getMonth();
      }
      cols.push(col);
    }

    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    const activeDays = counts.size;
    return { columns: cols, monthMarkers: months, totals: { total, activeDays } };
  }, [events]);

  // Total pixel width of the grid area
  const gridWidth = columns.length * (CELL + GAP) - GAP;
  // Row height: 7 cells + 6 gaps
  const gridHeight = 7 * CELL + 6 * GAP;
  // Day-label column width
  const labelW = 28;

  return (
    <div className="rounded-2xl bg-white border border-[#e5e7ec] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-[#0c3455] font-medium">Activity graph</div>
          <div className="text-xs text-[#717182]">
            {totals.total} event{totals.total === 1 ? "" : "s"} across {totals.activeDays} day
            {totals.activeDays === 1 ? "" : "s"} · last 12 months
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[#717182]">
          <span>Less</span>
          {LEVELS.map((c, i) => (
            <span
              key={i}
              style={{ backgroundColor: c, width: CELL, height: CELL, borderRadius: 3, display: "inline-block" }}
            />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* Scrollable heatmap */}
      <div className="overflow-x-auto">
        <div style={{ display: "flex", gap: 6, minWidth: labelW + GAP + gridWidth }}>

          {/* Day labels column */}
          <div
            style={{
              width: labelW,
              flexShrink: 0,
              display: "flex",
              flexDirection: "column",
              gap: GAP,
              paddingTop: 16 + GAP, // offset for month label row
            }}
          >
            {["", "Mon", "", "Wed", "", "Fri", ""].map((label, i) => (
              <div
                key={i}
                style={{
                  height: CELL,
                  lineHeight: `${CELL}px`,
                  fontSize: 10,
                  color: "#717182",
                  textAlign: "right",
                  paddingRight: 4,
                }}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Grid + month labels */}
          <div style={{ flexShrink: 0 }}>
            {/* Month labels row */}
            <div style={{ position: "relative", height: 16, width: gridWidth, marginBottom: GAP }}>
              {monthMarkers.map((m) => (
                <span
                  key={`${m.col}-${m.label}`}
                  style={{
                    position: "absolute",
                    left: m.col * (CELL + GAP),
                    fontSize: 10,
                    color: "#717182",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.label}
                </span>
              ))}
            </div>

            {/* Cell grid — columns of 7 cells */}
            <div style={{ display: "flex", gap: GAP, height: gridHeight }}>
              {columns.map((col, ci) => (
                <div key={ci} style={{ display: "flex", flexDirection: "column", gap: GAP }}>
                  {col.map((cell, di) => (
                    <div
                      key={di}
                      title={
                        cell.inRange
                          ? `${cell.date.toDateString()} · ${cell.count} event${cell.count === 1 ? "" : "s"}`
                          : ""
                      }
                      style={{
                        width: CELL,
                        height: CELL,
                        borderRadius: 3,
                        flexShrink: 0,
                        backgroundColor: !cell.inRange
                          ? "transparent"
                          : cell.level === 0
                          ? "#eef2f6"
                          : LEVELS[cell.level],
                        border: cell.inRange && cell.level === 0 ? "1px solid #e5e7ec" : "none",
                        boxSizing: "border-box",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
