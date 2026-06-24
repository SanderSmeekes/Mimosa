import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { timetableData, type Day, type Stage, type SlotEntry } from "@/data/timetable"

/* ─────────────────────────────────────────────
   Layout constants
───────────────────────────────────────────── */
const ALL_STAGES: Stage[] = ["LUX", "UNDA", "AURA", "MENTIS"]

const DAY_LABELS: Record<Day, string> = {
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
}

const STAGE_COLORS: Record<Stage, { bg: string; text: string; header: string }> = {
  LUX:    { bg: "#1a2e4a", text: "#fff", header: "#1a2e4a" },
  UNDA:   { bg: "#1c3d6e", text: "#fff", header: "#1c3d6e" },
  AURA:   { bg: "#3a1760", text: "#fff", header: "#3a1760" },
  MENTIS: { bg: "#0f4a2e", text: "#fff", header: "#0f4a2e" },
}

/* Grid dimensions */
const PX_PER_HOUR = 88     // px height per hour
const STAGE_COL_W = 148    // px width per stage column (mobile friendly)
const TIME_GUTTER_W = 52   // px for the left time label strip
const HEADER_H = 44        // px for the sticky stage-name header

/* ─────────────────────────────────────────────
   Time helpers — "festival hours": 00–09 → 24–33
───────────────────────────────────────────── */
const MIDNIGHT_THRESHOLD = 10 // hours below this are "next day"

function toFestivalHour(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  const hour = h < MIDNIGHT_THRESHOLD ? h + 24 : h
  return hour + m / 60
}

function topPx(time: string, startHour: number): number {
  return (toFestivalHour(time) - startHour) * PX_PER_HOUR
}

function heightPx(start: string, end: string): number {
  let s = toFestivalHour(start)
  let e = toFestivalHour(end)
  if (e <= s) e += 24
  return (e - s) * PX_PER_HOUR
}

/* Compute earliest start and latest end for a day */
function dayBounds(day: Day): { startHour: number; endHour: number } {
  const schedule = timetableData.schedule[day]
  let min = 99, max = 0
  for (const stage of ALL_STAGES) {
    for (const slot of schedule[stage] ?? []) {
      const s = toFestivalHour(slot.start_time)
      const e = toFestivalHour(slot.end_time)
      if (s < min) min = s
      if (e > max) max = e
    }
  }
  // floor start to hour, ceil end to hour, add small padding
  return {
    startHour: min === 99 ? 10 : Math.floor(min),
    endHour:   max === 0  ? 22 : Math.ceil(max),
  }
}

