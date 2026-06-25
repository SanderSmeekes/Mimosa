import React, { useState, useEffect, useRef } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer"
import { Badge } from "@/components/ui/badge"
import { timetableData, type Day, type Stage, type SlotEntry, type BannerEntry } from "@/data/timetable"
import { artistsData } from "@/data/artists"
import { Heart, Settings, ExternalLink, X, ChevronDown, ChevronUp, User } from "lucide-react"
import { lookupUser, saveFavourites, countSaves, getSavers, getUserFavourites, type UserRecord } from "./lib/supabase"
import { Onboarding } from "./components/Onboarding"

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
  LUX:    { bg: "#1d1c14", text: "#d2d2d0" },
  UNDA:   { bg: "#1d1c14", text: "#d2d2d0" },
  AURA:   { bg: "#1d1c14", text: "#d2d2d0" },
  MENTIS: { bg: "#1d1c14", text: "#d2d2d0" },
}

const STAGE_ACCENT: Record<Stage, string> = {
  LUX:    "#C0392B",
  UNDA:   "#D9A227",
  AURA:   "#7A8B3C",
  MENTIS: "#4A9BC4",
}

const PX_PER_HOUR    = 88
const STAGE_COL_W    = 148  // minimum column width; columns expand to fill screen
const TIME_GUTTER_W  = 52
const HEADER_H       = 44
/* ─────────────────────────────────────────────
   Time helpers — grid runs 10:00 → 10:00 (+1 day)
   Hours 00–09 are treated as 24–33 (next day).
───────────────────────────────────────────── */
const DAY_START = 9    // grid starts at 09:00
const DAY_END   = 31   // grid ends at 07:00 next day (24 + 7 = 31)

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
  onOpenArtist,
}: {
  slot: SlotEntry
  stage: Stage
  isFav: boolean
  dimmed: boolean
  onToggleFav: () => void
  onOpenArtist: (id: string) => void
}) {
  const top    = topPx(slot.start_time)
  const height = heightPx(slot.start_time, slot.end_time)
  const { bg, text } = STAGE_COLORS[stage]
  const accent = STAGE_ACCENT[stage]
  const compact = height < 56

  const iconSize = compact ? 10 : 12

  return (
    <div
      onClick={() => onOpenArtist(slot.artist_id)}
      style={{
        position: "absolute",
        top: top + 2,
        left: 4,
        right: 4,
        height: height - 4,
        backgroundColor: bg,
        cursor: "pointer",
        color: text,
        borderRadius: 8,
        borderLeft: `3px solid ${accent}`,
        padding: compact ? "5px 8px" : "8px 10px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: compact ? "center" : "space-between",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
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
            justifyContent: "center",
            minWidth: 44,
            minHeight: 44,
            margin: "-14px -10px -14px 0",
            color: isFav ? "#ff6b6b" : "rgba(255,255,255,0.45)",
            transition: "color 0.15s ease",
          }}
          aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
        >
          <Heart size={iconSize} fill={isFav ? "#ff6b6b" : "none"} strokeWidth={2} />
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
   Axis-locking scroll: detects dominant direction
   on first move and suppresses the other axis for
   the entire gesture + momentum phase.
───────────────────────────────────────────── */
function useAxisLock(ref: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el) return

    let startX = 0, startY = 0
    let axis: "x" | "y" | null = null
    let lockedTop = 0, lockedLeft = 0

    const onStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX
      startY = e.touches[0].clientY
      axis = null
    }

    const onMove = (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - startX)
      const dy = Math.abs(e.touches[0].clientY - startY)
      if (!axis && (dx > 6 || dy > 6)) {
        axis = dx > dy ? "x" : "y"
        lockedTop  = el.scrollTop
        lockedLeft = el.scrollLeft
      }
      if (axis === "x") el.scrollTop  = lockedTop
      if (axis === "y") el.scrollLeft = lockedLeft
    }

    // Keep lock alive during momentum too (scroll fires after touchend)
    const onScroll = () => {
      if (axis === "x") el.scrollTop  = lockedTop
      if (axis === "y") el.scrollLeft = lockedLeft
    }

    // Release lock once momentum dies (next gesture resets it anyway)
    const onEnd = () => { setTimeout(() => { axis = null }, 400) }

    el.addEventListener("touchstart", onStart,  { passive: true })
    el.addEventListener("touchmove",  onMove,   { passive: true })
    el.addEventListener("touchend",   onEnd,    { passive: true })
    el.addEventListener("scroll",     onScroll, { passive: true })
    return () => {
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchmove",  onMove)
      el.removeEventListener("touchend",   onEnd)
      el.removeEventListener("scroll",     onScroll)
    }
  }, [ref])
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

