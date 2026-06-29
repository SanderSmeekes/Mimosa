import React, { useState, useEffect, useRef } from "react"
import { supabase, signInWithEmail, verifyOtp, lookupOrCreateAuthUser, type UserRecord } from "../lib/supabase"

type Step = "welcome" | "email" | "code" | "display_name" | "loading" | "error"

type Props = {
  onComplete: (record: UserRecord) => void
}

const fadeIn = `
@keyframes ob-fade-up {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

function FadeItem({ children, delay = 0, style }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  return (
    <div style={{
      animation: `ob-fade-up 700ms cubic-bezier(0.22,1,0.36,1) both`,
      animationDelay: `${delay}ms`,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      ...style,
    }}>
      {children}
    </div>
  )
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("welcome")
  const [emailInput, setEmailInput] = useState("")
  const [codeInput, setCodeInput] = useState(["", "", "", "", "", ""])
  const [displayNameInput, setDisplayNameInput] = useState("")
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!session?.user) return
      const { data } = await supabase
        .from("user_favourites")
        .select("name_key, display_name, favourites")
        .eq("name_key", session.user.id)
        .single()
      if (data) {
        onComplete(data as UserRecord)
      } else {
        setStep("display_name")
      }
    })
    return () => subscription.unsubscribe()
  }, [onComplete])

  async function handleSendCode() {
    const email = emailInput.trim()
    if (!email) return
    setError("")
    setSending(true)
    try {
      await signInWithEmail(email)
      setCodeInput(["", "", "", "", "", ""])
      setStep("code")
      setTimeout(() => codeRefs.current[0]?.focus(), 100)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code.")
    } finally {
      setSending(false)
    }
  }

  function handleCodeKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !codeInput[i] && i > 0) {
      codeRefs.current[i - 1]?.focus()
    }
  }

  function handleCodeChange(i: number, val: string) {
    // Allow paste of full 6-digit code
    if (val.length > 1) {
      const digits = val.replace(/\D/g, "").slice(0, 6)
      if (digits.length === 6) {
        const next = digits.split("")
        setCodeInput(next)
        codeRefs.current[5]?.focus()
        handleVerify(digits)
        return
      }
    }
    const digit = val.replace(/\D/g, "").slice(-1)
    const next = [...codeInput]
    next[i] = digit
    setCodeInput(next)
    if (digit && i < 5) codeRefs.current[i + 1]?.focus()
    if (next.every(d => d) ) handleVerify(next.join(""))
  }

  async function handleVerify(token?: string) {
    const code = token ?? codeInput.join("")
    if (code.length !== 6) return
    setError("")
    setVerifying(true)
    try {
      await verifyOtp(emailInput.trim(), code)
      // onAuthStateChange handles the rest
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code. Please try again.")
      setCodeInput(["", "", "", "", "", ""])
      setTimeout(() => codeRefs.current[0]?.focus(), 50)
    } finally {
      setVerifying(false)
    }
  }

  async function handleSetDisplayName() {
    const name = displayNameInput.trim()
    if (!name) return
    setStep("loading")
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setStep("error"); return }
      const record = await lookupOrCreateAuthUser(session.user.id, name)
      onComplete(record)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.")
      setStep("error")
    }
  }

  const bg: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "#0b0b0a",
    color: "#f0ece0",
    fontFamily: "'Space Mono', monospace",
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
    fontFamily: "'Space Mono', monospace",
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
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    fontSize: 15,
    letterSpacing: "0.08em",
    cursor: "pointer",
    textTransform: "uppercase" as const,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  })

  if (step === "welcome") {
    return (
      <div style={bg}>
        <style>{fadeIn}</style>
        <div style={card}>
          <FadeItem delay={0}>
            <img
              src="/memosa-glass.png"
              alt=""
              style={{ width: 120, height: 120, objectFit: "contain", marginBottom: 8 }}
            />
          </FadeItem>
          <FadeItem delay={100}>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: "0.06em" }}>mimosa</div>
          </FadeItem>
          <FadeItem delay={220}>
            <div style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.5 }}>
              your personal timetable for memòri festival 2026
            </div>
          </FadeItem>
          <FadeItem delay={340}>
            <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.6 }}>
              sign in with your email to save your favourites and see what others are picking.
            </div>
          </FadeItem>
          <FadeItem delay={460}>
            <button style={btn()} onClick={() => setStep("email")}>
              get started <span style={{ fontSize: 18, lineHeight: 1 }}>→</span>
            </button>
          </FadeItem>
        </div>
      </div>
    )
  }

  if (step === "email") {
    return (
      <div style={bg}>
        <div style={card}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>sign in</div>
          <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.6 }}>
            enter your email — we'll send a 6-digit code. no password needed.
          </div>
          <input
            style={inputStyle}
            type="email"
            placeholder="your@email.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendCode()}
            autoFocus
            disabled={sending}
          />
          {error && <div style={{ fontSize: 12, color: "#e07070" }}>{error}</div>}
          <button
            style={{ ...btn(), opacity: sending || !emailInput.trim() ? 0.5 : 1 }}
            onClick={handleSendCode}
            disabled={sending || !emailInput.trim()}
          >
            {sending ? "sending…" : "send code"}
          </button>
          <button style={{ ...btn("secondary"), fontSize: 13 }} onClick={() => setStep("welcome")}>
            back
          </button>
        </div>
      </div>
    )
  }

  if (step === "code") {
    const complete = codeInput.every(d => d)
    return (
      <div style={bg}>
        <div style={card}>
          <div style={{ fontSize: 32 }}>✉️</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>enter your code</div>
          <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.6 }}>
            we sent a 6-digit code to <strong style={{ opacity: 0.9 }}>{emailInput}</strong>. enter it below — no need to open any link.
          </div>

          {/* 6-box OTP input */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            {codeInput.map((digit, i) => (
              <input
                key={i}
                ref={el => { codeRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={e => handleCodeChange(i, e.target.value)}
                onKeyDown={e => handleCodeKey(i, e)}
                style={{
                  width: 44,
                  height: 52,
                  background: "transparent",
                  border: digit ? "1px solid rgba(240,236,224,0.7)" : "1px solid rgba(240,236,224,0.25)",
                  borderRadius: 6,
                  color: "#f0ece0",
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 22,
                  fontWeight: 700,
                  textAlign: "center",
                  outline: "none",
                  caretColor: "transparent",
                  transition: "border-color 120ms ease",
                }}
                disabled={verifying}
              />
            ))}
          </div>

          {error && <div style={{ fontSize: 12, color: "#e07070" }}>{error}</div>}

          <button
            style={{ ...btn(), opacity: (!complete || verifying) ? 0.5 : 1 }}
            onClick={() => handleVerify()}
            disabled={!complete || verifying}
          >
            {verifying ? "verifying…" : "continue"}
          </button>
          <button
            style={{ ...btn("secondary"), fontSize: 13 }}
            onClick={() => { setStep("email"); setError(""); setCodeInput(["", "", "", "", "", ""]) }}
          >
            use a different email
          </button>
        </div>
      </div>
    )
  }

  if (step === "display_name") {
    return (
      <div style={bg}>
        <div style={card}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>what's your name?</div>
          <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.6 }}>
            choose a display name so others can recognise you in the app.
          </div>
          <input
            style={inputStyle}
            placeholder="display name"
            value={displayNameInput}
            onChange={(e) => setDisplayNameInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSetDisplayName()}
            autoFocus
          />
          <button
            style={{ ...btn(), opacity: !displayNameInput.trim() ? 0.5 : 1 }}
            onClick={handleSetDisplayName}
            disabled={!displayNameInput.trim()}
          >
            continue
          </button>
        </div>
      </div>
    )
  }

  if (step === "loading") {
    return (
      <div style={bg}>
        <div style={card}>
          <div style={{ fontSize: 13, opacity: 0.5 }}>loading…</div>
        </div>
      </div>
    )
  }

  if (step === "error") {
    return (
      <div style={bg}>
        <div style={card}>
          <div style={{ fontSize: 20, fontWeight: 700 }}>something went wrong</div>
          {error && <div style={{ fontSize: 13, color: "#e07070" }}>{error}</div>}
          <button style={btn()} onClick={() => { setStep("welcome"); setError("") }}>
            try again
          </button>
        </div>
      </div>
    )
  }

  return null
}
