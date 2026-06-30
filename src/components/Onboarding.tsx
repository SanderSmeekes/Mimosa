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
  color: "#f0ece0", fontFamily: "'Space Mono', monospace",
  fontSize: 18, padding: "12px 14px", outline: "none",
  boxSizing: "border-box", textAlign: "left",
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
  const [displayNameInput, setDisplayNameInput] = useState("")
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)

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

  async function handleSendLink() {
    const email = emailInput.trim()
    if (!email) return
    setError("")
    setSending(true)
    try {
      await signInWithEmail(email)
      setStep("sent")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send link.")
    } finally {
      setSending(false)
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
      <div style={card}>
        <div style={{ fontSize: 32 }}>✉️</div>
        <div style={{ fontSize: 20, fontWeight: 700 }}>check your email</div>
        <div style={{ fontSize: 13, opacity: 0.55, lineHeight: 1.6 }}>
          we sent a magic link to <strong style={{ opacity: 0.9 }}>{emailInput}</strong>. tap it to sign in — you can close this screen.
        </div>
        <button style={{ ...btn("secondary"), fontSize: 13 }} onClick={() => { setStep("email"); setError("") }}>
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