/* ─────────────────────────────────────────────
   List view — chronological, grouped into
   On now / Later / Earlier today sections.
───────────────────────────────────────────── */
type ListItem = SlotEntry & { stage: Stage }


function ListRow({
  item,
  day,
  isFav,
  dimmed,
  onToggleFav,
  onOpenArtist,
  clashWith,
  status,
}: {
  item: ListItem
  day: Day
  isFav: boolean
  dimmed: boolean
  onToggleFav: () => void
  onOpenArtist: (id: string) => void
  clashWith: string | null
  status: "now" | "later" | "earlier"
}) {
  const accent = STAGE_ACCENT[item.stage]
  const border = "1px solid hsl(var(--border))"
  const key    = slotKey(day, item.stage, item)
  void key

  return (
    <div
      onClick={() => onOpenArtist(item.artist_id)}
      style={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: border,
        minHeight: 64,
        opacity: dimmed ? 0.35 : status === "earlier" ? 0.38 : 1,
        transition: "opacity 0.2s ease",
        cursor: "pointer",
        backgroundColor: status === "now" ? "rgba(255,255,255,0.03)" : "transparent",
      }}
    >
      {/* Stage accent bar */}
      <div style={{
        width: 3,
        flexShrink: 0,
        backgroundColor: accent,
      }} />

      {/* Time column */}
      <div style={{
        width: 46,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        justifyContent: "center",
        paddingRight: 10,
        paddingLeft: 6,
        gap: 2,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: status === "now" ? "#d2d2d0" : "hsl(var(--muted-foreground))", lineHeight: 1 }}>
          {item.start_time}
        </span>
        {status === "now" && (
          <span style={{ fontSize: 9, color: accent, letterSpacing: "0.04em", lineHeight: 1 }}>NOW</span>
        )}
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "10px 0 10px 2px", gap: 4, overflow: "hidden" }}>
        {/* Artist name + live tag */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.03em",
            color: "hsl(var(--foreground))",
            lineHeight: 1.2,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
            {item.artist}
          </span>
          {item.live && (
            <span style={{
              fontSize: 8,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "hsl(var(--muted-foreground))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 3,
              padding: "1px 4px",
              flexShrink: 0,
              opacity: 0.6,
            }}>live</span>
          )}
        </div>

        {/* Secondary line */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", letterSpacing: "0.06em" }}>
            {item.stage}
          </span>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>·</span>
          {status === "now" && (
            <span style={{ fontSize: 10, color: accent }}>ends {item.end_time}</span>
          )}
          {status === "later" && (
            <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))" }}>{item.end_time}</span>
          )}
          {status === "earlier" && (
            <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>ended {item.end_time}</span>
          )}
          {/* Clash indicator — only on fav rows */}
          {isFav && clashWith && (
            <span style={{ fontSize: 10, color: "#e8a838", letterSpacing: "0.03em" }}>
              ↔ {clashWith}
            </span>
          )}
        </div>
      </div>

      {/* Heart */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleFav() }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 44,
          minHeight: 64,
          color: isFav ? "#ff6b6b" : "rgba(255,255,255,0.25)",
          transition: "color 0.15s ease",
        }}
        aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
      >
        <Heart size={14} fill={isFav ? "#ff6b6b" : "none"} strokeWidth={2} />
      </button>
    </div>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{
      padding: "8px 16px 6px",
      fontSize: 10,
      fontWeight: 800,
      letterSpacing: "0.12em",
      color: "hsl(var(--muted-foreground))",
      backgroundColor: "hsl(var(--background))",
      borderBottom: "1px solid hsl(var(--border))",
      position: "sticky",
      top: 0,
      zIndex: 10,
    }}>
      {label}
    </div>
  )
}

