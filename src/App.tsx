import { useState, useEffect } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { timetableData, type Day, type Stage, type SlotEntry } from "@/data/timetable"
import { Heart } from "lucide-react"

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

const STAGE_COLORS: Record<Stage, { bg: string; text: string }> = {
  LUX:    { bg: "#4a4943", text: "#d2d2d0" },
  UNDA:   { bg: "#393930", text: "#d2d2d0" },
  AURA:   { bg: "#2e2d26", text: "#d2d2d0" },
  MENTIS: { bg: "#3d3c34", text: "#d2d2d0" },
}

const STAGE_ACCENT: Record<Stage, string> = {
  LUX:    "#C0392B",
  UNDA:   "#D9A227",
  AURA:   "#7A8B3C",
  MENTIS: "#4A9BC4",
}

const PX_PER_HOUR    = 88
const STAGE_COL_W    = 148
const TIME_GUTTER_W  = 52
const HEADER_H       = 44
/* ─────────────────────────────────────────────
   Time helpers — grid runs 10:00 → 10:00 (+1 day)
   Hours 00–09 are treated as 24–33 (next day).
───────────────────────────────────────────── */
const DAY_START = 10   // grid starts at 10:00
const DAY_END   = 34   // grid ends at 10:00 next day (34 = 24 + 10)

function toFestivalHour(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  return (h < DAY_START ? h + 24 : h) + m / 60
}

function topPx(time: string): number {
  return (toFestivalHour(time) - DAY_START) * PX_PER_HOUR
}

function heightPx(start: string, end: string): number {
  let s = toFestivalHour(start)
  let e = toFestivalHour(end)
  if (e <= s) e += 24
  return (e - s) * PX_PER_HOUR
}

function dayBounds(_day: Day): { startHour: number; endHour: number } {
  return { startHour: DAY_START, endHour: DAY_END }
}

function slotKey(day: Day, stage: Stage, slot: SlotEntry): string {
  return `${day}__${stage}__${slot.artist}__${slot.start_time}`
}

