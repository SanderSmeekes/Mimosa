import React, { useState, useEffect, useRef, useCallback } from "react"
import { createPortal } from "react-dom"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { timetableData, type Day, type Stage, type SlotEntry, type BannerEntry } from "@/data/timetable"
import { artistsData } from "@/data/artists"
import { Heart, ExternalLink, X, ChevronDown, ChevronUp, ChevronLeft, User, Menu } from "lucide-react"
import { lookupUser, saveFavourites, countSaves, getSavers, getUserFavourites, signOut, type UserRecord } from "./lib/supabase"
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

const STAGE_TINT: Record<Stage, string> = {
  LUX:    "#C0392B",
  UNDA:   "#D9A227",
  AURA:   "#7A8B3C",
  MENTIS: "#4A9BC4",
}

function stageBg(stage: Stage, theme: "dark" | "light" | "diva"): string {
  const color = STAGE_TINT[stage]
  const pct = theme === "light" ? "10%" : theme === "diva" ? "18%" : "20%"
  return `color-mix(in srgb, ${color} ${pct}, hsl(var(--background)))`
}

const STAGE_COLORS: Record<Stage, { bg: string; text: string }> = {
  LUX:    { bg: "color-mix(in srgb, #C0392B 20%, hsl(var(--background)))", text: "hsl(var(--foreground))" },
  UNDA:   { bg: "color-mix(in srgb, #D9A227 20%, hsl(var(--background)))", text: "hsl(var(--foreground))" },
  AURA:   { bg: "color-mix(in srgb, #7A8B3C 20%, hsl(var(--background)))", text: "hsl(var(--foreground))" },
  MENTIS: { bg: "color-mix(in srgb, #4A9BC4 20%, hsl(var(--background)))", text: "hsl(var(--foreground))" },
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
   Diva sparkles
───────────────────────────────────────────── */
const SPARKLE_COLORS = ["#F02880", "#F5C8DC", "#C0206A", "#FF80C0", "#FFD0E8", "#E81890"]
const SPARKLE_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315]

type SparkleParticle = { id: number; x: number; y: number; dx: number; dy: number; color: string; size: number; shape: "circle" | "star" }
let _sparkleId = 0

function SparkleOverlay({ particles }: { particles: SparkleParticle[] }) {
  if (!particles.length) return null
  return createPortal(
    <>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "fixed",
            left: p.x,
            top: p.y,
            width: p.size,
            height: p.size,
            pointerEvents: "none",
            zIndex: 99999,
            color: p.color,
            fontSize: p.size,
            lineHeight: 1,
            transform: "translate(-50%, -50%)",
            "--sdx": `${p.dx}px`,
            "--sdy": `${p.dy}px`,
          } as React.CSSProperties}
          className="diva-sparkle-particle"
        >
          {p.shape === "star" ? "✦" : "●"}
        </div>
      ))}
    </>,
    document.body
  )
}