function ListView({
  day,
  favourites,
  showFavs,
  onToggleFav,
  onOpenArtist,
}: {
  day: Day
  favourites: Set<string>
  showFavs: boolean
  onToggleFav: (key: string) => void
  onOpenArtist: (id: string) => void
}) {
  const now = useNow()
  const [earlierExpanded, setEarlierExpanded] = useState(false)
  const schedule = timetableData.schedule[day]

  const nowFh = toFestivalHour(
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  )

  const allItems: ListItem[] = ALL_STAGES.flatMap((stage) =>
    (schedule[stage] ?? []).map((slot): ListItem => ({ ...slot, stage }))
  ).sort((a, b) => toFestivalHour(a.start_time) - toFestivalHour(b.start_time))

  // Detect if now falls within this day's festival window AND the selected tab is today
  const dayStart = DAY_START
  const dayEnd   = DAY_END
  const todayName = now.toLocaleDateString("en-US", { weekday: "long" }) // "Thursday" etc.
  const nowInDay = day === todayName && nowFh >= dayStart && nowFh <= dayEnd

  // Bucket items
  const onNow:   ListItem[] = []
  const later:   ListItem[] = []
  const earlier: ListItem[] = []

  for (const item of allItems) {
    const s = toFestivalHour(item.start_time)
    let   e = toFestivalHour(item.end_time)
    if (e <= s) e += 24

    if (!nowInDay) {
      later.push(item)
    } else if (nowFh >= s && nowFh < e) {
      onNow.push(item)
    } else if (s > nowFh) {
      later.push(item)
    } else {
      earlier.push(item)
    }
  }

  // Clash detection among favourited items (all items regardless of bucket)
  function clashName(item: ListItem): string | null {
    const key = slotKey(day, item.stage, item)
    if (!favourites.has(key)) return null
    const s1 = toFestivalHour(item.start_time)
    let   e1 = toFestivalHour(item.end_time)
    if (e1 <= s1) e1 += 24
    for (const other of allItems) {
      if (other.artist_id === item.artist_id && other.stage === item.stage) continue
      const otherKey = slotKey(day, other.stage, other)
      if (!favourites.has(otherKey)) continue
      const s2 = toFestivalHour(other.start_time)
      let   e2 = toFestivalHour(other.end_time)
      if (e2 <= s2) e2 += 24
      if (s1 < e2 && s2 < e1) return other.artist
    }
    return null
  }

  function renderRow(item: ListItem, status: "now" | "later" | "earlier") {
    const key    = slotKey(day, item.stage, item)
    const isFav  = favourites.has(key)
    const dimmed = showFavs && !isFav
    return (
      <ListRow
        key={`${item.stage}-${item.start_time}-${item.artist_id}`}
        item={item}
        day={day}
        isFav={isFav}
        dimmed={dimmed}
        onToggleFav={() => onToggleFav(key)}
        onOpenArtist={onOpenArtist}
        clashWith={clashName(item)}
        status={status}
      />
    )
  }

  const border = "1px solid hsl(var(--border))"

  return (
    <div style={{ flex: 1, overflow: "auto", overscrollBehavior: "none", WebkitOverflowScrolling: "touch" as never, paddingBottom: "env(safe-area-inset-bottom)" }}>

      {/* ON NOW */}
      {nowInDay && onNow.length > 0 && (
        <>
          <SectionHeader label="ON NOW" />
          {onNow.map(item => renderRow(item, "now"))}
        </>
      )}

      {/* LATER */}
      {later.length > 0 && (
        <>
          {nowInDay && <SectionHeader label="LATER" />}
          {later.map(item => renderRow(item, "later"))}
        </>
      )}

      {/* EARLIER TODAY */}
      {nowInDay && earlier.length > 0 && (
        <>
          <button
            onClick={() => setEarlierExpanded(v => !v)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "none",
              border: "none",
              borderTop: border,
              borderBottom: earlierExpanded ? border : "none",
              cursor: "pointer",
              color: "hsl(var(--muted-foreground))",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.1em",
              fontFamily: "inherit",
            }}
          >
            <span>EARLIER TODAY · {earlier.length} ended</span>
            {earlierExpanded
              ? <ChevronUp size={14} strokeWidth={2} />
              : <ChevronDown size={14} strokeWidth={2} />
            }
          </button>
          {earlierExpanded && earlier.map(item => renderRow(item, "earlier"))}
        </>
      )}
    </div>
  )
}

