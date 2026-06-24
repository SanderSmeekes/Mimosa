import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { timetableData, type Day, type Stage, type SlotEntry } from "@/data/timetable"
import { Search } from "lucide-react"

const DAY_LABELS: Record<Day, string> = {
  Thursday: "THU",
  Friday: "FRI",
  Saturday: "SAT",
  Sunday: "SUN",
}

const STAGE_COLORS: Record<Stage, { bg: string; label: string }> = {
  LUX: { bg: "hsl(222, 47%, 28%)", label: "white" },
  UNDA: { bg: "hsl(220, 60%, 45%)", label: "white" },
  AURA: { bg: "hsl(270, 50%, 45%)", label: "white" },
  MENTIS: { bg: "hsl(160, 50%, 35%)", label: "white" },
}

const DISPLAYED_STAGES: Stage[] = ["LUX", "AURA", "MENTIS"]

function EventCard({ slot, stage }: { slot: SlotEntry; stage: Stage }) {
  const color = STAGE_COLORS[stage]
  return (
    <Card className="flex flex-col" style={{ minHeight: "96px" }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold leading-tight">{slot.artist}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between pt-0">
        <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
          {slot.start_time} – {slot.end_time}
        </span>
        <Badge
          style={{
            backgroundColor: color.bg,
            color: color.label,
            borderColor: "transparent",
          }}
        >
          {stage}
        </Badge>
      </CardContent>
    </Card>
  )
}

function StageColumn({ stage, slots, search }: { stage: Stage; slots: SlotEntry[]; search: string }) {
  const filtered = search
    ? slots.filter((s) => s.artist.toLowerCase().includes(search.toLowerCase()))
    : slots

  return (
    <div className="flex flex-col gap-3 min-w-0 flex-1">
      {filtered.length === 0 ? (
        <div
          className="rounded-lg border-2 border-dashed flex items-center justify-center py-12 text-sm"
          style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--muted-foreground))" }}
        >
          {search ? "No matches" : "No events"}
        </div>
      ) : (
        filtered.map((slot, i) => <EventCard key={i} slot={slot} stage={stage} />)
      )}
    </div>
  )
}

function DayView({ day, search }: { day: Day; search: string }) {
  const daySchedule = timetableData.schedule[day]

  return (
    <div>
      {/* Stage legend */}
      <div className="grid gap-6 mb-6 pl-[72px]" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
        {DISPLAYED_STAGES.map((stage) => (
          <div key={stage} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: STAGE_COLORS[stage].bg }}
            />
            <span className="font-semibold text-sm tracking-wider">{stage}</span>
          </div>
        ))}
      </div>

      {/* Grid: time gutter + 3 stage columns */}
      <div className="flex gap-6">
        {/* Time labels gutter */}
        <div className="flex flex-col gap-3 flex-shrink-0" style={{ minWidth: "72px", paddingRight: "16px" }}>
          {(() => {
            const allSlots = DISPLAYED_STAGES.flatMap((s) => daySchedule[s] ?? [])
            const times = [...new Set(allSlots.map((s) => s.start_time))].sort()
            return times.map((t) => (
              <div
                key={t}
                className="text-xs font-mono"
                style={{ color: "hsl(var(--muted-foreground))", paddingTop: "14px" }}
              >
                {t}
              </div>
            ))
          })()}
        </div>

        {/* Stage columns */}
        {DISPLAYED_STAGES.map((stage) => (
          <StageColumn
            key={stage}
            stage={stage}
            slots={daySchedule[stage] ?? []}
            search={search}
          />
        ))}
      </div>
    </div>
  )
}

export default function App() {
  const [search, setSearch] = useState("")
  const [activeDay, setActiveDay] = useState<Day>("Thursday")

  return (
    <div className="min-h-screen" style={{ backgroundColor: "hsl(var(--background))" }}>
      <div className="p-8 md:p-12 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-8 gap-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight m-0" style={{ color: "hsl(var(--foreground))" }}>
              Memori 2026
            </h1>
            <p className="text-sm mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>
              {timetableData.powered_by.join(" · ")}
            </p>
          </div>
          <div className="relative w-64 flex-shrink-0">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              style={{ color: "hsl(var(--muted-foreground))" }}
            />
            <Input
              placeholder="Search artist…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Day tabs */}
        <Tabs value={activeDay} onValueChange={(v) => setActiveDay(v as Day)}>
          <TabsList className="mb-8">
            {timetableData.days.map((day) => (
              <TabsTrigger
                key={day}
                value={day}
                style={
                  activeDay === day
                    ? { backgroundColor: "hsl(var(--background))", color: "hsl(var(--foreground))" }
                    : {}
                }
              >
                {DAY_LABELS[day]}
              </TabsTrigger>
            ))}
          </TabsList>

          {timetableData.days.map((day) => (
            <TabsContent key={day} value={day}>
              <DayView day={day} search={search} />
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  )
}