function useDivaSparkles() {
  const [particles, setParticles] = useState<SparkleParticle[]>([])

  const trigger = useCallback((x: number, y: number) => {
    const newOnes: SparkleParticle[] = SPARKLE_ANGLES.map((angle) => {
      const rad = (angle * Math.PI) / 180
      const dist = 28 + Math.random() * 28
      return {
        id: _sparkleId++,
        x, y,
        dx: Math.cos(rad) * dist,
        dy: Math.sin(rad) * dist,
        color: SPARKLE_COLORS[Math.floor(Math.random() * SPARKLE_COLORS.length)],
        size: 10 + Math.random() * 8,
        shape: Math.random() > 0.5 ? "star" : "circle",
      }
    })
    setParticles((prev) => [...prev, ...newOnes])
    setTimeout(() => setParticles((prev) => prev.filter((p) => !newOnes.find((n) => n.id === p.id))), 650)
  }, [])

  return { particles, trigger }
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
  diva,
  theme,
  onSparkle,
}: {
  slot: SlotEntry
  stage: Stage
  isFav: boolean
  dimmed: boolean
  onToggleFav: () => void
  onOpenArtist: (id: string) => void
  diva?: boolean
  theme?: "dark" | "light" | "diva"
  onSparkle?: (x: number, y: number) => void
}) {
  const [animKey, setAnimKey] = useState(0)
  const animClass = animKey === 0 ? "" : isFav ? "heart-anim-off" : "heart-anim-on"
  const top    = topPx(slot.start_time)
  const height = heightPx(slot.start_time, slot.end_time)
  const bg = stageBg(stage, theme ?? "dark")
  const { text } = STAGE_COLORS[stage]
  const accent = STAGE_ACCENT[stage]
  const compact = height < 56

  const iconSize = compact ? 10 : 12

  return (
    <div
      onClick={() => onOpenArtist(slot.artist_id)}
      style={{
        position: "absolute",
        top: top + 1,
        left: 1,
        right: 1,
        height: height - 2,
        backgroundColor: diva ? "hsl(var(--card))" : bg,
        cursor: "pointer",
        color: diva ? "hsl(var(--card-foreground))" : text,
        borderRadius: 3,
        borderLeft: diva ? `3px solid hsl(var(--primary))` : `3px solid ${accent}`,
        padding: compact ? "3px 6px 3px 7px" : "5px 6px 5px 7px",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: compact ? "center" : "space-between",
        boxShadow: diva ? "var(--diva-card-glow)" : "none",
        userSelect: "none",
        opacity: dimmed ? 0.35 : 1,
        transition: "opacity 0.2s ease",
      }}
    >
      {/* Artist name row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
        <span
          style={{
            fontSize: compact ? 11 : 13,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: "0.01em",
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
          onClick={(e) => {
            e.stopPropagation()
            setAnimKey(k => k + 1)
            if (diva && !isFav && onSparkle) {
              const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
              onSparkle(r.left + r.width / 2, r.top + r.height / 2)
            }
            onToggleFav()
          }}
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
            color: isFav ? "var(--fav-color)" : "hsl(var(--muted-foreground))",
            transition: "color 150ms ease-out",
          }}
          aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
        >
          <span key={animKey} className={animClass} style={{ display: "flex" }}>
            <Heart size={iconSize} fill={isFav ? "var(--fav-color)" : "none"} strokeWidth={2} />
          </span>
        </button>
      </div>

      {!compact && (
        <span style={{ fontSize: 10, opacity: 0.55, flexShrink: 0, letterSpacing: 0 }}>
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
  diva,
  onSparkle,
}: {
  item: ListItem
  day: Day
  isFav: boolean
  dimmed: boolean
  onToggleFav: () => void
  onOpenArtist: (id: string) => void
  clashWith: string | null
  status: "now" | "later" | "earlier"
  diva?: boolean
  onSparkle?: (x: number, y: number) => void
}) {
  const accent = STAGE_ACCENT[item.stage]
  const border = "1px solid hsl(var(--border))"
  const key    = slotKey(day, item.stage, item)
  void key
  const [animKey, setAnimKey] = useState(0)
  const animClass = animKey === 0 ? "" : isFav ? "heart-anim-off" : "heart-anim-on"

  const isNow = status === "now"
  const divaAccent = "hsl(var(--primary))"

  return (
    <div
      onClick={() => onOpenArtist(item.artist_id)}
      style={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: border,
        borderLeft: isNow ? `2px solid ${diva ? divaAccent : accent}` : "2px solid transparent",
        minHeight: 64,
        opacity: dimmed ? 0.35 : status === "earlier" ? 0.38 : 1,
        transition: "opacity 0.2s ease",
        cursor: "pointer",
        backgroundColor: isNow ? "hsl(var(--muted) / 0.35)" : "transparent",
      }}
    >
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
        <span style={{ fontSize: 11, fontWeight: 700, color: isNow ? accent : "hsl(var(--muted-foreground))", lineHeight: 1 }}>
          {item.start_time}
        </span>
        {isNow && (
          <span className="now-pulse" style={{ fontSize: 9, color: accent, letterSpacing: "0.04em", lineHeight: 1 }}>NOW</span>
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
            }}>live</span>
          )}
        </div>

        {/* Secondary line */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: accent, flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", letterSpacing: "0.03em" }}>
            {item.stage}
          </span>
          <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", opacity: 0.5 }}>·</span>
          {isNow && (
            <span style={{ fontSize: 10, color: accent }}>until {item.end_time}</span>
          )}
          {status === "later" && (
            <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>until {item.end_time}</span>
          )}
          {status === "earlier" && (
            <span style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", opacity: 0.7 }}>ended {item.end_time}</span>
          )}
          {isFav && clashWith && (
            <span style={{ fontSize: 10, color: "#e8a838" }}>
              ↔ {clashWith}
            </span>
          )}
        </div>
      </div>

      {/* Heart */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          setAnimKey(k => k + 1)
          if (diva && !isFav && onSparkle) {
            const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
            onSparkle(r.left + r.width / 2, r.top + r.height / 2)
          }
          onToggleFav()
        }}
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
          color: isFav ? "var(--fav-color)" : "hsl(var(--muted-foreground))",
          transition: "color 150ms ease-out",
        }}
        aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
      >
        <span key={animKey} className={animClass} style={{ display: "flex" }}>
          <Heart size={14} fill={isFav ? "var(--fav-color)" : "none"} strokeWidth={2} />
        </span>
      </button>
    </div>
  )
}

