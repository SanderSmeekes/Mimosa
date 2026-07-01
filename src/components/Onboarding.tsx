import React, { useState, useEffect } from "react"
import { supabase, signInWithEmail, lookupOrCreateAuthUser, type UserRecord } from "../lib/supabase"

type Step = "email" | "sent" | "display_name" | "loading" | "error"

type Props = {
  onComplete: (record: UserRecord) => void
}

const fadeIn = `
@keyframes ob-fade-up {
  from { opacity: 0; transform: translateY(22px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes ob-logo-flip {
  0%   { transform: perspective(800px) rotateY(-90deg); opacity: 0; }
  30%  { opacity: 1; }
  55%  { transform: perspective(800px) rotateY(0deg); }
  70%  { transform: perspective(800px) rotateY(8deg); }
  83%  { transform: perspective(800px) rotateY(-4deg); }
  100% { transform: perspective(800px) rotateY(0deg); opacity: 1; }
}
input:-webkit-autofill,
input:-webkit-autofill:hover,
input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0px 1000px #0b0b0a inset !important;
  -webkit-text-fill-color: #f0ece0 !important;
  caret-color: #f0ece0;
}
`

function FadeItem({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <div style={{
      animation: `ob-fade-up 700ms cubic-bezier(0.22,1,0.36,1) both`,
      animationDelay: `${delay}ms`,
      width: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
    }}>
      {children}
    </div>
  )
}

const bg: React.CSSProperties = {
  position: "fixed", inset: 0, background: "#0b0b0a", color: "#f0ece0",
  fontFamily: "'Space Mono', monospace", display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", padding: "24px", zIndex: 9999,
}

const card: React.CSSProperties = {
  width: "100%", maxWidth: 360, display: "flex", flexDirection: "column",
  alignItems: "center", textAlign: "center", gap: 20,
}

const inputStyle: React.CSSProperties = {
  width: "100%", background: "transparent",
  border: "1px solid rgba(240,236,224,0.3)", borderRadius: 4,
  color: "#f0ece0", fontFamily: "'Space Grotesk', sans-serif",
  fontSize: 17, padding: "12px 14px", outline: "none",
  boxSizing: "border-box", textAlign: "left", letterSpacing: "0.01em",
}

function btn(variant: "primary" | "secondary" = "primary"): React.CSSProperties {
  return {
    width: "100%", minHeight: 48,
    background: variant === "primary" ? "#f0ece0" : "transparent",
    color: variant === "primary" ? "#0b0b0a" : "#f0ece0",
    border: variant === "secondary" ? "1px solid rgba(240,236,224,0.4)" : "none",
    borderRadius: 4, fontFamily: "'Space Mono', monospace", fontWeight: 700,
    fontSize: 15, letterSpacing: "0.08em", cursor: "pointer",
    textTransform: "uppercase", display: "flex", alignItems: "center",
    justifyContent: "center", gap: 8,
  }
}

