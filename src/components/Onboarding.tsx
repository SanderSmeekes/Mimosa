import React, { useState, useRef } from "react"
import { lookupUser, createUser, toNameKey, type UserRecord } from "../lib/supabase"

type Step = "welcome" | "enter" | "loading" | "taken" | "confirm"

type Props = {
  onComplete: (record: UserRecord) => void
}

function offlineRecord(displayName: string): UserRecord {
  return { name_key: toNameKey(displayName), display_name: displayName, favourites: [] }
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome")
  const [nameInput, setNameInput] = useState("")
  const [confirmInput, setConfirmInput] = useState("")
  const [existingRecord, setExistingRecord] = useState<UserRecord | null>(null)
  const [newRecord, setNewRecord] = useState<UserRecord | null>(null)
  const [error, setError] = useState("")
  const [errorDetail, setErrorDetail] = useState("")
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleContinue() {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    setError("")
    setErrorDetail("")
    setStep("loading")
    try {
      const existing = await lookupUser(toNameKey(trimmed))
      if (existing) {
        setExistingRecord(existing)
        setStep("taken")
      } else {
        const record = await createUser(trimmed)
        setNewRecord(record)
        setStep("confirm")
      }
    } catch (err) {
      let msg = ""
      if (err instanceof Error) {
        msg = err.message
      } else if (err && typeof err === "object" && "message" in err) {
        msg = String((err as { message: unknown }).message)
      } else {
        msg = String(err)
      }
      setError("Could not reach sync server.")
      setErrorDetail(msg)
      setStep("enter")
    }
  }

  function handleSkipSync() {
    const trimmed = nameInput.trim()
    if (!trimmed) return
    // Use offline — picks stay local only
    const record = offlineRecord(trimmed)
    setNewRecord(record)
    setStep("confirm")
  }

  function handleCopyName() {
    if (!newRecord) return
    navigator.clipboard.writeText(newRecord.display_name).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleConfirm() {
    if (!newRecord) return
    if (confirmInput.trim().toLowerCase() !== newRecord.display_name.toLowerCase()) {
      setError("Name doesn't match. Try again.")
      return
    }
    onComplete(newRecord)
  }

  const bg: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "#0b0b0a",
    color: "#f0ece0",
    fontFamily: "'Courier Prime', monospace",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px",
    zIndex: 9999,
  }

  const card: React.CSSProperties = {
    width: "100%",
    maxWidth: 360,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    gap: 20,
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "transparent",
    border: "1px solid rgba(240,236,224,0.3)",
    borderRadius: 4,
    color: "#f0ece0",
    fontFamily: "'Courier Prime', monospace",
    fontSize: 18,
    padding: "12px 14px",
    outline: "none",
    boxSizing: "border-box",
    textAlign: "left",
  }

  const btn = (variant: "primary" | "secondary" = "primary"): React.CSSProperties => ({
    width: "100%",
    minHeight: 48,
    background: variant === "primary" ? "#f0ece0" : "transparent",
    color: variant === "primary" ? "#0b0b0a" : "#f0ece0",
    border: variant === "secondary" ? "1px solid rgba(240,236,224,0.4)" : "none",
    borderRadius: 4,
    fontFamily: "'Courier Prime', monospace",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "0.08em",
    cursor: "pointer",
    textTransform: "uppercase" as const,
  })

  if (step === "welcome") {
    return (
      <div style={bg}>
        <div style={card}>
          <img
            src="/memosa-glass.png"
            alt=""
            style={{ width: 96, height: 96, objectFit: "contain", marginBottom: 8 }}
          />
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.06em" }}>memosa</div>
          <div style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.5 }}>
            your personal timetable for memòri festival 2026
          </div>
          <div style={{ height: 8 }} />
          <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.6 }}>
            pick a name to save your favourites and sync them across all your devices.
          </div>
          <button style={btn()} onClick={() => setStep("enter")}>
            get started
          </button>
        </div>
      </div>
    )
  }

  if (step === "enter" || step === "loading") {
    return (
      <div style={bg}>
        <div style={card}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>choose your name</div>
          <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.6 }}>
            pick anything — a nickname, alias, anything you'll remember. this is your only password.
          </div>
          <input
            ref={inputRef}
            style={inputStyle}
            placeholder="your name"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleContinue()}
            autoFocus
            disabled={step === "loading"}
          />
          {error && (
            <div style={{ fontSize: 12, color: "#e07070", lineHeight: 1.6 }}>
              <div>{error}</div>
              {errorDetail && (
                <div style={{ marginTop: 4, opacity: 0.6, fontFamily: "monospace", fontSize: 11, wordBreak: "break-all" }}>
                  {errorDetail}
                </div>
              )}
            </div>
          )}
          <button
            style={{ ...btn(), opacity: step === "loading" ? 0.5 : 1 }}
            onClick={handleContinue}
            disabled={step === "loading" || !nameInput.trim()}
          >
            {step === "loading" ? "checking…" : "continue"}
          </button>
          {error && nameInput.trim() && (
            <button style={{ ...btn("secondary"), fontSize: 12 }} onClick={handleSkipSync}>
              continue without sync (local only)
            </button>
          )}
          <button style={{ ...btn("secondary"), fontSize: 13 }} onClick={() => setStep("welcome")}>
            back
          </button>
        </div>
      </div>
    )
  }

  if (step === "taken" && existingRecord) {
    const pickCount = existingRecord.favourites.length
    return (
      <div style={bg}>
        <div style={card}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>welcome back</div>
          <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.04em", wordBreak: "break-word" }}>
            {existingRecord.display_name}
          </div>
          <div style={{ fontSize: 13, opacity: 0.55 }}>
            {pickCount === 0 ? "no picks saved yet" : `${pickCount} pick${pickCount !== 1 ? "s" : ""} saved`}
          </div>
          <div style={{ height: 4 }} />
          <button style={btn()} onClick={() => onComplete(existingRecord)}>
            {pickCount > 0 ? "load my picks" : "use this name"}
          </button>
          <button
            style={{ ...btn("secondary"), fontSize: 13 }}
            onClick={() => {
              setExistingRecord(null)
              setNameInput("")
              setStep("enter")
            }}
          >
            choose a different name
          </button>
        </div>
      </div>
    )
  }

  if (step === "confirm" && newRecord) {
    const nameMatches =
      confirmInput.trim().toLowerCase() === newRecord.display_name.toLowerCase()
    return (
      <div style={bg}>
        <div style={{ ...card, maxWidth: 380 }}>
          <img
            src="/memosa-glass.png"
            alt=""
            style={{ width: 80, height: 80, objectFit: "contain", marginBottom: 4 }}
          />
          <div style={{ fontSize: 20, fontWeight: 700 }}>save your name</div>
          <div
            style={{
              background: "rgba(240,236,224,0.07)",
              borderRadius: 6,
              padding: "14px 16px",
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "0.04em",
              wordBreak: "break-word",
            }}
          >
            {newRecord.display_name}
          </div>
          <button
            style={{ ...btn("secondary"), fontSize: 13 }}
            onClick={handleCopyName}
          >
            {copied ? "copied!" : "copy name"}
          </button>
          <div
            style={{
              fontSize: 12,
              lineHeight: 1.7,
              color: "#d4a820",
              background: "rgba(212,168,32,0.1)",
              borderRadius: 4,
              padding: "12px 14px",
              borderLeft: "3px solid #d4a820",
              textAlign: "left",
              alignSelf: "stretch",
            }}
          >
            <strong style={{ display: "block", marginBottom: 4, fontSize: 13 }}>⚠ don't forget this name</strong>
            there are no passwords and no recovery. anyone who types this exact name gets your picks.
            write it down — in your notes app, a text to yourself, anywhere.
            if you lose it, your picks are gone forever.
          </div>
          <div style={{ fontSize: 13, opacity: 0.7 }}>type your name again to confirm:</div>
          <input
            style={inputStyle}
            placeholder={newRecord.display_name}
            value={confirmInput}
            onChange={(e) => {
              setConfirmInput(e.target.value)
              setError("")
            }}
            onKeyDown={(e) => e.key === "Enter" && nameMatches && handleConfirm()}
          />
          {error && <div style={{ fontSize: 13, color: "#e07070" }}>{error}</div>}
          <button
            style={{ ...btn(), opacity: nameMatches ? 1 : 0.4 }}
            onClick={handleConfirm}
            disabled={!nameMatches}
          >
            i've saved my name
          </button>
          <button
            style={{ ...btn("secondary"), fontSize: 13 }}
            onClick={() => {
              setNewRecord(null)
              setConfirmInput("")
              setNameInput("")
              setStep("enter")
            }}
          >
            choose a different name
          </button>
        </div>
      </div>
    )
  }

  return null
}
