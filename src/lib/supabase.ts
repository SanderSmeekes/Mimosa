import { createClient } from "@supabase/supabase-js"

const SUPABASE_URL = "https://pjypoehuuowgcldnksss.supabase.co"
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqeXBvZWh1dW93Z2NsZG5rc3NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIzOTY5ODQsImV4cCI6MjA5Nzk3Mjk4NH0.iEwKvWxdxepo8nvgzu5sQ7bn1amfk7DANtsJakbToyo"

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export type UserRecord = {
  name_key: string
  display_name: string
  favourites: string[]
}

export function toNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, "-")
}

export async function lookupUser(nameKey: string): Promise<UserRecord | null> {
  const { data, error } = await supabase
    .from("user_favourites")
    .select("name_key, display_name, favourites")
    .eq("name_key", nameKey)
    .single()
  if (error || !data) return null
  return data as UserRecord
}

export async function createUser(displayName: string): Promise<UserRecord> {
  const name_key = toNameKey(displayName)
  const record: UserRecord = { name_key, display_name: displayName, favourites: [] }
  const { error } = await supabase.from("user_favourites").insert(record)
  if (error) throw error
  return record
}

export async function saveFavourites(nameKey: string, favourites: string[]): Promise<void> {
  const { error } = await supabase
    .from("user_favourites")
    .update({ favourites, updated_at: new Date().toISOString() })
    .eq("name_key", nameKey)
  if (error) throw error
}

export async function countSaves(slotKey: string): Promise<number> {
  const { count, error } = await supabase
    .from("user_favourites")
    .select("*", { count: "exact", head: true })
    .contains("favourites", JSON.stringify([slotKey]))
  if (error) return 0
  return count ?? 0
}

export async function getSavers(slotKey: string): Promise<{ name_key: string; display_name: string; favourites: string[] }[]> {
  const { data, error } = await supabase
    .from("user_favourites")
    .select("name_key, display_name, favourites")
    .contains("favourites", JSON.stringify([slotKey]))
  if (error || !data) return []
  return data
}

export async function getUserFavourites(nameKey: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("user_favourites")
    .select("favourites")
    .eq("name_key", nameKey)
    .single()
  if (error || !data) return []
  return data.favourites as string[]
}

export async function signInWithEmail(email: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  })
  if (error) throw new Error(error.message)
}

export async function verifyOtp(email: string, token: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

export async function lookupOrCreateAuthUser(
  userId: string,
  displayName: string,
): Promise<UserRecord> {
  const existing = await lookupUser(userId)
  if (existing) return existing
  const record: UserRecord = { name_key: userId, display_name: displayName, favourites: [] }
  const { error } = await supabase.from("user_favourites").insert(record)
  if (error) throw error
  return record
}
