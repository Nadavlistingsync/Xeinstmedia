"use client";

import { Eye, EyeOff } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { CreatorPortal } from "@/components/CreatorPortal";
import { MarketplaceApp } from "@/components/MarketplaceApp";

type SessionResponse = {
  user: null | { id: string; email: string; accountType: "agent" | "creator" };
};

export function AuthGate() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [accountType, setAccountType] = useState<"agent" | "creator">("agent");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [user, setUser] = useState<null | { id: string; email: string; accountType: "agent" | "creator" }>(null);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        const payload = (await response.json()) as SessionResponse;
        setUser(payload.user);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          accountType: mode === "signup" ? accountType : undefined,
        }),
      });
      const payload = (await response.json()) as {
        user?: { id?: string; email?: string; accountType?: "agent" | "creator" };
        message?: string;
      };

      if (response.status === 202) {
        setMessage(payload.message || "Check your email to confirm your account.");
        return;
      }

      if (!response.ok || !payload.user?.email) {
        throw new Error(payload.message || "Authentication failed.");
      }

      setUser({
        id: payload.user.id ?? "unknown",
        email: payload.user.email,
        accountType: payload.user.accountType === "creator" ? "creator" : "agent",
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="checkout-complete"><section><p>Loading session...</p></section></main>;
  }

  if (user) {
    return user.accountType === "creator" ? (
      <CreatorPortal user={user} />
    ) : (
      <MarketplaceApp user={user} />
    );
  }

  return (
    <main className="checkout-complete">
      <section>
        <p className="eyebrow">RentTok Access</p>
        <h1>{mode === "login" ? "Log In" : "Sign Up"}</h1>
        <p>
          {mode === "signup"
            ? "Choose whether this account is for an agent or a creator."
            : "Use your email and password to access your dashboard."}
        </p>
        <form className="booking-form" onSubmit={onSubmit}>
          {mode === "signup" ? (
            <label>
              Account Type
              <span className="auth-role-toggle">
                <button
                  type="button"
                  className={accountType === "agent" ? "active" : ""}
                  onClick={() => setAccountType("agent")}
                >
                  Agent
                </button>
                <button
                  type="button"
                  className={accountType === "creator" ? "active" : ""}
                  onClick={() => setAccountType("creator")}
                >
                  Creator
                </button>
              </span>
            </label>
          ) : null}
          <label>
            Email
            <input
              autoComplete="email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>
          <label>
            Password
            <span className="password-field">
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                minLength={6}
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="password-toggle"
                type="button"
                onClick={() => setShowPassword((current) => !current)}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </span>
          </label>
          {message ? <p className="error-text">{message}</p> : null}
          <button className="primary-cta" disabled={submitting} type="submit">
            {submitting ? "Please wait..." : mode === "login" ? "Log In" : "Create Account"}
          </button>
        </form>
        <button
          className="text-cta"
          type="button"
          onClick={() => setMode((current) => (current === "login" ? "signup" : "login"))}
        >
          {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
        </button>
      </section>
    </main>
  );
}
