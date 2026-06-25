import React, { useState, useEffect, useRef } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer"
import { timetableData, type Day, type Stage, type SlotEntry, type BannerEntry } from "@/data/timetable"
import { artistsData } from "@/data/artists"
import { Heart, Settings, ExternalLink, X } from "lucide-react"

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
   List view — all acts for the day, sorted by
   start time, stacked vertically. Card height
   stays proportional to duration (same as grid).
───────────────────────────────────────────── */
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
  const scrollRef = useRef<HTMLDivElement>(null)
  const schedule  = timetableData.schedule[day]
  const border    = "1px solid hsl(var(--border))"

  type Item = SlotEntry & { stage: Stage }
  const items: Item[] = ALL_STAGES.flatMap((stage) =>
    (schedule[stage] ?? []).map((slot) => ({ ...slot, stage }))
  ).sort((a, b) => toFestivalHour(a.start_time) - toFestivalHour(b.start_time))

  return (
    <div
      ref={scrollRef}
      style={{ flex: 1, overflow: "auto", overscrollBehavior: "none", WebkitOverflowScrolling: "touch" as never }}
    >
      {items.map((item, i) => {
        const key     = slotKey(day, item.stage, item)
        const isFav   = favourites.has(key)
        const dimmed  = showFavs && !isFav
        const h       = heightPx(item.start_time, item.end_time)
        const accent  = STAGE_ACCENT[item.stage]
        const { bg, text } = STAGE_COLORS[item.stage]
        const compact = h < 56

        return (
          <div
            key={i}
            onClick={() => onOpenArtist(item.artist_id)}
            style={{
              display: "flex",
              alignItems: "stretch",
              borderBottom: border,
              height: h,
              opacity: dimmed ? 0.4 : 1,
              transition: "opacity 0.2s ease",
              cursor: "pointer",
            }}
          >
            {/* Time gutter */}
            <div style={{
              width: TIME_GUTTER_W,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              paddingRight: 8,
              fontSize: 10,
              color: "hsl(var(--muted-foreground))",
              borderRight: border,
            }}>
              {item.start_time}
            </div>

            {/* Card */}
            <div style={{
              flex: 1,
              margin: "4px",
              backgroundColor: bg,
              color: text,
              borderRadius: 8,
              borderLeft: `3px solid ${accent}`,
              padding: compact ? "5px 10px" : "10px 12px",
              display: "flex",
              flexDirection: "column",
              justifyContent: compact ? "center" : "space-between",
              overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.03em", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: compact ? "nowrap" : "normal", lineHeight: 1.25 }}>
                  {item.artist}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleFav(key) }}
                  style={{ background: "none", border: "none", padding: 0, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44, margin: "-14px -10px -14px 0", color: isFav ? "#ff6b6b" : "rgba(255,255,255,0.4)" }}
                >
                  <Heart size={compact ? 10 : 12} fill={isFav ? "#ff6b6b" : "none"} strokeWidth={2} />
                </button>
              </div>
              {!compact && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 10, opacity: 0.65 }}>{item.start_time}–{item.end_time}</span>
                  <div style={{ width: 6, height: 6, borderRadius: 9999, backgroundColor: accent, opacity: 0.8 }} />
                  <span style={{ fontSize: 10, opacity: 0.65, letterSpacing: "0.06em" }}>{item.stage}</span>
                </div>
              )}
            </div>
          </div>
        )
      })}
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
        paddingBottom: "16px",
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
function ArtistDrawer({
  artistId,
  open,
  onClose,
  isFav,
  onToggleFav,
}: {
  artistId: string | null
  open: boolean
  onClose: () => void
  isFav: boolean
  onToggleFav: () => void
}) {
  const artist = artistId ? artistsData[artistId] : null
  const accent = artist ? STAGE_ACCENT[artist.stage as Stage] : "#d2d2d0"
  const border = "1px solid hsl(var(--border))"

  return (
    <Drawer open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DrawerContent style={{ maxHeight: "85dvh" }}>
        {/* Close + fav row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 12px 0" }}>
          <DrawerClose asChild>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(var(--muted-foreground))", display: "flex", alignItems: "center", justifyContent: "center", minWidth: 44, minHeight: 44 }}>
              <X size={20} strokeWidth={1.5} />
            </button>
          </DrawerClose>
          <button
            onClick={onToggleFav}
            style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, padding: "0 12px", color: isFav ? "#ff6b6b" : "hsl(var(--muted-foreground))", fontSize: 12, fontFamily: "inherit", letterSpacing: "0.06em" }}
          >
            <Heart size={16} fill={isFav ? "#ff6b6b" : "none"} strokeWidth={2} />
            {isFav ? "SAVED" : "SAVE"}
          </button>
        </div>

        {artist ? (
          <div style={{ overflowY: "auto", padding: "12px 20px 40px", display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Name + meta */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: 9999, backgroundColor: accent }} />
                <span style={{ fontSize: 11, letterSpacing: "0.1em", color: "hsl(var(--muted-foreground))" }}>
                  {artist.stage}{artist.country ? ` · ${artist.country}` : ""}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "0.04em", color: "hsl(var(--foreground))", lineHeight: 1.2 }}>
                {artist.name}
              </h2>
            </div>

            {/* Bio */}
            {artist.bio ? (
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.7, color: "hsl(var(--muted-foreground))" }}>
                {artist.bio}
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 13, color: "hsl(var(--muted-foreground))", fontStyle: "italic", opacity: 0.5 }}>
                No bio available.
              </p>
            )}

            {/* Links */}
            {(artist.links.soundcloud || artist.links.instagram || artist.links.ra) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 0, borderTop: border, borderBottom: border }}>
                {([
                  { key: "soundcloud", label: "SOUNDCLOUD", href: artist.links.soundcloud },
                  { key: "instagram",  label: "INSTAGRAM",  href: artist.links.instagram  },
                  { key: "ra",         label: "RA",         href: artist.links.ra          },
                ] as const).filter(l => l.href).map((l) => (
                  <a
                    key={l.key}
                    href={l.href!}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "13px 0",
                      borderBottom: border,
                      color: "hsl(var(--foreground))",
                      textDecoration: "none",
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                    }}
                  >
                    {l.label}
                    <ExternalLink size={14} strokeWidth={1.5} style={{ color: "hsl(var(--muted-foreground))" }} />
                  </a>
                ))}
              </div>
            )}
          </div>
        ) : null}
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
  if (!artistId) return <ArtistDrawer artistId={null} open={false} onClose={onClose} isFav={false} onToggleFav={() => {}} />

  const a = artistsData[artistId]
  const stage = a?.stage as Stage | undefined
  const daySchedule = timetableData.schedule[activeDay]
  const slot = stage ? (daySchedule[stage] ?? []).find(s => s.artist_id === artistId) : undefined
  const key = slot && stage ? slotKey(activeDay, stage, slot) : null
  const isFav = key ? favourites.has(key) : false

  return (
    <ArtistDrawer
      artistId={artistId}
      open
      onClose={onClose}
      isFav={isFav}
      onToggleFav={() => key && onToggleFav(key)}
    />
  )
}

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
  const [showFavs, setShowFavs]         = useState(false)
  const [listView, setListView]         = useState(false)
  const [selectedArtistId, setSelectedArtistId] = useState<string | null>(null)

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
        backgroundColor: "#0b0b0a",
        overflow: "hidden",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
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
            borderTop: "1px solid hsl(var(--border))",
            display: "flex",
            alignItems: "stretch",
            backgroundColor: "#0b0b0a",
          }}
        >
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