export function Onboarding({ onComplete }: Props) {
  const [step, setStep] = useState<Step>("email")
  const [emailInput, setEmailInput] = useState("")
  const [codeInput, setCodeInput] = useState("")
  const [displayNameInput, setDisplayNameInput] = useState("")
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [verifying, setVerifying] = useState(false)

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

  function validateEmail(email: string): string | null {
    if (!email.includes("@")) return "missing @ — check your email address."
    const [local, domain] = email.split("@")
    if (!local) return "something's missing before the @."
    if (!domain || !domain.includes(".")) return "missing domain — e.g. gmail.com."
    if (domain.endsWith(".")) return "email can't end with a dot."
    const typos: Record<string, string> = {
      "gmail.con": "gmail.com", "gmail.cmo": "gmail.com", "gmial.com": "gmail.com",
      "gmai.com": "gmail.com", "hotmail.con": "hotmail.com", "hotmial.com": "hotmail.com",
      "icloud.con": "icloud.com", "yahooo.com": "yahoo.com", "yaho.com": "yahoo.com",
      "outloook.com": "outlook.com", "outlok.com": "outlook.com",
    }
    if (typos[domain]) return `did you mean ${local}@${typos[domain]}?`
    return null
  }

  async function handleSendLink() {
    const email = emailInput.trim().toLowerCase()
    if (!email) return
    const validationError = validateEmail(email)
    if (validationError) { setError(validationError); return }
    setError("")
    setSending(true)
    try {
      await signInWithEmail(email)
      setStep("sent")
    } catch (err) {
      const msg = (err instanceof Error ? err.message : (err as { message?: string })?.message) ?? ""
      const lower = msg.toLowerCase()
      setError(
        lower.includes("rate") || lower.includes("limit") ? "too many attempts — wait a minute and try again." :
        lower.includes("signup") || lower.includes("disabled") ? "sign-ups are temporarily disabled. try again later." :
        lower.includes("invalid") ? "that doesn't look like a valid email address." :
        msg || "couldn't send the link. try again."
      )
    } finally {
      setSending(false)
    }
  }

  async function handleVerifyCode() {
    const token = codeInput.trim()
    if (token.length !== 6) return
    setError("")
    setVerifying(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: emailInput.trim().toLowerCase(),
        token,
        type: "email",
      })
      if (error) throw new Error(error.message)
    } catch (err) {
      const msg = (err instanceof Error ? err.message : (err as { message?: string })?.message) ?? ""
      const lower = msg.toLowerCase()
      setError(
        lower.includes("expired") ? "code expired — request a new one." :
        lower.includes("invalid") ? "wrong code — double-check and try again." :
        msg || "couldn't verify the code. try again."
      )
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

  if (step === "email") return (
    <div style={bg}>
      <style>{fadeIn}</style>
      <div style={card}>
        <div style={{ animation: "ob-logo-flip 1400ms cubic-bezier(0.25,0.8,0.25,1) both", animationDelay: "0ms", marginBottom: 4 }}>
          <img src="/memosa-glass.webp" alt="" style={{ width: 80, height: 80, objectFit: "contain", display: "block" }} />
        </div>
        <FadeItem delay={200}>
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.06em" }}>mimosa</div>
        </FadeItem>
        <FadeItem delay={340}>
          <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.7 }}>save your mimosa favourites ❤️</div>
        </FadeItem>
        <FadeItem delay={440}>
          <input
            style={inputStyle} type="email" autoComplete="email" placeholder="your@email.com"
            value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSendLink()}
            autoFocus disabled={sending}
          />
        </FadeItem>
        {error && <div style={{ fontSize: 12, color: "#e07070" }}>{error}</div>}
        <FadeItem delay={520}>
          <button style={{ ...btn(), opacity: sending || !emailInput.trim() ? 0.5 : 1 }} onClick={handleSendLink} disabled={sending || !emailInput.trim()}>
            {sending ? "sending…" : "send magic link"}
          </button>
        </FadeItem>
      </div>
    </div>
  )

  if (step === "sent") return (
    <div style={bg}>
      <style>{fadeIn}</style>
      <div style={card}>
        <div style={{ fontSize: 32 }}>✉️</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>check your email</div>
        <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.6 }}>
          we sent a link + 6-digit code to <strong style={{ opacity: 0.9 }}>{emailInput}</strong>.
        </div>

        {/* Code input */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
          <input
            style={{ ...inputStyle, textAlign: "center", fontSize: 28, letterSpacing: "0.25em", fontFamily: "'Space Mono', monospace" }}
            type="text"
            inputMode="numeric"
            placeholder="000000"
            maxLength={6}
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value.replace(/\D/g, "")); setError("") }}
            onKeyDown={(e) => e.key === "Enter" && handleVerifyCode()}
            autoFocus
          />
          {error && <div style={{ fontSize: 12, color: "#e07070", textAlign: "center" }}>{error}</div>}
          <button
            style={{ ...btn(), opacity: verifying || codeInput.length !== 6 ? 0.5 : 1 }}
            onClick={handleVerifyCode}
            disabled={verifying || codeInput.length !== 6}
          >
            {verifying ? "verifying…" : "confirm code"}
          </button>
        </div>

        <div style={{
          width: "100%", background: "rgba(240,200,80,0.1)", border: "1px solid rgba(240,200,80,0.3)",
          borderRadius: 6, padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: 8,
        }}>
          <span style={{ fontSize: 14, flexShrink: 0 }}>📂</span>
          <div style={{ fontSize: 12, color: "rgba(240,200,80,0.9)", lineHeight: 1.6 }}>
            not seeing it? check your <strong>spam folder</strong>.
          </div>
        </div>

        <button style={{ ...btn("secondary"), fontSize: 13 }} onClick={async () => {
          setError(""); setCodeInput(""); setSending(true)
          try { await signInWithEmail(emailInput.trim().toLowerCase()) } catch { /* ok */ } finally { setSending(false) }
        }} disabled={sending}>
          {sending ? "sending…" : "resend code"}
        </button>
        <button style={{ ...btn("secondary"), fontSize: 13, opacity: 0.5 }} onClick={() => { setStep("email"); setCodeInput(""); setError("") }}>
          use a different email
        </button>
      </div>
    </div>
  )

  if (step === "display_name") return (
    <div style={bg}>
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>what's your name?</div>
        <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.6 }}>choose a display name so others can recognise you in the app.</div>
        <input
          style={inputStyle} placeholder="display name"
          value={displayNameInput} onChange={(e) => setDisplayNameInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSetDisplayName()}
          autoFocus
        />
        <button style={{ ...btn(), opacity: !displayNameInput.trim() ? 0.5 : 1 }} onClick={handleSetDisplayName} disabled={!displayNameInput.trim()}>
          continue
        </button>
      </div>
    </div>
  )

  if (step === "loading") return (
    <div style={bg}><div style={card}><div style={{ fontSize: 13, opacity: 0.5 }}>loading…</div></div></div>
  )

  if (step === "error") return (
    <div style={bg}>
      <div style={card}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>something went wrong</div>
        {error && <div style={{ fontSize: 13, color: "#e07070" }}>{error}</div>}
        <button style={btn()} onClick={() => { setStep("email"); setError("") }}>try again</button>
      </div>
    </div>
  )

  return null
}