function SectionHeader({ label, dim }: { label: string; dim?: boolean }) {
  return (
    <div style={{
      padding: "10px 16px 7px",
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.12em",
      color: "hsl(var(--muted-foreground))",
      opacity: dim ? 0.5 : 1,
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
  diva,
  onSparkle,
}: {
  day: Day
  favourites: Set<string>
  showFavs: boolean
  onToggleFav: (key: string) => void
  onOpenArtist: (id: string) => void
  diva?: boolean
  onSparkle?: (x: number, y: number) => void
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
        diva={diva}
        onSparkle={onSparkle}
      />
    )
  }

  const border = "1px solid hsl(var(--border))"

  return (
    <div className="view-fade" style={{ flex: 1, overflow: "auto", overscrollBehavior: "none", WebkitOverflowScrolling: "touch" as never, paddingBottom: "calc(64px + env(safe-area-inset-bottom))" }}>

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

      {/* End cap */}
      {!nowInDay && later.length > 0 && (
        <div style={{ padding: "20px 0 32px", textAlign: "center", fontSize: 10, letterSpacing: "0.07em", color: "hsl(var(--muted-foreground))", opacity: 0.45 }}>
          — END OF {day.toUpperCase()} —
        </div>
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
              letterSpacing: "0.06em",
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
  diva,
  theme,
  onSparkle,
}: {
  day: Day
  favourites: Set<string>
  showFavs: boolean
  onToggleFav: (key: string) => void
  onOpenArtist: (id: string) => void
  listView: boolean
  diva?: boolean
  theme?: "dark" | "light" | "diva"
  onSparkle?: (x: number, y: number) => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

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
        key="list"
        day={day}
        favourites={favourites}
        showFavs={showFavs}
        onToggleFav={onToggleFav}
        onOpenArtist={onOpenArtist}
        diva={diva}
        onSparkle={onSparkle}
      />
    )
  }

  return (
    <div
      key="grid"
      ref={scrollRef}
      className="view-fade"
      style={{
        flex: 1,
        overflow: "auto",
        overscrollBehavior: "contain",
        paddingBottom: "calc(64px + env(safe-area-inset-bottom))",
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
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.07em",
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
              className="now-line"
              style={{
                position: "absolute",
                top: nowTop,
                left: TIME_GUTTER_W,
                right: 0,
                height: 0,
                borderTop: "1px dashed hsl(var(--foreground))",
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
                  letterSpacing: "0.06em",
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
                    fontVariantNumeric: "tabular-nums",
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
                    diva={diva}
                    theme={theme}
                    onSparkle={onSparkle}
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
const MARQUEE_TEXT = "Smile, dance and make Memoiries ➰ Raargh!"
const MARQUEE_SEPARATOR = "   "
const MARQUEE_CHUNK = Array(3).fill(MARQUEE_TEXT).join(MARQUEE_SEPARATOR)


function MarqueeSegment() {
  return (
    <>
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.8rem",
          letterSpacing: "0.04em",
          color: "hsl(var(--muted-foreground))",
          verticalAlign: "middle",
        }}
      >
        {MARQUEE_CHUNK}
      </span>
    </>
  )
}

function MarqueeBanner() {
  return (
    <div
      className="group"
      style={{
        flexShrink: 0,
        borderTop: "1px solid hsl(var(--border))",
        borderBottom: "1px solid hsl(var(--border))",
        paddingTop: "10px",
        paddingBottom: "10px",
        overflow: "hidden",
        whiteSpace: "nowrap",
        backgroundColor: "hsl(var(--background))",
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

function UserPicksList({ favs, loading, border, myFavourites }: { favs: string[]; loading: boolean; border: string; myFavourites: Set<string> }) {
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
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "hsl(var(--muted-foreground))", opacity: 0.5, padding: "12px 0 4px", textTransform: "uppercase" }}>
            {group.day}
          </div>
          {group.items.map((p, i) => {
            const stageAccent = STAGE_ACCENT[p.stage as Stage] ?? "#d2d2d0"
            const isShared = myFavourites.has(`${p.day}__${p.stage}__${p.artist}__${p.time}`)
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: border }}>
                <div style={{ width: 3, height: 34, borderRadius: 2, backgroundColor: stageAccent, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(var(--foreground))", letterSpacing: "0.02em" }}>{p.artist}</div>
                  <div style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", marginTop: 2, letterSpacing: "0.06em" }}>{p.stage} · {p.time}</div>
                </div>
                {isShared && (
                  <Heart size={13} strokeWidth={1.5} style={{ color: "hsl(var(--muted-foreground))", opacity: 0.45, flexShrink: 0 }} />
                )}
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
  diva,
  onSparkle,
}: {
  artistId: string | null
  slotKey: string | null
  open: boolean
  onClose: () => void
  isFav: boolean
  onToggleFav: () => void
  myFavourites: Set<string>
  diva?: boolean
  onSparkle?: (x: number, y: number) => void
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 12px 0", flexShrink: 0, minHeight: 36 }}>
          {view.page !== "main" ? (
            <button style={iconBtn} onClick={() => view.page === "user-picks" ? openSavers() : setView({ page: "main" })}>
              <ChevronDown size={20} strokeWidth={1.5} style={{ transform: "rotate(90deg)" }} />
            </button>
          ) : (
            <div style={{ width: 44 }} />
          )}

          {view.page === "savers" && (
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", color: "hsl(var(--muted-foreground))" }}>WHO SAVED THIS</span>
          )}
          {view.page === "user-picks" && (
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", color: "hsl(var(--muted-foreground))", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
              {(view as { displayName: string }).displayName.toUpperCase()}
            </span>
          )}

          <div style={{ width: 44 }} />
        </div>

        {/* Main artist page */}
        {view.page === "main" && artist && (
          <div style={{ overflowY: "auto", padding: "8px 20px 40px", display: "flex", flexDirection: "column", gap: 20, flex: 1 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: accent }} />
                <span style={{ fontSize: 11, letterSpacing: "0.06em", color: "hsl(var(--muted-foreground))" }}>
                  {artist.stage}{artist.country ? ` · ${artist.country}` : ""}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: 26, fontWeight: 400, letterSpacing: "0.02em", color: "hsl(var(--foreground))", lineHeight: 1.05, fontFamily: "var(--font-heading)" }}>{artist.name}</h2>
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

            {/* 50/50 action buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={(e) => {
                  if (diva && !isFav && onSparkle) {
                    const r = (e.currentTarget as HTMLButtonElement).getBoundingClientRect()
                    onSparkle(r.left + r.width / 2, r.top + r.height / 2)
                  }
                  onToggleFav()
                }}
                style={{
                  flex: 1, height: 48, borderRadius: 8, border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                  backgroundColor: isFav ? "var(--fav-color)" : "hsl(var(--muted))",
                  color: isFav ? "#ffffff" : "hsl(var(--foreground))",
                  fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", fontFamily: "inherit",
                  transition: "background-color 150ms ease-out, color 150ms ease-out",
                }}
              >
                <Heart size={14} fill={isFav ? "#ffffff" : "none"} strokeWidth={2} />
                {isFav ? "FAVOURITED" : "FAVOURITE"}
              </button>
              <button
                onClick={openSavers}
                style={{
                  flex: 1, height: 48, borderRadius: 8, cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  backgroundColor: saveCount ? "transparent" : "hsl(var(--muted))",
                  border: saveCount ? "1px solid hsl(var(--border))" : "none",
                  color: "hsl(var(--muted-foreground))",
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.05em", fontFamily: "inherit",
                  textAlign: "center",
                }}
              >
                {saveCount !== null && saveCount > 0
                  ? `SEE WHO ELSE (${saveCount})`
                  : "SEE WHO ELSE"}
              </button>
            </div>

            {artist.bio ? (
              <p style={{
                margin: 0,
                fontSize: 13,
                lineHeight: 1.8,
                color: "hsl(var(--muted-foreground))",
                fontFeatureSettings: '"kern" 1, "liga" 1',
                wordSpacing: "0.04em",
                textWrap: "pretty" as React.CSSProperties["textWrap"],
              }}>{artist.bio}</p>
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
              myFavourites={myFavourites}
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
  diva,
  onSparkle,
}: {
  artistId: string | null
  activeDay: Day
  favourites: Set<string>
  onClose: () => void
  onToggleFav: (key: string) => void
  diva?: boolean
  onSparkle?: (x: number, y: number) => void
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
      diva={diva}
      onSparkle={onSparkle}
    />
  )
}

const LS_KEY = "memoris-favourites"
const ACCOUNT_KEY = "memosa-account"
const A2HS_KEY = "memosa-a2hs-shown"

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as { standalone?: boolean }).standalone === true

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
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 768)
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)")
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener("change", handler)
    return () => mq.removeEventListener("change", handler)
  }, [])
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null)
  const [showA2HS, setShowA2HS] = useState(false)
  const [showMap, setShowMap] = useState(false)
  const [mapIndex, setMapIndex] = useState(0)

  type Theme = "dark" | "light" | "diva"
  const [theme, setThemeState] = useState<Theme>(() => {
    try {
      if (localStorage.getItem("memosa-diva") === "1") return "diva"
      if (localStorage.getItem("mimosa-light") === "1") return "light"
    } catch { /* ok */ }
    return "dark"
  })
  const diva = theme === "diva"

  function applyThemeToDom(t: Theme) {
    const html = document.documentElement
    html.classList.toggle("theme-diva",  t === "diva")
    html.classList.toggle("theme-light", t === "light")
    const bg = t === "diva" ? "#1C0812" : t === "light" ? "#ffffff" : "#0b0b0a"
    const scheme = t === "light" ? "light" : "dark"
    html.style.backgroundColor = bg
    html.style.colorScheme = scheme
    document.body.style.backgroundColor = bg
    // setAttribute on the existing meta triggers Safari's MutationObserver for
    // theme-color — remove+reinsert does NOT reliably trigger dynamic updates
    const tc = document.querySelector('meta[name="theme-color"]') as HTMLMetaElement | null
    if (tc) {
      tc.setAttribute('content', bg)
    } else {
      const newTc = document.createElement('meta')
      newTc.setAttribute('name', 'theme-color')
      newTc.setAttribute('content', bg)
      document.head.appendChild(newTc)
    }
  }

  const [themeFlash, setThemeFlash] = useState<string | null>(null)

  function setTheme(t: Theme) {
    const bg = t === "diva" ? "#1C0812" : t === "light" ? "#ffffff" : "#0b0b0a"
    // Persist first so the inline <head> script picks it up on reload
    try {
      localStorage.setItem("memosa-diva",  t === "diva"  ? "1" : "0")
      localStorage.setItem("mimosa-light", t === "light" ? "1" : "0")
    } catch { /* ok */ }
    // Cover the screen in the new bg colour, then reload.
    // iOS Safari only reads theme-color on initial paint — a service-worker-
    // cached reload is near-instant and guarantees the chrome colour is correct.
    setThemeFlash(bg)
    requestAnimationFrame(() => requestAnimationFrame(() => location.reload()))
  }

  // Keep DOM in sync on initial mount
  useEffect(() => { applyThemeToDom(theme) }, [theme])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { particles: sparkleParticles, trigger: triggerSparkle } = useDivaSparkles()

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
    const loaded = new Set(record.favourites)
    setFavourites(loaded)
    try { localStorage.setItem(LS_KEY, JSON.stringify([...loaded])) } catch { /* quota */ }
    if (!isStandalone()) {
      try {
        if (!localStorage.getItem(A2HS_KEY)) setShowA2HS(true)
      } catch { /* ok */ }
    }
  }

  function dismissA2HS() {
    setShowA2HS(false)
    try { localStorage.setItem(A2HS_KEY, "1") } catch { /* ok */ }
  }

  function handleSwitchAccount() {
    signOut().catch(() => {})
    setUserName(null)
    setFavourites(new Set())
    try { localStorage.removeItem(ACCOUNT_KEY) } catch { /* ok */ }
    try { localStorage.removeItem(LS_KEY) } catch { /* ok */ }
  }


  if (!userName) {
    return <Onboarding onComplete={handleOnboardingComplete} />
  }

  return (
    <div
      className={undefined}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        backgroundColor: diva ? "#1C0812" : "hsl(var(--background))",
        overflow: "hidden",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      {/* Theme flash overlay — fades out over new background to mask the instant React re-render */}
      {themeFlash && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9997,
            backgroundColor: themeFlash,
            animation: "theme-flash-out 260ms ease forwards",
            pointerEvents: "none",
          }}
          onAnimationEnd={() => setThemeFlash(null)}
        />
      )}
      {favsLoading && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: diva ? "rgba(28,8,18,0.88)" : theme === "light" ? "rgba(255,255,255,0.88)" : "rgba(11,11,10,0.88)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "var(--font-body)", color: "hsl(var(--foreground))", fontSize: 14, letterSpacing: "0.06em",
        }}>
          loading your picks…
        </div>
      )}
      {!diva && <MarqueeBanner />}
      <SparkleOverlay particles={sparkleParticles} />

      {/* Add to Home Screen hint */}
      {showA2HS && (
        <div style={{
          position: "fixed", bottom: "calc(128px + env(safe-area-inset-bottom))", left: 16, right: 16,
          backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))",
          borderRadius: 12, padding: "14px 16px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
          zIndex: 50, display: "flex", alignItems: "flex-start", gap: 12,
          animation: "indicator-in 0.3s ease forwards",
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.05em", color: "hsl(var(--foreground))", marginBottom: 4 }}>
              ADD TO HOME SCREEN
            </div>
            <div style={{ fontSize: 11, lineHeight: 1.6, color: "hsl(var(--muted-foreground))" }}>
              Tap the share icon and choose "Add to Home Screen" for the best experience — works offline too.
            </div>
          </div>
          <button
            onClick={dismissA2HS}
            style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", padding: 4, flexShrink: 0, marginTop: -2 }}
            aria-label="Dismiss"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      )}

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
              diva={diva}
              theme={theme}
              onSparkle={diva ? triggerSparkle : undefined}
            />
          </TabsContent>
        ))}

        {/* Bottom day-selector bar — floating glass */}
        <div style={{
          position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
          display: "flex", alignItems: "stretch",
          paddingBottom: "env(safe-area-inset-bottom)",
          background: diva
            ? "rgba(28,8,18,0.72)"
            : theme === "light"
              ? "rgba(255,255,255,0.72)"
              : "rgba(11,11,10,0.72)",
          backdropFilter: "blur(20px) saturate(1.8)",
          WebkitBackdropFilter: "blur(20px) saturate(1.8)",
          borderTop: "1px solid hsl(var(--border) / 0.5)",
        }}>
          {/* Tabs fill available space */}
          <TabsList
            variant="line"
            className="flex-1 w-auto h-12 rounded-none p-0 gap-0"
          >
            {timetableData.days.map((day) => (
              <TabsTrigger
                key={day}
                value={day}
                className="flex-1 h-full rounded-none text-[12px] font-bold tracking-[0.04em] flex-col gap-1 after:hidden"
                style={activeDay === day ? { color: "hsl(var(--foreground))" } : { color: "hsl(var(--foreground))", opacity: 0.35 }}
              >
                {DAY_LABELS[day]}
                {activeDay === day && (
                  diva
                    ? <span style={{ fontSize: 10, lineHeight: 1, animation: "indicator-in 0.25s ease forwards" }}>✦</span>
                    : <div style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: "hsl(var(--foreground))", animation: "indicator-in 0.25s ease forwards" }} />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Settings drawer */}
          <Drawer open={settingsOpen} onOpenChange={setSettingsOpen} direction={isDesktop ? "right" : "bottom"}>
            <DrawerTrigger asChild>
              <button style={{ display: "none" }} aria-hidden />
            </DrawerTrigger>
            <DrawerContent hideHandle={isDesktop} className={isDesktop ? "!inset-y-0 !right-0 !left-auto !rounded-none !w-80 !h-full !flex-col overflow-y-auto" : ""}>
              <DrawerHeader>
                <DrawerTitle>Preferences</DrawerTitle>
              </DrawerHeader>
              <div key={settingsOpen ? "open" : "closed"} className={settingsOpen ? "settings-fade" : ""} style={{ padding: "8px 28px 56px", display: "flex", flexDirection: "column" }}>

                {/* ── Section label helper ── */}
                {(() => {
                  const SectionLabel = ({ label }: { label: string }) => (
                    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: "hsl(var(--muted-foreground))", opacity: 0.55, paddingTop: 32, paddingBottom: 8 }}>
                      {label}
                    </div>
                  )

                  const Toggle = ({ on, divaColor }: { on: boolean; divaColor?: string }) => {
                    const trackOn = divaColor ?? "hsl(var(--foreground))"
                    const knobOn  = divaColor ? "#1C0812" : "hsl(var(--background))"
                    return (
                      <div style={{
                        width: 44, height: 26, borderRadius: 13, flexShrink: 0,
                        backgroundColor: on ? trackOn : "hsl(var(--muted))",
                        position: "relative",
                        transition: "background-color 0.2s ease",
                        outline: "none",
                      }}>
                        <div style={{
                          position: "absolute", top: 3,
                          left: on ? 21 : 3,
                          width: 20, height: 20, borderRadius: 10,
                          backgroundColor: on ? knobOn : "hsl(var(--muted-foreground))",
                          transition: "left 0.2s ease",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                        }} />
                      </div>
                    )
                  }

                  const ToggleRow = ({
                    label, sub, on, onToggle, divaColor,
                  }: { label: string; sub?: string; on: boolean; onToggle: () => void; divaColor?: string }) => (
                    <button
                      role="switch"
                      aria-checked={on}
                      onClick={onToggle}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: "none", border: "none", borderBottom: "1px solid hsl(var(--border))",
                        padding: "17px 0", cursor: "pointer", width: "100%",
                        outline: "none",
                      }}
                      onFocus={e => (e.currentTarget.style.outline = "2px solid hsl(var(--ring))")}
                      onBlur={e  => (e.currentTarget.style.outline = "none")}
                    >
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2, textAlign: "left" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.01em", color: divaColor && on ? divaColor : "hsl(var(--foreground))", fontFamily: "inherit", transition: "color 0.2s ease" }}>
                          {label}
                        </span>
                        {sub && <span style={{ fontSize: 11, color: "hsl(var(--muted-foreground))", letterSpacing: "0.03em", opacity: 0.7 }}>{sub}</span>}
                      </div>
                      <Toggle on={on} divaColor={divaColor} />
                    </button>
                  )

                  return (
                    <>
                      <SectionLabel label="Display" />

                      {/* Theme segmented control */}
                      {(() => {
                        const themes: Theme[] = ["dark", "light", "diva"]
                        const labels: Record<Theme, string> = { dark: "DARK", light: "LIGHT", diva: "DIVA 💅" }
                        const idx = themes.indexOf(theme)
                        const pillBg = theme === "diva" ? "#FF2D95" : "hsl(var(--foreground))"
                        const activeTextColor = theme === "diva" ? "#1C0812" : "hsl(var(--background))"
                        return (
                          <div style={{ padding: "10px 0", borderBottom: "1px solid hsl(var(--border))" }}>
                            <div style={{ position: "relative", display: "flex", background: "hsl(var(--muted))", borderRadius: 999, padding: 3 }}>
                              {/* Sliding pill */}
                              <div style={{
                                position: "absolute",
                                top: 3, bottom: 3,
                                left: `calc(${idx} * (100% - 6px) / 3 + 3px)`,
                                width: "calc((100% - 6px) / 3)",
                                borderRadius: 999,
                                background: pillBg,
                                boxShadow: "0 1px 6px rgba(0,0,0,0.3)",
                                transition: "left 400ms cubic-bezier(0.34, 1.56, 0.64, 1), background 250ms ease",
                                pointerEvents: "none",
                              }} />
                              {themes.map((t) => (
                                <button
                                  key={t}
                                  onClick={() => setTheme(t)}
                                  style={{
                                    flex: 1, padding: "8px 4px", fontSize: 11, fontWeight: 700,
                                    letterSpacing: "0.08em", borderRadius: 999, border: "none", cursor: "pointer",
                                    fontFamily: "inherit", background: "transparent", position: "relative", zIndex: 1,
                                    color: theme === t ? activeTextColor : "hsl(var(--muted-foreground))",
                                    transition: "color 250ms ease",
                                  }}
                                >
                                  {labels[t]}
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })()}

                      <ToggleRow label="List view"            on={listView}  onToggle={() => setListView(v => !v)} />
                      <ToggleRow label="Highlight favourites" sub="Make starred acts stand out" on={showFavs}  onToggle={() => setShowFavs(v => !v)} />

                      {/* Festival map nav row */}
                      <button
                        onClick={() => { setSettingsOpen(false); setShowMap(true) }}
                        style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: "none", border: "none", borderBottom: "1px solid hsl(var(--border))",
                          padding: "17px 0", cursor: "pointer", width: "100%",
                          outline: "none",
                        }}
                        onFocus={e => (e.currentTarget.style.outline = "2px solid hsl(var(--ring))")}
                        onBlur={e  => (e.currentTarget.style.outline = "none")}
                      >
                        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: "0.01em", color: "hsl(var(--foreground))", fontFamily: "inherit" }}>
                          Festival map
                        </span>
                        <ChevronLeft size={16} style={{ color: "hsl(var(--muted-foreground))", transform: "rotate(180deg)" }} />
                      </button>

                      <SectionLabel label="Account" />
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        borderBottom: "1px solid hsl(var(--border))",
                        padding: "17px 0",
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
                            textTransform: "uppercase", padding: "4px 0",
                            outline: "none",
                          }}
                          onFocus={e => (e.currentTarget.style.outline = "2px solid hsl(var(--ring))")}
                          onBlur={e  => (e.currentTarget.style.outline = "none")}
                        >
                          log out
                        </button>
                      </div>

                      <div style={{ marginTop: 32, fontSize: 11, lineHeight: 1.9, color: "hsl(var(--muted-foreground))", opacity: 0.6, textAlign: "center", wordSpacing: "0.03em", textWrap: "pretty" as React.CSSProperties["textWrap"] }}>
                        <p style={{ margin: 0 }}>
                          This app is not official from Memòri Festival.{" "}
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
                        <p style={{ margin: "6px 0 0" }}>
                          Last updated: 30 June 2026, 22:01
                        </p>
                      </div>
                    </>
                  )
                })()}
              </div>
            </DrawerContent>
          </Drawer>
        </div>
      </Tabs>

      {/* Floating settings button */}
      <button
        onClick={() => setSettingsOpen(true)}
        aria-label="Settings"
        className={["fab-settings", diva ? "diva-shimmer diva-chrome-btn" : ""].filter(Boolean).join(" ")}
        style={{
          position: "fixed",
          bottom: "calc(56px + env(safe-area-inset-bottom))",
          right: 16,
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: diva ? undefined : "hsl(var(--card))",
          border: diva ? "none" : "1px solid hsl(var(--border))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: diva ? "#1C0812" : "hsl(var(--muted-foreground))",
          boxShadow: diva ? "0 4px 20px rgba(255,45,149,0.4), 0 0 0 1px rgba(255,45,149,0.25)" : "0 4px 16px rgba(0,0,0,0.4)",
          zIndex: 40,
        }}
      >
        <Menu size={20} strokeWidth={1.5} />
      </button>

      <ArtistDrawerPortal
        artistId={selectedArtistId}
        activeDay={activeDay}
        favourites={favourites}
        onClose={() => setSelectedArtistId(null)}
        onToggleFav={toggleFav}
        diva={diva}
        onSparkle={diva ? triggerSparkle : undefined}
      />

      {/* Festival map overlay */}
      {showMap && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, backgroundColor: "hsl(var(--background))", display: "flex", flexDirection: "column" }}>

          {/* Top bar — matches main app glass navbar style */}
          <div style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 201,
            paddingTop: "env(safe-area-inset-top)",
            background: diva
              ? "rgba(28,8,18,0.82)"
              : theme === "light"
                ? "rgba(255,255,255,0.82)"
                : "rgba(11,11,10,0.82)",
            backdropFilter: "blur(20px) saturate(1.8)",
            WebkitBackdropFilter: "blur(20px) saturate(1.8)",
            borderBottom: "1px solid hsl(var(--border) / 0.5)",
          }}>
            <div style={{ display: "flex", alignItems: "center", height: 48, paddingLeft: 4, paddingRight: 16 }}>
              <button
                onClick={() => setShowMap(false)}
                style={{
                  width: 44, height: 44, borderRadius: 999, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "none", border: "none",
                  cursor: "pointer", color: "hsl(var(--muted-foreground))",
                }}
              >
                <ChevronLeft size={20} strokeWidth={1.5} />
              </button>
              <span style={{
                flex: 1, textAlign: "center",
                fontSize: 13, fontWeight: 700, letterSpacing: "0.06em",
                color: "hsl(var(--foreground))",
                marginRight: 44, // balance the back button
              }}>
                FESTIVAL MAP
              </span>
            </div>
          </div>

          {/* Scrollable map — padded past top bar + bottom bar */}
          <div style={{
            flex: 1, overflow: "auto", overscrollBehavior: "contain",
            touchAction: "pan-x pan-y pinch-zoom",
            paddingTop: "calc(48px + env(safe-area-inset-top))",
            paddingBottom: "calc(80px + env(safe-area-inset-bottom))",
          }}>
            {mapIndex === 0 && (
              <img src="/full-festival-map.webp" alt="Memòri 2026 Full Map"
                style={{ width: "100%", height: "auto", display: "block", userSelect: "none" }} draggable={false} />
            )}
            {mapIndex === 1 && (
              <img src="/memori_2026_maps-1.webp" alt="Memòri 2026 Festival Map"
                style={{ width: "100%", height: "auto", display: "block", userSelect: "none" }} draggable={false} />
            )}
            {mapIndex === 2 && (
              <img src="/camping-map.webp" alt="Memòri 2026 Camping Map"
                style={{ width: "100%", height: "auto", display: "block", userSelect: "none" }} draggable={false} />
            )}
          </div>

          {/* Bottom bar — pill segmented control only */}
          <div style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 201,
            padding: `12px 16px calc(12px + env(safe-area-inset-bottom))`,
            background: diva
              ? "rgba(28,8,18,0.82)"
              : theme === "light"
                ? "rgba(255,255,255,0.82)"
                : "rgba(11,11,10,0.82)",
            backdropFilter: "blur(20px) saturate(1.8)",
            WebkitBackdropFilter: "blur(20px) saturate(1.8)",
            borderTop: "1px solid hsl(var(--border) / 0.5)",
          }}>
            {/* Pill track — matches settings theme picker */}
            <div style={{
              display: "flex", alignItems: "center",
              background: "hsl(var(--muted))", borderRadius: 999,
              padding: 3, gap: 2,
            }}>
              {(["ALL", "FESTIVAL", "CAMPING"] as const).map((label, i) => (
                <button
                  key={i}
                  onClick={() => setMapIndex(i)}
                  style={{
                    flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 700,
                    letterSpacing: "0.06em", borderRadius: 999, border: "none", cursor: "pointer",
                    fontFamily: "inherit",
                    transition: "background 180ms, color 180ms, box-shadow 180ms",
                    background: mapIndex === i ? "hsl(var(--foreground))" : "transparent",
                    color: mapIndex === i ? "hsl(var(--background))" : "hsl(var(--muted-foreground))",
                    boxShadow: mapIndex === i ? "0 1px 6px rgba(0,0,0,0.4)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