/* ─────────────────────────────────────────────
   Event card
───────────────────────────────────────────── */
function EventCard({
  slot,
  stage,
  isFav,
  dimmed,
  onToggleFav,
}: {
  slot: SlotEntry
  stage: Stage
  isFav: boolean
  dimmed: boolean
  onToggleFav: () => void
}) {
  const top    = topPx(slot.start_time)
  const height = heightPx(slot.start_time, slot.end_time)
  const { bg, text } = STAGE_COLORS[stage]
  const accent = STAGE_ACCENT[stage]
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
        borderLeft: `3px solid ${accent}`,
        padding: compact ? "5px 8px" : "8px 10px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: compact ? "center" : "space-between",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        cursor: "default",
        userSelect: "none",
        opacity: dimmed ? 0.4 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      {/* Artist name row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
        <span
          style={{
            fontSize: compact ? 11 : 12,
            fontWeight: 700,
            lineHeight: 1.25,
            letterSpacing: "0.03em",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: compact ? "nowrap" : "normal",
            flex: 1,
          }}
        >
          {slot.artist}
        </span>

        {/* Favourite toggle */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleFav() }}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            color: isFav ? "#ff6b6b" : "rgba(255,255,255,0.45)",
            transition: "color 0.15s ease",
            lineHeight: 1,
          }}
          aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
        >
          <Heart
            size={compact ? 10 : 12}
            fill={isFav ? "#ff6b6b" : "none"}
            strokeWidth={2}
          />
        </button>
      </div>

      {!compact && (
        <span style={{ fontSize: 10, opacity: 0.65, flexShrink: 0 }}>
          {slot.start_time}–{slot.end_time}
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────
   Timetable grid for one day
───────────────────────────────────────────── */
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  return now
}

function TimetableGrid({
  day,
  favourites,
  showFavs,
  onToggleFav,
}: {
  day: Day
  favourites: Set<string>
  showFavs: boolean
  onToggleFav: (key: string) => void
}) {
  const schedule = timetableData.schedule[day]
  const { startHour, endHour } = dayBounds(day)
  const totalHours = endHour - startHour          // 24
  const totalH     = totalHours * PX_PER_HOUR
  // hours 10..33 → display as 10..23, 00..09
  const hours      = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i)

  const border     = "1px solid hsl(var(--border))"
  const bg         = "hsl(var(--background))"
  const mutedColor = "hsl(var(--muted-foreground))"

  // Current time indicator
  const now = useNow()
  const nowFestivalHour = toFestivalHour(
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  )
  const nowTop = (nowFestivalHour - startHour) * PX_PER_HOUR
  const showNowLine = nowFestivalHour >= startHour && nowFestivalHour <= endHour

  return (
    <div
      style={{
        flex: 1,
        overflow: "auto",
        WebkitOverflowScrolling: "touch" as never,
        overscrollBehavior: "contain",
      }}
    >
      <div style={{ minWidth: TIME_GUTTER_W + ALL_STAGES.length * STAGE_COL_W, position: "relative" }}>

        {/* Sticky stage-name header */}
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
          {ALL_STAGES.map((stage) => (
            <div
              key={stage}
              style={{
                width: STAGE_COL_W,
                flexShrink: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: "0.12em",
                color: "hsl(var(--muted-foreground))",
                borderRight: border,
              }}
            >
              <span>{stage}</span>
              <div
                style={{
                  width: 8,
                  height: 2,
                  borderRadius: 9999,
                  marginTop: 4,
                  backgroundColor: STAGE_ACCENT[stage],
                }}
              />
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ display: "flex", position: "relative" }}>

          {/* Current time line */}
          {showNowLine && (
            <div
              style={{
                position: "absolute",
                top: nowTop,
                left: TIME_GUTTER_W,
                right: 0,
                height: 0,
                borderTop: "1px dashed #d2d2d0",
                opacity: 0.6,
                zIndex: 15,
                pointerEvents: "none",
              }}
            />
          )}

          {/* Time gutter */}
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
                    lineHeight: 1,
                  }}
                >
                  {String(h % 24).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Stage columns */}
          {ALL_STAGES.map((stage) => (
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
              {/* Hour lines */}
              {hours.map((h) => (
                <div
                  key={h}
                  style={{
                    position: "absolute",
                    top: (h - startHour) * PX_PER_HOUR,
                    left: 0, right: 0, height: 1,
                    backgroundColor: "hsl(var(--border))",
                    opacity: h % 2 === 0 ? 0.7 : 0.3,
                  }}
                />
              ))}
              {hours.slice(0, -1).map((h) => (
                <div
                  key={`${h}h`}
                  style={{
                    position: "absolute",
                    top: (h - startHour) * PX_PER_HOUR + PX_PER_HOUR / 2,
                    left: 0, right: 0, height: 1,
                    backgroundColor: "hsl(var(--border))",
                    opacity: 0.15,
                  }}
                />
              ))}

              {/* Events */}
              {(schedule[stage] ?? []).map((slot, i) => {
                const key = slotKey(day, stage, slot)
                const isFav  = favourites.has(key)
                const dimmed = showFavs && !isFav
                return (
                  <EventCard
                    key={i}
                    slot={slot}
                    stage={stage}
                    isFav={isFav}
                    dimmed={dimmed}
                    onToggleFav={() => onToggleFav(key)}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Root app
───────────────────────────────────────────── */
const LS_KEY = "memoris-favourites"

export default function App() {
  const [activeDay, setActiveDay]   = useState<Day>("Thursday")
  const [favourites, setFavourites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const [showFavs, setShowFavs] = useState(false)

  function toggleFav(key: string) {
    setFavourites((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])) } catch { /* quota */ }
      return next
    })
  }

  const hasFavs = favourites.size > 0

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "hsl(var(--background))",
        overflow: "hidden",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      <Tabs
        value={activeDay}
        onValueChange={(v) => setActiveDay(v as Day)}
        style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
      >
        {/* Top bar: full-width tabs + favourites toggle */}
        <div
          style={{
            flexShrink: 0,
            borderBottom: "1px solid hsl(var(--border))",
            display: "flex",
            alignItems: "stretch",
            paddingTop: "env(safe-area-inset-top)",
            backgroundColor: "hsl(var(--background))",
          }}
        >
          {/* Tabs fill all available space — line variant gives the underline indicator */}
          <TabsList
            variant="line"
            className="flex-1 w-auto h-12 rounded-none p-0 gap-0"
          >
            {timetableData.days.map((day) => (
              <TabsTrigger
                key={day}
                value={day}
                className="flex-1 h-full rounded-none text-[13px] font-bold tracking-[0.08em] after:bottom-0"
              >
                {DAY_LABELS[day]}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Favourites toggle button */}
          <button
            onClick={() => setShowFavs((s) => !s)}
            aria-label={showFavs ? "Show all" : "Show favourites"}
            style={{
              flexShrink: 0,
              width: 48,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
              borderLeft: "1px solid hsl(var(--border))",
              cursor: "pointer",
              color: showFavs ? "#ff6b6b" : hasFavs ? "#ff6b6b" : "hsl(var(--muted-foreground))",
              transition: "color 0.15s ease",
            }}
          >
            <Heart
              size={18}
              fill={showFavs ? "#ff6b6b" : hasFavs ? "rgba(255,107,107,0.25)" : "none"}
              strokeWidth={2}
            />
          </button>
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
            <TimetableGrid
              day={day}
              favourites={favourites}
              showFavs={showFavs}
              onToggleFav={toggleFav}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
