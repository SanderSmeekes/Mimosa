export type ArtistLinks = {
  soundcloud?: string | null
  instagram?: string | null
  ra?: string | null
}

export type Artist = {
  id: string
  name: string
  country: string | null
  stage: string
  date: string
  bio: string
  links: ArtistLinks
}

export const artistsData: Record<string, Artist> = {
  "agonis": { id: "agonis", name: "Agonis", country: "Switzerland", stage: "LUX", date: "2026-07-03", bio: "Operating from his home base in Zurich, Agonis approaches electronic music with the precision of a sonic researcher, documenting interactions between deep techno mechanics and otherworldly sound design. Co-pilot of Amenthia Recordings alongside Garçon. His early EPs revealed a gift for smoke-filled dancefloor hypnosis, while 2021's 'Neutropia' crystallized his expansive vision with half-time experiments and lysergic soundscapes. Appearances at Labyrinth Festival and Monument 2024 established him as an innovative force, and his work on Delsin's Mantis series combines muscular low-end frequencies and precision synthesis with signature psychedelic elements.", links: { soundcloud: "https://soundcloud.com/agonis-amenthia", instagram: "https://www.instagram.com/agonis_amenthia/", ra: "https://fr.ra.co/dj/agonis" } },
  "alicia": { id: "alicia", name: "Alicia", country: "UK", stage: "AURA", date: "2026-07-02", bio: "London-based DJ and producer with a knack for weaving together disparate sounds, moving from dub reverberations to deep intricate techno, off-kilter dubstep and emotive bass hybrids shrouded in ambient haze. Her hypnotic, groove-driven approach has found a home on her Rinse UK residency and across venues such as Fabric, Phonox and Corsica Studios. Since 2022 she has explored the space between ambient listening and club intensity through Terra Obscura, an experimental club night.", links: { soundcloud: "https://soundcloud.com/aliciasteanson", instagram: "https://www.instagram.com/alicia_ajs/", ra: "https://fr.ra.co/dj/alicia" } },
  "andy-martin": { id: "andy-martin", name: "Andy Martin", country: null, stage: "LUX", date: "2026-07-05", bio: "", links: {} },
  "azu-tiwaline-tikiman": { id: "azu-tiwaline-tikiman", name: "Azu Tiwaline & Tikiman", country: null, stage: "LUX", date: "2026-07-05", bio: "", links: {} },
  "bambi-beatrice-m": { id: "bambi-beatrice-m", name: "Bambi & Beatrice M.", country: null, stage: "UNDA", date: "2026-07-04", bio: "", links: {} },
  "basic-chanel": { id: "basic-chanel", name: "basic chanel", country: null, stage: "MENTIS", date: "2026-07-04", bio: "", links: {} },
  "benedikt-frey": { id: "benedikt-frey", name: "Benedikt Frey", country: null, stage: "UNDA", date: "2026-07-04", bio: "", links: {} },
  "carrier-gavsborg": { id: "carrier-gavsborg", name: "Carrier & Gavsborg", country: null, stage: "LUX", date: "2026-07-02", bio: "", links: {} },
  "ccl": { id: "ccl", name: "CCL", country: null, stage: "LUX", date: "2026-07-04", bio: "", links: {} },
  "christian-coiffure": { id: "christian-coiffure", name: "Christian Coiffure", country: null, stage: "LUX", date: "2026-07-05", bio: "", links: {} },
  "conrad-pack": { id: "conrad-pack", name: "Conrad Pack", country: null, stage: "AURA", date: "2026-07-04", bio: "", links: {} },
  "cousin": { id: "cousin", name: "Cousin", country: null, stage: "LUX", date: "2026-07-03", bio: "", links: {} },
  "cusoon-dj": { id: "cusoon-dj", name: "cusoon dj", country: null, stage: "AURA", date: "2026-07-02", bio: "", links: {} },
  "darwin": { id: "darwin", name: "Darwin", country: null, stage: "AURA", date: "2026-07-02", bio: "", links: {} },
  "de-grandi": { id: "de-grandi", name: "De Grandi", country: null, stage: "LUX", date: "2026-07-04", bio: "", links: {} },
  "deep-creep": { id: "deep-creep", name: "deep creep", country: null, stage: "AURA", date: "2026-07-04", bio: "", links: {} },
  "ema": { id: "ema", name: "EMA", country: null, stage: "LUX", date: "2026-07-04", bio: "", links: {} },
  "georg-i-older-brother": { id: "georg-i-older-brother", name: "georg-i & Older Brother", country: null, stage: "LUX", date: "2026-07-04", bio: "", links: {} },
  "ghost-dubs": { id: "ghost-dubs", name: "Ghost Dubs", country: null, stage: "LUX", date: "2026-07-05", bio: "", links: {} },
  "hyba-dreeming": { id: "hyba-dreeming", name: "HYBЯA DREEMING", country: null, stage: "LUX", date: "2026-07-03", bio: "", links: {} },
  "jacky-jeane-israfil": { id: "jacky-jeane-israfil", name: "Jacky Jeane & Israfil", country: null, stage: "UNDA", date: "2026-07-04", bio: "", links: {} },
  "jan-loup": { id: "jan-loup", name: "Jan Loup", country: null, stage: "LUX", date: "2026-07-02", bio: "", links: {} },
  "jonquera-officium": { id: "jonquera-officium", name: "Jonquera & Officium", country: null, stage: "LUX", date: "2026-07-02", bio: "", links: {} },
  "judaah": { id: "judaah", name: "Judaah", country: null, stage: "UNDA", date: "2026-07-03", bio: "", links: {} },
  "k-means": { id: "k-means", name: "k means", country: null, stage: "AURA", date: "2026-07-03", bio: "", links: {} },
  "kia": { id: "kia", name: "Kia", country: null, stage: "LUX", date: "2026-07-05", bio: "", links: {} },
  "konduku": { id: "konduku", name: "Konduku", country: null, stage: "LUX", date: "2026-07-03", bio: "", links: {} },
  "lolo-kia": { id: "lolo-kia", name: "Lolo & Kia", country: null, stage: "MENTIS", date: "2026-07-02", bio: "", links: {} },
  "mains-courantes": { id: "mains-courantes", name: "Mains Courantes", country: null, stage: "UNDA", date: "2026-07-05", bio: "", links: {} },
  "malesa": { id: "malesa", name: "Malesa", country: null, stage: "LUX", date: "2026-07-04", bio: "", links: {} },
  "marino2": { id: "marino2", name: "marino2", country: null, stage: "UNDA", date: "2026-07-03", bio: "", links: {} },
  "marylou": { id: "marylou", name: "Marylou", country: null, stage: "LUX", date: "2026-07-02", bio: "", links: {} },
  "mia-koden": { id: "mia-koden", name: "Mia Koden", country: null, stage: "UNDA", date: "2026-07-03", bio: "", links: {} },
  "mu-tate": { id: "mu-tate", name: "mu tate", country: null, stage: "MENTIS", date: "2026-07-04", bio: "", links: {} },
  "nap": { id: "nap", name: "NAP", country: null, stage: "UNDA", date: "2026-07-04", bio: "", links: {} },
  "nono-gigsta": { id: "nono-gigsta", name: "Nono Gigsta", country: null, stage: "UNDA", date: "2026-07-03", bio: "", links: {} },
  "ohjeelo": { id: "ohjeelo", name: "Ohjeelo", country: null, stage: "AURA", date: "2026-07-03", bio: "", links: {} },
  "oko-dj": { id: "oko-dj", name: "OKO DJ", country: null, stage: "LUX", date: "2026-07-04", bio: "", links: {} },
  "plo-man": { id: "plo-man", name: "PLO man", country: null, stage: "AURA", date: "2026-07-04", bio: "", links: {} },
  "raphael-fragil": { id: "raphael-fragil", name: "Raphaël Fragil", country: null, stage: "MENTIS", date: "2026-07-03", bio: "", links: {} },
  "roulita": { id: "roulita", name: "Roulita", country: null, stage: "LUX", date: "2026-07-03", bio: "", links: {} },
  "salma-rosa-sleek-fata": { id: "salma-rosa-sleek-fata", name: "Salma Rosa & sleek fata", country: null, stage: "LUX", date: "2026-07-04", bio: "", links: {} },
  "sandrien": { id: "sandrien", name: "Sandrien", country: null, stage: "LUX", date: "2026-07-03", bio: "", links: {} },
  "severja": { id: "severja", name: "Severja", country: null, stage: "UNDA", date: "2026-07-05", bio: "", links: {} },
  "shackleton": { id: "shackleton", name: "Shackleton", country: "UK", stage: "LUX", date: "2026-07-05", bio: "English maverick and psychedelic ritual-trance maestro who emerged from the early-2000s UK bass scene, the same crucible that forged dubstep and grime. Two decades on, he stands as one of the most singular figures of this aesthetic. Founder of Skull Disco and Woe To The Septic Heart, with releases on Rough Trade, Perlon, Fabric and Honest Jon's, and collaborations with Appleblim, Pinch, Scotch Rolex, Holy Tongue and Wacław Zimpel. His productions and live sets move between vaporous dark ambient, hallucinated low-end mantras, razor-sharp bass drops, cathartic psychedelia and industrial dubstep, fused with a wide sea of non-western inspirations.", links: { soundcloud: "https://soundcloud.com/shackletonofficial", ra: "https://fr.ra.co/dj/shackleton" } },
  "slowfoam": { id: "slowfoam", name: "Slowfoam", country: null, stage: "MENTIS", date: "2026-07-02", bio: "", links: {} },
  "soa420": { id: "soa420", name: "Soa420", country: null, stage: "UNDA", date: "2026-07-03", bio: "", links: {} },
  "theo-muller": { id: "theo-muller", name: "Théo Muller", country: null, stage: "MENTIS", date: "2026-07-03", bio: "", links: {} },
  "toma-kami": { id: "toma-kami", name: "Toma Kami", country: null, stage: "AURA", date: "2026-07-03", bio: "", links: {} },
  "trailcam": { id: "trailcam", name: "Trailcam", country: null, stage: "LUX", date: "2026-07-03", bio: "", links: {} },
  "trickpony": { id: "trickpony", name: "trickpony", country: null, stage: "LUX", date: "2026-07-02", bio: "", links: {} },
  "zara-command-d": { id: "zara-command-d", name: "Zara & Command D", country: null, stage: "LUX", date: "2026-07-05", bio: "", links: {} },
}