function TimetableGrid({
  day,
  favourites,
  showFavs,
  onToggleFav,
  onOpenArtist,
  listView,
}: {
  day: Day
  favourites: Set<string>
  showFavs: boolean
  onToggleFav: (key: string) => void
  onOpenArtist: (id: string) => void
  listView: boolean
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useAxisLock(scrollRef)

  const schedule = timetableData.schedule[day]
  const { startHour, endHour } = dayBounds(day)
  const totalHours = endHour - startHour          // 24
  const totalH     = totalHours * PX_PER_HOUR
  // hours 10..33 → display as 10..23, 00..09
  const hours      = Array.from({ length: totalHours + 1 }, (_, i) => startHour + i)

  const border     = "1px solid hsl(var(--border))"
  const bg         = "hsl(var(--background))"
  const mutedColor = "hsl(var(--muted-foreground))"
  const banners: BannerEntry[] = timetableData.banners[day] ?? []

  // Current time indicator
  const now = useNow()
  const nowFestivalHour = toFestivalHour(
    `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
  )
  const nowTop = (nowFestivalHour - startHour) * PX_PER_HOUR
  const showNowLine = nowFestivalHour >= startHour && nowFestivalHour <= endHour

  // Scroll to current time on mount, centred in the viewport
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !showNowLine) return
    const offset = nowTop - el.clientHeight / 2 + HEADER_H
    el.scrollTop = Math.max(0, offset)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (listView) {
    return (
      <ListView
        day={day}
        favourites={favourites}
        showFavs={showFavs}
        onToggleFav={onToggleFav}
        onOpenArtist={onOpenArtist}
      />
    )
  }

  return (
    <div
      ref={scrollRef}
      style={{
        flex: 1,
        overflow: "auto",
        WebkitOverflowScrolling: "touch" as never,
        overscrollBehavior: "none",
        paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
      }}
    >
      <div style={{ minWidth: TIME_GUTTER_W + ALL_STAGES.length * STAGE_COL_W, width: "100%", position: "relative" }}>

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
            boxShadow: "0 4px 12px 0 rgba(0,0,0,0.45)",
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
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/mooney.png"
              alt=""
              className="animate-[spin_20s_linear_infinite]"
              style={{ width: 30, height: 30, objectFit: "contain" }}
            />
          </div>
          {ALL_STAGES.map((stage) => (
            <div
              key={stage}
              style={{
                flex: 1,
                minWidth: STAGE_COL_W,
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

          {/* Full-width banner blocks (e.g. "Arriving at the camping") */}
          {banners.map((b, i) => {
            const bTop    = topPx(b.start_time)
            const bHeight = heightPx(b.start_time, b.end_time)
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  top: bTop,
                  left: TIME_GUTTER_W,
                  right: 0,
                  height: bHeight,
                  backgroundColor: "rgba(212,162,75,0.07)",
                  borderTop: "1px solid rgba(212,162,75,0.35)",
                  borderBottom: "1px solid rgba(212,162,75,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 5,
                  pointerEvents: "none",
                }}
              >
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.1em",
                  color: "rgba(212,162,75,0.75)",
                  textTransform: "uppercase",
                }}>
                  {b.label}
                </span>
              </div>
            )
          })}

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
                flex: 1,
                minWidth: STAGE_COL_W,
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
                    onOpenArtist={onOpenArtist}
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
   Marquee banner
───────────────────────────────────────────── */
const MARQUEE_TEXT = "Smile, dance and make Memoiries. Raargh!"
const MARQUEE_SEPARATOR = "   "
const MARQUEE_CHUNK = Array(3).fill(MARQUEE_TEXT).join(MARQUEE_SEPARATOR)

const marqueeImgStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  objectFit: "contain",
  verticalAlign: "middle",
  display: "inline-block",
  marginBottom: 1,
}

function MarqueeSegment() {
  return (
    <>
      <span
        style={{
          fontFamily: "'Courier Prime', 'Courier New', monospace",
          fontSize: "0.875rem",
          letterSpacing: "0.05em",
          color: "#a5a4a1",
          verticalAlign: "middle",
        }}
      >
        {MARQUEE_CHUNK}
      </span>
      <img src="/siley.png" alt="" style={{ ...marqueeImgStyle, margin: "0 10px" }} />
    </>
  )
}

function MarqueeBanner() {
  return (
    <div
      className="group"
      style={{
        flexShrink: 0,
        borderTop: "1px solid #1a1714",
        borderBottom: "1px solid hsl(var(--border))",
        paddingTop: "10px",
        paddingBottom: "10px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        backgroundColor: "rgba(10,10,10,0.95)",
      }}
    >
      <div
        style={{
          display: "inline-block",
          animation: "marquee 22s linear infinite",
        }}
        className="group-hover:[animation-play-state:paused]"
      >
        <MarqueeSegment />
        <MarqueeSegment />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────
   Root app
───────────────────────────────────────────── */
/* ─────────────────────────────────────────────
   Artist detail drawer
───────────────────────────────────────────── */
function parseSlotKey(key: string): { day: string; stage: string; artist: string; time: string } | null {
  const parts = key.split("__")
  if (parts.length < 4) return null
  return { day: parts[0], stage: parts[1], artist: parts[2], time: parts[3] }
}

type DrawerPage =
  | { page: "main" }
  | { page: "savers"; loading: boolean; list: { name_key: string; display_name: string; favourites: string[] }[] }
  | { page: "user-picks"; displayName: string; nameKey: string; loading: boolean; favs: string[] }

function UserPicksList({ favs, loading, border }: { favs: string[]; loading: boolean; border: string }) {
  const parsed = favs.map(parseSlotKey).filter(Boolean) as { day: string; stage: string; artist: string; time: string }[]
  const DAY_ORDER = ["Thursday", "Friday", "Saturday", "Sunday"]
  const byDay = DAY_ORDER.map((day) => ({
    day,
    items: parsed.filter((p) => p.day === day).sort((a, b) => a.time.localeCompare(b.time)),
  })).filter((g) => g.items.length > 0)

  if (loading) return <div style={{ padding: "24px 0", fontSize: 12, color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>loading…</div>
  if (parsed.length === 0) return <div style={{ padding: "24px 0", fontSize: 12, color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>nothing saved yet</div>
  return (
    <>
      {byDay.map((group) => (
        <React.Fragment key={group.day}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "hsl(var(--muted-foreground))", opacity: 0.5, padding: "12px 0 4px", textTransform: "uppercase" }}>
            {group.day}
          </div>
          {group.items.map((p, i) => {
            const stageAccent = STAGE_ACCENT[p.stage as Stage] ?? "#d2d2d0"
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: border }}>
                <div style={{ width: 3, height: 34, borderRadius: 2, backgroundColor: stageAccent, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))", letterSpacing: "0.02em" }}>{p.artist}</div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 2, letterSpacing: "0.06em" }}>{p.stage} · {p.time}</div>
                </div>
              </div>
            )
          })}
        </React.Fragment>
      ))}
    </>
  )
}

function ArtistDrawer({
  artistId,
  slotKey,
  open,
  onClose,
  isFav,
  onToggleFav,
  myFavourites,
}: {
  artistId: string | null
  slotKey: string | null
  open: boolean
  onClose: () => void
  isFav: boolean
  onToggleFav: () => void
  myFavourites: Set<string>
}) {
  const artist = artistId ? artistsData[artistId] : null
  const accent = artist ? STAGE_ACCENT[artist.stage as Stage] : "#d2d2d0"
  const border = "1px solid hsl(var(--border))"
  const [saveCount, setSaveCount] = useState<number | null>(null)
  const [view, setView] = useState<DrawerPage>({ page: "main" })

  useEffect(() => {
    if (!open || !slotKey) { setSaveCount(null); return }
    setSaveCount(null)
    countSaves(slotKey).then(setSaveCount)
  }, [open, slotKey])

  useEffect(() => {
    if (!open) setView({ page: "main" })
  }, [open, artistId])

  function openSavers() {
    if (!slotKey) return
    setView({ page: "savers", loading: true, list: [] })
    getSavers(slotKey).then((list) => setView({ page: "savers", loading: false, list }))
  }

  function openUserPicks(nameKey: string, displayName: string) {
    setView({ page: "user-picks", displayName, nameKey, loading: true, favs: [] })
    getUserFavourites(nameKey).then((favs) =>
      setView({ page: "user-picks", displayName, nameKey, loading: false, favs })
    )
  }

  const iconBtn: React.CSSProperties = {
    background: "none", border: "none", cursor: "pointer",
    color: "hsl(var(--muted-foreground))", display: "flex",
    alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44,
  }

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DrawerContent style={{ height: "85dvh", display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 12px 0", flexShrink: 0 }}>
          {view.page === "main" ? (
            <DrawerClose asChild>
              <button style={iconBtn}><X size={20} strokeWidth={1.5} /></button>
            </DrawerClose>
          ) : (
            <button style={iconBtn} onClick={() => view.page === "user-picks" ? openSavers() : setView({ page: "main" })}>
              <ChevronDown size={20} strokeWidth={1.5} style={{ transform: "rotate(90deg)" }} />
            </button>
          )}

          {view.page === "main" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {saveCount !== null && saveCount > 0 && (
                <button onClick={openSavers} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                  <Badge variant="secondary" style={{ gap: 5, cursor: "pointer", fontFamily: "inherit" }}>
                    <Heart size={10} fill="#ff6b6b" stroke="none" />
                    {saveCount} {saveCount === 1 ? "person" : "people"} saved this
                  </Badge>
                </button>
              )}
              <button
                onClick={onToggleFav}
                style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, padding: "0 12px", color: isFav ? "#ff6b6b" : "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "inherit", letterSpacing: "0.06em" }}
              >
                <Heart size={16} fill={isFav ? "#ff6b6b" : "none"} strokeWidth={2} />
                {isFav ? "SAVED" : "SAVE"}
              </button>
            </div>
          )}

          {view.page === "savers" && (
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))" }}>WHO SAVED THIS</span>
          )}
          {view.page === "user-picks" && (
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
              {(view as { displayName: string }).displayName.toUpperCase()}
            </span>
          )}
          {view.page !== "main" && <div style={{ width: 44, flexShrink: 0 }} />}
        </div>

        {/* Main artist page */}
        {view.page === "main" && artist && (
          <div style={{ overflowY: "auto", padding: "12px 20px 40px", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: accent }} />
                <span style={{ fontSize: 11, letterSpacing: "0.1em", color: "hsl(var(--muted-foreground))" }}>
                  {artist.stage}{artist.country ? ` · ${artist.country}` : ""}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "0.04em", color: "hsl(var(--foreground))", lineHeight: 1.2 }}>{artist.name}</h2>
              {slotKey && (() => {
                const parsed = parseSlotKey(slotKey)
                if (!parsed) return null
                const daySlots = timetableData.schedule[parsed.day as Day]
                const stageSlots = daySlots?.[parsed.stage as Stage] ?? []
                const slot = stageSlots.find(s => s.start_time === parsed.time)
                return (
                  <div style={{ marginTop: 8, fontSize: 12, color: "hsl(var(--muted-foreground))", letterSpacing: "0.06em" }}>
                    {parsed.day} · {parsed.time}{slot ? `–${slot.end_time}` : ""}
                  </div>
                )
              })()}
            </div>
            {artist.bio ? (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "hsl(var(--muted-foreground))" }}>{artist.bio}</p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "hsl(var(--muted-foreground))", fontStyle: "italic", opacity: 0.5 }}>No bio available.</p>
            )}
            {(artist.links.soundcloud || artist.links.instagram || artist.links.ra) && (
              <div style={{ display: "flex", flexDirection: "column", borderTop: border, borderBottom: border }}>
                {([
                  { key: "soundcloud", label: "SOUNDCLOUD", href: artist.links.soundcloud },
                  { key: "instagram",  label: "INSTAGRAM",  href: artist.links.instagram  },
                  { key: "ra",         label: "RA",         href: artist.links.ra          },
                ] as const).filter(l => l.href).map((l) => (
                  <a key={l.key} href={l.href!} target="_blank" rel="noopener noreferrer"
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 0", borderBottom: border, color: "hsl(var(--foreground))", textDecoration: "none", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em" }}
                  >
                    {l.label}
                    <ExternalLink size={14} strokeWidth={1.5} style={{ color: "hsl(var(--muted-foreground))" }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Savers list */}
        {view.page === "savers" && (
          <div style={{ overflowY: "auto", padding: "4px 20px 40px", display: "flex", flexDirection: "column", flex: 1 }}>
            {view.loading ? (
              <div style={{ padding: "20px 0", fontSize: 12, color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>loading…</div>
            ) : view.list.length === 0 ? (
              <div style={{ padding: "20px 0", fontSize: 12, color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>no one yet</div>
            ) : view.list.map((u) => {
              const theirFavs = new Set(u.favourites)
              const shared = [...myFavourites].filter(k => theirFavs.has(k)).length
              const union = new Set([...myFavourites, ...theirFavs]).size
              const pct = union > 0 ? Math.round((shared / union) * 100) : 0
              return (
                <button
                  key={u.name_key}
                  onClick={() => openUserPicks(u.name_key, u.display_name)}
                  style={{ background: "none", border: "none", borderBottom: border, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 0", color: "hsl(var(--foreground))", fontFamily: "inherit", fontSize: 14, fontWeight: 700, letterSpacing: "0.04em", textAlign: "left", width: "100%" }}
                >
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.display_name}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {pct > 0 && (
                      <span style={{ fontSize: 11, fontWeight: 400, letterSpacing: "0.04em", color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>
                        {pct}% match
                      </span>
                    )}
                    <ChevronDown size={14} strokeWidth={1.5} style={{ transform: "rotate(-90deg)", color: "hsl(var(--muted-foreground))" }} />
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* User picks */}
        {view.page === "user-picks" && (
          <div style={{ overflowY: "auto", padding: "4px 20px 40px", display: "flex", flexDirection: "column", flex: 1 }}>
            <UserPicksList
              favs={(view as { favs: string[] }).favs}
              loading={(view as { loading: boolean }).loading}
              border={border}
            />
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}

function ArtistDrawerPortal({
  artistId,
  activeDay,
  favourites,
  onClose,
  onToggleFav,
}: {
  artistId: string | null
  activeDay: Day
  favourites: Set<string>
  onClose: () => void
  onToggleFav: (key: string) => void
}) {
  if (!artistId) return <ArtistDrawer artistId={null} slotKey={null} open={false} onClose={onClose} isFav={false} onToggleFav={() => {}} myFavourites={favourites} />

  const a = artistsData[artistId]
  const stage = a?.stage as Stage | undefined
  const daySchedule = timetableData.schedule[activeDay]
  const slot = stage ? (daySchedule[stage] ?? []).find(s => s.artist_id === artistId) : undefined
  const key = slot && stage ? slotKey(activeDay, stage, slot) : null
  const isFav = key ? favourites.has(key) : false

  return (
    <ArtistDrawer
      artistId={artistId}
      slotKey={key}
      open
      onClose={onClose}
      isFav={isFav}
      onToggleFav={() => key && onToggleFav(key)}
      myFavourites={favourites}
    />
  )
}

const LS_KEY = "memoris-favourites"
const ACCOUNT_KEY = "memosa-account"

export default function App() {
  const [userName, setUserName] = useState<UserRecord | null>(() => {
    try {
      const raw = localStorage.getItem(ACCOUNT_KEY)
      return raw ? (JSON.parse(raw) as UserRecord) : null
    } catch {
      return null
    }
  })
  const [favsLoading, setFavsLoading] = useState(false)
  const [activeDay, setActiveDay]   = useState<Day>("Thursday")
  const [favourites, setFavourites] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
    } catch {
      return new Set()
    }
  })
  const [showFavs, setShowFavs]         = useState(false)
  const [listView, setListView]         = useState(false)
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load favourites from Supabase when account is set
  useEffect(() => {
    if (!userName) return
    setFavsLoading(true)
    lookupUser(userName.name_key).then((record) => {
      if (record && record.favourites.length > 0) {
        const loaded = new Set(record.favourites)
        setFavourites(loaded)
        try { localStorage.setItem(LS_KEY, JSON.stringify([...loaded])) } catch { /* quota */ }
      }
      setFavsLoading(false)
    }).catch(() => setFavsLoading(false))
  }, [userName?.name_key])

  function scheduleSave(nameKey: string, favs: Set<string>) {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveFavourites(nameKey, [...favs]).catch(() => {})
    }, 800)
  }

  function toggleFav(key: string) {
    setFavourites((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      try { localStorage.setItem(LS_KEY, JSON.stringify([...next])) } catch { /* quota */ }
      if (userName) scheduleSave(userName.name_key, next)
      return next
    })
  }

  function handleOnboardingComplete(record: UserRecord) {
    setUserName(record)
    try { localStorage.setItem(ACCOUNT_KEY, JSON.stringify(record)) } catch { /* quota */ }
    if (record.favourites.length > 0) {
      const loaded = new Set(record.favourites)
      setFavourites(loaded)
      try { localStorage.setItem(LS_KEY, JSON.stringify([...loaded])) } catch { /* quota */ }
    }
  }

  function handleSwitchAccount() {
    setUserName(null)
    try { localStorage.removeItem(ACCOUNT_KEY) } catch { /* ok */ }
  }

  const hasFavs = favourites.size > 0

  if (!userName) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#0b0b0a",
        overflow: "hidden",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {favsLoading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(11,11,10,0.85)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Courier Prime', monospace", color: "#f0ece0", fontSize: 14, letterSpacing: "0.06em",
        }}>
          loading your picks…
        </div>
      )}
      <MarqueeBanner />

      <Tabs
        value={activeDay}
        onValueChange={(v) => setActiveDay(v as Day)}
        style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}
      >
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
              onOpenArtist={setSelectedArtistId}
              listView={listView}
            />
          </TabsContent>
        ))}

        {/* Bottom day-selector bar */}
        <div
          style={{
            flexShrink: 0,
            backgroundColor: "#0b0b0a",
            paddingBottom: "env(safe-area-inset-bottom)",
          }}
        >
        <div style={{ borderTop: "1px solid hsl(var(--border))", display: "flex", alignItems: "center" }}>
          {/* Tabs fill available space */}
          <TabsList
            variant="line"
            className="flex-1 w-auto h-12 rounded-none p-0 gap-0"
          >
            {timetableData.days.map((day) => (
              <TabsTrigger
                key={day}
                value={day}
                className="flex-1 h-full rounded-none text-[13px] font-bold tracking-[0.08em] after:top-0"
                style={
                  activeDay === day
                    ? { color: "#ffffff" }
                    : { color: "#4a4943" }
                }
              >
                {DAY_LABELS[day]}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Favourites toggle */}
          <button
            onClick={() => setShowFavs((s) => !s)}
            aria-label={showFavs ? "Show all" : "Show favourites"}
            style={{
              flexShrink: 0,
              width: 44,
              height: 48,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "none",
              border: "none",
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

          {/* Settings drawer */}
          <Drawer>
            <DrawerTrigger asChild>
              <button
                aria-label="Settings"
                style={{
                  flexShrink: 0,
                  width: 44,
                  height: 48,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "hsl(var(--muted-foreground))",
                }}
              >
                <Settings size={18} strokeWidth={1.5} />
              </button>
            </DrawerTrigger>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>SETTINGS</DrawerTitle>
                <DrawerDescription>memosa 2026</DrawerDescription>
              </DrawerHeader>
              <div style={{ padding: "8px 24px 40px", display: "flex", flexDirection: "column", gap: 0 }}>
                {/* List view toggle */}

                <button
                  onClick={() => setListView((v) => !v)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    background: "none",
                    border: "none",
                    borderBottom: "1px solid hsl(var(--border))",
                    padding: "16px 0",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", color: "hsl(var(--foreground))", fontFamily: "inherit" }}>
                    LIST VIEW
                  </span>
                  {/* pill toggle */}
                  <div style={{
                    width: 44,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: listView ? "#d2d2d0" : "hsl(var(--muted))",
                    position: "relative",
                    transition: "background-color 0.2s ease",
                    flexShrink: 0,
                  }}>
                    <div style={{
                      position: "absolute",
                      top: 3,
                      left: listView ? 23 : 3,
                      width: 18,
                      height: 18,
                      borderRadius: 9,
                      backgroundColor: listView ? "#0b0b0a" : "#a5a4a1",
                      transition: "left 0.2s ease",
                    }} />
                  </div>
                </button>

                {/* Account row */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  borderBottom: "1px solid hsl(var(--border))",
                  padding: "16px 0",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <User size={14} style={{ opacity: 0.5 }} />
                    <span style={{ fontSize: 13, color: "hsl(var(--foreground))", fontWeight: 700, letterSpacing: "0.08em" }}>
                      {userName?.display_name ?? ""}
                    </span>
                  </div>
                  <button
                    onClick={handleSwitchAccount}
                    style={{
                      fontSize: 11, letterSpacing: "0.06em", color: "hsl(var(--muted-foreground))",
                      background: "none", border: "none", cursor: "pointer", fontFamily: "inherit",
                      textTransform: "uppercase",
                    }}
                  >
                    switch
                  </button>
                </div>

                {/* Disclaimer */}
                <p style={{ marginTop: 32, fontSize: 11, lineHeight: 1.6, color: "hsl(var(--muted-foreground))", opacity: 0.6, textAlign: "center" }}>
                  This app is not official from Memòri Festival.{"\n"}
                  For the latest info, visit{" "}
                  <a
                    href="https://memori-festival.fr/"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
                  >
                    memori-festival.fr
                  </a>
                </p>
              </div>
            </DrawerContent>
          </Drawer>
        </div>
        </div>
      </Tabs>

      <ArtistDrawerPortal
        artistId={selectedArtistId}
        activeDay={activeDay}
        favourites={favourites}
        onClose={() => setSelectedArtistId(null)}
        onToggleFav={toggleFav}
      />
    </div>
  )
}
