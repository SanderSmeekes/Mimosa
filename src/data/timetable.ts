export const timetableData = {
  event: "Memori Timetable 2026",
  powered_by: ["Combeult Audio", "Tweak Soundsystem", "Thick O Sound", "Vortex Lights"],
  schedule: {
    Thursday: {
      LUX: [
        { artist: "MARYLOU", start_time: "20:00", end_time: "21:00" },
        { artist: "IANCOFFRA OFFICIUM", start_time: "21:00", end_time: "22:00" },
        { artist: "THIERRY", start_time: "22:00", end_time: "23:00" },
        { artist: "JAN LOUP", start_time: "23:00", end_time: "00:00" },
        { artist: "CARRIER & GUNSBOURG", start_time: "00:00", end_time: "01:00" },
      ],
      UNDA: [],
      AURA: [
        { artist: "ALICIA", start_time: "23:00", end_time: "01:00" },
        { artist: "CUSDON DJ", start_time: "01:00", end_time: "03:00" },
        { artist: "DARWIN", start_time: "03:00", end_time: "05:00" },
      ],
      MENTIS: [
        { artist: "SLOWFOAM", start_time: "02:00", end_time: "04:00" },
        { artist: "KIA & LOLO", start_time: "04:00", end_time: "06:00" },
      ],
    },
    Friday: {
      LUX: [
        { artist: "TRAILCAM", start_time: "16:00", end_time: "17:00" },
        { artist: "COUSIN", start_time: "17:00", end_time: "18:00" },
        { artist: "ROELITA", start_time: "18:00", end_time: "19:00" },
        { artist: "AGONIS", start_time: "19:00", end_time: "20:00" },
        { artist: "KONDUKI", start_time: "20:00", end_time: "21:00" },
        { artist: "ENDO BREKING", start_time: "21:00", end_time: "22:00" },
        { artist: "SABRIIEN", start_time: "22:00", end_time: "23:00" },
      ],
      UNDA: [
        { artist: "JUDAAIH", start_time: "10:00", end_time: "13:00" },
        { artist: "SQA420", start_time: "13:00", end_time: "15:00" },
        { artist: "MARINO2", start_time: "15:00", end_time: "16:00" },
        { artist: "MIA KODEN", start_time: "16:00", end_time: "17:00" },
        { artist: "NONO GIGOSTA", start_time: "17:00", end_time: "20:00" },
      ],
      AURA: [
        { artist: "OILTELLO", start_time: "23:00", end_time: "01:00" },
        { artist: "TUMA KAMI", start_time: "01:00", end_time: "03:00" },
        { artist: "K MEANS", start_time: "03:00", end_time: "05:00" },
      ],
      MENTIS: [
        { artist: "THËO MULLER", start_time: "02:00", end_time: "04:00" },
        { artist: "RAPHAËL FRAGIL", start_time: "04:00", end_time: "06:00" },
      ],
    },
    Saturday: {
      LUX: [
        { artist: "CRAIG", start_time: "20:00", end_time: "21:00" },
        { artist: "ÖKÖ DJ", start_time: "21:00", end_time: "22:00" },
        { artist: "MALESA", start_time: "22:00", end_time: "23:00" },
        { artist: "SAU & BRA SISTER TATO", start_time: "23:00", end_time: "00:00" },
        { artist: "& OLDER BROTHER", start_time: "00:00", end_time: "01:00" },
        { artist: "EMA", start_time: "01:00", end_time: "02:00" },
        { artist: "DE GRANDI", start_time: "02:00", end_time: "03:00" },
        { artist: "CUL", start_time: "03:00", end_time: "04:00" },
      ],
      UNDA: [
        { artist: "JACKY JEANE & ISRAFIL", start_time: "10:00", end_time: "13:00" },
        { artist: "BANDIT & BEATRICE M.", start_time: "13:00", end_time: "15:00" },
        { artist: "BENEDIKT FREY", start_time: "15:00", end_time: "16:00" },
        { artist: "NAP", start_time: "16:00", end_time: "19:00" },
      ],
      AURA: [
        { artist: "PLO MAN", start_time: "23:00", end_time: "01:00" },
        { artist: "DEEP CREEP", start_time: "01:00", end_time: "03:00" },
        { artist: "CONRAD", start_time: "03:00", end_time: "05:00" },
      ],
      MENTIS: [
        { artist: "MU TATE", start_time: "02:00", end_time: "04:00" },
        { artist: "BASIC CHANEL", start_time: "04:00", end_time: "06:00" },
      ],
    },
    Sunday: {
      LUX: [
        { artist: "JIMMY DUBS", start_time: "16:00", end_time: "17:00" },
        { artist: "& TIEKMAN", start_time: "17:00", end_time: "18:00" },
        { artist: "C.COIFFURE", start_time: "18:00", end_time: "19:00" },
        { artist: "SHACKLETON", start_time: "19:00", end_time: "20:00" },
        { artist: "ZARA & COMMAND D", start_time: "20:00", end_time: "21:00" },
        { artist: "ANDY MARTIN", start_time: "21:00", end_time: "22:00" },
        { artist: "KIA", start_time: "22:00", end_time: "23:00" },
      ],
      UNDA: [
        { artist: "SEVERJA", start_time: "10:00", end_time: "13:00" },
        { artist: "MARYLOU", start_time: "13:00", end_time: "15:00" },
        { artist: "MAUSS COURRANTES", start_time: "15:00", end_time: "18:00" },
      ],
      AURA: [],
      MENTIS: [],
    },
  },
  stages: ["LUX", "UNDA", "AURA", "MENTIS"] as const,
  days: ["Thursday", "Friday", "Saturday", "Sunday"] as const,
}

export type Stage = (typeof timetableData.stages)[number]
export type Day = (typeof timetableData.days)[number]
export type SlotEntry = { artist: string; start_time: string; end_time: string }