/* ─────────────────────────────────────────────
   Event card — absolutely positioned in column
───────────────────────────────────────────── */
function EventCard({
  slot,
  stage,
  startHour,
}: {
  slot: SlotEntry
  stage: Stage
  startHour: number
}) {
  const top = topPx(slot.start_time, startHour)
  const height = heightPx(slot.start_time, slot.end_time)
  const { bg, text } = STAGE_COLORS[stage]
  const compact = height < 56

  return (
    <div
      style={{
        position: "absolute",
        top: top + 2,
        left: 4,
        right: 4,
        height: height - 4,
        backgroundColor: bg,
        color: text,
        borderRadius: 8,
        padding: compact ? "5px 8px" : "8px 10px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: compact ? "center" : "space-between",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        cursor: "default",
        userSelect: "none",
      }}
    >
      <span
        style={{
          fontSize: compact ? 11 : 12,
          fontWeight: 700,
          lineHeight: 1.25,
          letterSpacing: "0.03em",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: compact ? "nowrap" : "normal",
          display: "-webkit-box",
          WebkitLineClamp: compact ? 1 : 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {slot.artist}
      </span>
      {!compact && (
        <span style={{ fontSize: 10, opacity: 0.7, marginTop: 4, flexShrink: 0 }}>
          {slot.start_time}–{slot.end_time}
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Timetable grid for one day
───────────────────────────────────────────── */
function TimetableGrid({ day }: { day: Day }) {
  const schedule = timetableData.schedule[day]
  const { startHour, endHour } = dayBounds(day)
  const totalHours = endHour - startHour
  const totalH = totalHours * PX_PER_HOUR
  const hours = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i)

  const border = "1px solid hsl(var(--border))"
  const bg = "hsl(var(--background))"
  const mutedColor = "hsl(var(--muted-foreground))"

  return (
    /* outer scroll container — both axes */
    <div
      style={{
        flex: 1,
        overflow: "auto",
        WebkitOverflowScrolling: "touch" as never,
        overscrollBehavior: "contain",
      }}
    >
      {/* inner sizing wrapper */}
      <div
        style={{
          minWidth: TIME_GUTTER_W + ALL_STAGES.length * STAGE_COL_W,
          position: "relative",
        }}
      >
        {/* ── Sticky stage-name header row ── */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 30,
            display: "flex",
            height: HEADER_H,
            backgroundColor: bg,
            borderBottom: border,
          }}
        >
          {/* Corner cell */}
          <div
            style={{
              width: TIME_GUTTER_W,
              flexShrink: 0,
              position: "sticky",
              left: 0,
              zIndex: 40,
              backgroundColor: bg,
              borderRight: border,
            }}
          />
          {/* Stage name cells */}
          {ALL_STAGES.map((stage) => (
            <div
              key={stage}
              style={{
                width: STAGE_COL_W,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: STAGE_COLORS[stage].header,
                borderRight: border,
              }}
            >
              {stage}
            </div>
          ))}
        </div>

        {/* ── Scrollable body: time gutter + stage columns ── */}
        <div style={{ display: "flex", position: "relative" }}>
          {/* Time gutter — sticky left */}
          <div
            style={{
              width: TIME_GUTTER_W,
              flexShrink: 0,
              position: "sticky",
              left: 0,
              zIndex: 20,
              backgroundColor: bg,
              borderRight: border,
              height: totalH,
            }}
          >
            {hours.map((h) => (
              <div
                key={h}
                style={{
                  position: "absolute",
                  top: (h - startHour) * PX_PER_HOUR - 7,
                  left: 0,
                  right: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingRight: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: mutedColor,
                    fontFamily: "ui-monospace, monospace",
                    lineHeight: 1,
                  }}
                >
                  {String(h % 24).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Stage columns */}
          {ALL_STAGES.map((stage) => {
            const slots = schedule[stage] ?? []
            return (
              <div
                key={stage}
                style={{
                  width: STAGE_COL_W,
                  flexShrink: 0,
                  height: totalH,
                  position: "relative",
                  borderRight: border,
                }}
              >
                {/* Hour grid lines */}
                {hours.map((h) => (
                  <div
                    key={h}
                    style={{
                      position: "absolute",
                      top: (h - startHour) * PX_PER_HOUR,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: "hsl(var(--border))",
                      opacity: h % 2 === 0 ? 0.7 : 0.3,
                    }}
                  />
                ))}
                {/* Half-hour sub-lines */}
                {hours.slice(0, -1).map((h) => (
                  <div
                    key={`${h}-half`}
                    style={{
                      position: "absolute",
                      top: (h - startHour) * PX_PER_HOUR + PX_PER_HOUR / 2,
                      left: 0,
                      right: 0,
                      height: 1,
                      backgroundColor: "hsl(var(--border))",
                      opacity: 0.15,
                    }}
                  />
                ))}
                {/* Event cards */}
                {slots.map((slot, i) => (
                  <EventCard key={i} slot={slot} stage={stage} startHour={startHour} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Root app
───────────────────────────────────────────── */
export default function App() {
  const [activeDay, setActiveDay] = useState<Day>("Thursday")

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "hsl(var(--background))",
        overflow: "hidden",
      }}
    >
      <Tabs
        value={activeDay}
        onValueChange={(v) => setActiveDay(v as Day)}
        style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
      >
        {/* Day selector bar */}
        <div
          style={{
            flexShrink: 0,
            borderBottom: "1px solid hsl(var(--border))",
            display: "flex",
            alignItems: "center",
            padding: "0 4px",
          }}
        >
          <TabsList
            style={{
              background: "none",
              height: 48,
              gap: 4,
              padding: 0,
            }}
          >
            {timetableData.days.map((day) => (
              <TabsTrigger
                key={day}
                value={day}
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  height: 40,
                  padding: "0 16px",
                  borderRadius: 8,
                  ...(activeDay === day
                    ? {
                        backgroundColor: "hsl(var(--foreground))",
                        color: "hsl(var(--background))",
                      }
                    : {
                        backgroundColor: "transparent",
                        color: "hsl(var(--muted-foreground))",
                      }),
                }}
              >
                {DAY_LABELS[day]}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        {/* Grid per day */}
        {timetableData.days.map((day) => (
          <TabsContent
            key={day}
            value={day}
            style={{
              flex: 1,
              overflow: "hidden",
              margin: 0,
              display: activeDay === day ? "flex" : "none",
              flexDirection: "column",
            }}
          >
            <TimetableGrid day={day} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
